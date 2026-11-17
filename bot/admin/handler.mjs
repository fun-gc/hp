// 編集画面(/admin)の API。Cloudflare Pages Functions(functions/api/admin/[[route]].js)から呼ぶ(docs/admin.md)。
//
//   GET  /api/admin/login     Discord のログイン画面へ送る
//   GET  /api/admin/callback  Discord から戻ってくる。FUNGC のサーバーのメンバーなら、ログイン状態のクッキーを付けて /admin/ へ戻す
//   POST /api/admin/logout    ログアウト
//   GET  /api/admin/session   ログインしている人
//   GET  /api/admin/content   編集できるコンテンツ(本人の確認待ちの PR があれば、その内容)
//   POST /api/admin/save      1 件を保存・削除し、編集した人の PR に積む。運営がマージすると公開される
//
// 使う設定
//   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET   Developer Portal の OAuth2 のページ(ログインに使う)
//   DISCORD_BOT_TOKEN                          カレンダーと同じ Bot のトークン(サーバーのメンバーかを確かめる)
//   DISCORD_GUILD_ID か DISCORD_CHANNEL_ID      FUNGC のサーバー(省略時は募集チャンネルのあるサーバー)
//   GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY      /profile と同じ GitHub App(GITHUB_TOKEN でも動く)
//   GITHUB_REPO                                書き込むリポジトリ(省略すると fun-gc/hp)

import { avatarUrl, displayName } from "../members/profile.mjs";
import { installationToken } from "../members/github-app.mjs";
import { buildFile, checkKey, filePath, imageExt, KINDS, MAX_IMAGE_BYTES, ownThumbnailPath, parseMarkdown, readSnapshot, THUMBNAIL_EXTS } from "./content.mjs";
import { authorizeUrl, fetchLoginUser, findGuildMember } from "./discord.mjs";
import { ConflictError, createEditorRepo, utf8Base64 } from "./github.mjs";
import { openSession, parseCookies, randomToken, sameText, sealSession, SESSION_COOKIE, SESSION_SECONDS, setCookie, STATE_COOKIE, STATE_SECONDS } from "./session.mjs";

const KIND_LABEL = { news: "お知らせ", works: "作品", members: "メンバー", schedule: "予定" };
const SITE = "https://fungc.org";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

/** 足りない設定の名前(ログインした人に、運営へ伝えてもらうため) */
function missingSettings(env) {
  const missing = [];
  if (!env.DISCORD_CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
  if (!env.DISCORD_CLIENT_SECRET) missing.push("DISCORD_CLIENT_SECRET");
  if (!env.DISCORD_BOT_TOKEN) missing.push("DISCORD_BOT_TOKEN");
  if (!env.DISCORD_GUILD_ID && !env.DISCORD_CHANNEL_ID) missing.push("DISCORD_GUILD_ID");
  if (!(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY) && !env.GITHUB_TOKEN) missing.push("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY");
  return missing;
}

function editorRepo(env, fetch) {
  const repo = env.GITHUB_REPO || "fun-gc/hp";
  const useApp = Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
  if (!useApp && !env.GITHUB_TOKEN) return null;
  const token = useApp
    ? () => installationToken({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY, repo, fetch })
    : () => env.GITHUB_TOKEN;
  return createEditorRepo({ token, repo, fetch });
}

async function currentSession(request, env, now) {
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  return openSession(token, env.DISCORD_CLIENT_SECRET, now());
}

// ほかのサイトから、ログインしている人のブラウザを使って保存させない(クッキーは SameSite=Lax でも、念のため Origin も見る)
const sameOrigin = (request) => request.headers.get("Origin") === new URL(request.url).origin;

function login(request, env) {
  const { origin } = new URL(request.url);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return redirect(`${origin}/admin/?error=setup`);
  const state = randomToken();
  const location = authorizeUrl({ clientId: env.DISCORD_CLIENT_ID, redirectUri: `${origin}/api/admin/callback`, state });
  return redirect(location, [setCookie(STATE_COOKIE, state, STATE_SECONDS)]);
}

async function callback(request, env, { fetch, now }) {
  const url = new URL(request.url);
  const clearState = setCookie(STATE_COOKIE, "", 0);
  const back = (error) => redirect(`${url.origin}/admin/?error=${error}`, [clearState]);

  // Discord の画面で「キャンセル」を押したとき
  if (url.searchParams.get("error")) return back("denied");
  const expected = parseCookies(request.headers.get("Cookie"))[STATE_COOKIE];
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!expected || !state || !code || !sameText(state, expected)) return back("state");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return back("setup");

  let user;
  let found;
  try {
    user = await fetchLoginUser({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      code,
      redirectUri: `${url.origin}/api/admin/callback`,
      fetch,
    });
    found = await findGuildMember({ env, userId: user.id, fetch });
  } catch (err) {
    console.error(err);
    return back("failed");
  }
  if (!found) return back("not-member");

  const session = {
    id: user.id,
    username: user.username,
    name: displayName(found.member, user),
    avatar: avatarUrl(found.member, user, found.guildId),
    exp: Math.floor(now() / 1000) + SESSION_SECONDS,
  };
  const sealed = await sealSession(session, env.DISCORD_CLIENT_SECRET);
  return redirect(`${url.origin}/admin/`, [clearState, setCookie(SESSION_COOKIE, sealed, SESSION_SECONDS)]);
}

async function content(env, session, fetch) {
  const repo = editorRepo(env, fetch);
  if (!repo) return json({ error: "サイトに GitHub App の設定がありません。運営に知らせてください。" }, 503);
  const loaded = await repo.load(session.id);
  return json({ ref: loaded.ref, pull: loaded.pull, ...readSnapshot(loaded.files) });
}

/** 作品のサムネイルとして送られた画像。{ ext, base64 } か { error } */
function readUpload(upload) {
  if (!upload) return null;
  const base64 = String(upload.base64 ?? "")
    .replace(/^data:[^,]*,/, "")
    .replace(/\s/g, "");
  const tooLarge = { error: `画像は ${MAX_IMAGE_BYTES / 1024 / 1024} MB までにしてください` };
  if (base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) return tooLarge;
  let bytes;
  try {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return { error: "画像を読み込めませんでした" };
  }
  if (bytes.length > MAX_IMAGE_BYTES) return tooLarge;
  const ext = imageExt(bytes);
  if (!ext) return { error: "画像は PNG・JPEG・GIF・WebP にしてください" };
  return { ext, base64 };
}

function labelOf(kind, key, text) {
  if (kind === "schedule") return "予定";
  try {
    const data = kind === "members" ? JSON.parse(text) : parseMarkdown(text).data;
    return String((kind === "members" ? data.name : data.title) || key);
  } catch {
    return key;
  }
}

async function save(request, env, session, fetch) {
  if (!sameOrigin(request)) return json({ error: "このページからは保存できません" }, 403);
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "送られた内容を読めませんでした" }, 400);
  }
  const { kind, action = "save" } = input ?? {};
  const key = kind === "schedule" ? "schedule" : String(input.key ?? "");
  const isNew = action === "save" && Boolean(input.isNew) && kind !== "schedule";
  if (!KINDS.includes(kind) || !["save", "delete"].includes(action) || (kind === "schedule" && action === "delete")) {
    return json({ error: "保存できない内容です" }, 400);
  }
  const keyError = checkKey(kind, key, isNew);
  if (keyError) return json({ error: keyError }, 400);

  // ブランチを触る前に、形だけ先に確かめる
  const upload = kind === "works" && action === "save" ? readUpload(input.upload) : null;
  if (upload?.error) return json({ error: upload.error }, 400);
  if (action === "save") {
    const draft = upload ? { ...input.data, thumbnail: `/works/${key}.${upload.ext}` } : input.data;
    const checked = buildFile({ kind, key, data: draft, body: input.body }, null);
    if (checked.error) return json({ error: checked.error }, 400);
  }

  const repo = editorRepo(env, fetch);
  if (!repo) return json({ error: "サイトに GitHub App の設定がありません。運営に知らせてください。" }, 503);

  // ログインしたあとにサーバーを抜けた人は保存できない
  const found = await findGuildMember({ env, userId: session.id, fetch });
  if (!found) return json({ error: "FUNGC の Discord サーバーに参加している人だけが保存できます。" }, 403);

  const path = filePath(kind, key);
  const thumbnails = kind === "works" ? THUMBNAIL_EXTS.map((ext) => `public/works/${key}.${ext}`) : [];
  const base = input.oid ?? null;
  const who = `${session.name}(@${session.username}、Discord ID ${session.id})`;

  const result = await repo.save({
    discordId: session.id,
    paths: [path, ...thumbnails],
    message: `${who}が編集画面(${SITE}/admin/)から保存しました。`,
    pullTitle: `サイトの編集: ${session.name}`,
    pullBody: [
      `${who}が編集画面(${SITE}/admin/)から保存した変更です。`,
      "",
      "- マージすると fungc.org に反映されます。見た目は、Cloudflare Pages のコメントにあるプレビューの URL で確かめられます。",
      "- マージ前にもう一度保存された変更は、この PR に追加されます。",
    ].join("\n"),
    change(files) {
      const current = files[path];
      if (action === "delete") {
        if (!current) return { error: "もう削除されています。読み込み直してください。", status: 409 };
        if (current.oid !== base) throw new ConflictError();
        const own = kind === "works" ? ownThumbnailPath(key, parseMarkdown(current.text ?? "").data.thumbnail) : null;
        return {
          headline: `${KIND_LABEL[kind]}を削除: ${labelOf(kind, key, current.text)}`,
          additions: [],
          deletions: [path, ...(own && files[own] ? [own] : [])],
        };
      }
      if (isNew && current) return { error: "同じファイル名がもう使われています。ほかの名前にしてください。", status: 409 };
      if (!isNew && (current?.oid ?? null) !== base) throw new ConflictError();

      const additions = [];
      const deletions = [];
      let data = input.data;
      if (upload) {
        const image = `public/works/${key}.${upload.ext}`;
        data = { ...data, thumbnail: `/works/${key}.${upload.ext}` };
        additions.push({ path: image, contents: upload.base64 });
        // 拡張子が変わったら、前の画像を消す
        for (const old of thumbnails) if (old !== image && files[old]) deletions.push(old);
      }
      const built = buildFile({ kind, key, data, body: input.body }, current?.text ?? null);
      if (built.error) return { error: built.error, status: 400 };
      if (!upload && current?.text === built.content) return { unchanged: true };
      additions.push({ path, contents: utf8Base64(built.content) });
      const verb = kind === "schedule" ? "更新" : isNew ? "追加" : "更新";
      return { headline: `${KIND_LABEL[kind]}を${verb}: ${built.label}`, additions, deletions };
    },
  });

  if (result.error) return json({ error: result.error }, result.status ?? 400);
  return json({ pull: result.pull, unchanged: Boolean(result.unchanged), commit: result.commit?.oid ?? null });
}

export async function handleAdmin(request, env, { fetch = globalThis.fetch, now = () => Date.now() } = {}) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, "").replace(/\/+$/, "");
  try {
    if (request.method === "GET" && route === "login") return login(request, env);
    if (request.method === "GET" && route === "callback") return await callback(request, env, { fetch, now });

    const session = await currentSession(request, env, now);
    if (request.method === "POST" && route === "logout") {
      if (!sameOrigin(request)) return json({ error: "このページからはログアウトできません" }, 403);
      return json({ ok: true }, 200, { "Set-Cookie": setCookie(SESSION_COOKIE, "", 0) });
    }
    if (!["session", "content", "save"].includes(route)) return json({ error: "見つかりません" }, 404);
    if (!session) return json({ error: "ログインしてください", missing: missingSettings(env) }, 401);

    if (request.method === "GET" && route === "session") {
      const { id, username, name, avatar } = session;
      return json({ user: { id, username, name, avatar }, missing: missingSettings(env) });
    }
    if (request.method === "GET" && route === "content") return await content(env, session, fetch);
    if (request.method === "POST" && route === "save") return await save(request, env, session, fetch);
    return json({ error: "使えない操作です" }, 405);
  } catch (err) {
    if (err instanceof ConflictError) return json({ error: err.message, conflict: true }, 409);
    console.error(err);
    return json({ error: `うまくいきませんでした(${err.message})` }, 500);
  }
}
