// Discord のスラッシュコマンド /profile の受け口。Discord は Interactions Endpoint URL(https://fungc.org/api/discord)に
// HTTP でリクエストを送ってくるので、Cloudflare Pages Functions(functions/api/discord.js)からこの関数を呼ぶ。
//
//   DISCORD_PUBLIC_KEY      Developer Portal の General Information にある Public Key。リクエストの署名を確かめる
//   GITHUB_APP_ID           fun-gc/hp に入れた GitHub App の App ID
//   GITHUB_APP_PRIVATE_KEY  その App の秘密鍵(github-app.mjs)
//   GITHUB_TOKEN            App の代わりに使う個人のトークン(App を設定するまでの移行用。App があればそちらを使う)
//   GITHUB_REPO             書き込むリポジトリ(省略すると fun-gc/hp)

import { createGitHub } from "./github.mjs";
import { installationToken } from "./github-app.mjs";
import { applyInput, avatarUrl, describe, displayName, EDIT_MODAL, editModal, LINKS_MODAL, linksModal, memberJson, modalValues } from "./profile.mjs";

const DISCORD_API = "https://discord.com/api/v10";
const SITE_MEMBERS = "https://fungc.org/members/";
const DELETE_BUTTON = "profile:delete";
// 3 秒以内に返事をしないと Discord がエラーにするので、フォームに今の内容を入れるための読み込みは早めに諦める
const PREFILL_TIMEOUT_MS = 2000;

// https://discord.com/developers/docs/interactions/receiving-and-responding
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const MODAL_SUBMIT = 5;
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;
const UPDATE_MESSAGE = 7;
const MODAL = 9;
const EPHEMERAL = 64;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// 本人にだけ見える返信。メンションで誰かに通知が飛ばないようにする
const privateMessage = (content, extra = {}) => ({ content, flags: EPHEMERAL, allowed_mentions: { parse: [] }, ...extra });

const fromHex = (hex) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));

export async function verifySignature(publicKey, signature, timestamp, body) {
  if (!publicKey || !signature || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey("raw", fromHex(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromHex(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

export async function handleInteraction(request, env, { waitUntil, fetch = globalThis.fetch, now = () => new Date() }) {
  const body = await request.text();
  if (!env.DISCORD_PUBLIC_KEY) return new Response("DISCORD_PUBLIC_KEY が設定されていません", { status: 500 });
  const signed = await verifySignature(
    env.DISCORD_PUBLIC_KEY,
    request.headers.get("X-Signature-Ed25519"),
    request.headers.get("X-Signature-Timestamp"),
    body,
  );
  if (!signed) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(body);
  if (interaction.type === PING) return json({ type: PONG });

  const reply = (content, extra) => json({ type: CHANNEL_MESSAGE, data: privateMessage(content, extra) });
  const guildId = interaction.guild_id;
  if (!guildId) return reply("このコマンドは FUNGC のサーバーの中で使ってね。");
  const repo = env.GITHUB_REPO || "fun-gc/hp";
  const useApp = Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
  if (!useApp && !env.GITHUB_TOKEN) {
    return reply("ごめんね、まだ準備中なんだ(サイト側に GitHub App の設定がないみたい)。運営に教えてあげてね。");
  }

  const member = interaction.member;
  const user = member?.user ?? interaction.user;
  const token = useApp
    ? () => installationToken({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY, repo, fetch })
    : () => env.GITHUB_TOKEN;
  const gh = createGitHub({ token, repo, fetch });

  // 時間のかかる処理は「考え中」と返してから後で書き換える(Discord は 15 分まで待ってくれる)
  const later = (task) => {
    const url = `${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
    const edit = (content) =>
      fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 2000), components: [], allowed_mentions: { parse: [] } }),
      });
    waitUntil(
      task()
        .then(edit)
        .catch((err) => {
          console.error(err);
          return edit(`ごめんね、うまくいかなかったみたい…。少し時間をおいてもう一度試すか、運営に知らせてね。\n(${err.message})`);
        }),
    );
  };
  const pr = (pull) => (pull?.html_url ? `\n運営さんの確認用はこちらだよ: <${pull.html_url}>` : "");
  const who = `**${displayName(member, user)}**(@${user.username}、ID ${user.id})`;

  if (interaction.type === APPLICATION_COMMAND && interaction.data.name === "profile") {
    const sub = interaction.data.options?.[0]?.name;

    if (sub === "edit" || sub === "links") {
      const loaded = await withTimeout(gh.loadMember(user.id), PREFILL_TIMEOUT_MS).catch((err) => {
        console.error(err);
        return null;
      });
      if (sub === "links" && loaded && !loaded.member) return reply("先に `/profile edit` でプロフィールを登録してね。");
      const existing = loaded?.member;
      const modal = sub === "edit" ? editModal({ existing, name: displayName(member, user), now: now() }) : linksModal({ existing });
      return json({ type: MODAL, data: modal });
    }

    if (sub === "show") {
      later(async () => {
        const { member: saved, pull } = await gh.loadMember(user.id);
        if (!saved) return pull ? `掲載の取り下げを、いま運営さんが確認しているよ。${pr(pull)}` : "まだ登録されていないみたい。`/profile edit` から登録できるよ。";
        const state = pull ? `これは運営さんの確認待ちの内容だよ。確認が済んだら ${SITE_MEMBERS} に載るからね。${pr(pull)}` : `${SITE_MEMBERS} にちゃんと載っているよ。`;
        return `${describe(saved, now())}\n\n${state}`;
      });
      return json({ type: DEFERRED_CHANNEL_MESSAGE, data: { flags: EPHEMERAL } });
    }

    if (sub === "delete") {
      return reply("サイトのメンバー欄から外して、登録した内容を消すよ。運営さんが確認してから消えるからね。ほんとうにいい?", {
        components: [{ type: 1, components: [{ type: 2, style: 4, label: "掲載をやめる", custom_id: DELETE_BUTTON }] }],
      });
    }
  }

  if (interaction.type === MESSAGE_COMPONENT && interaction.data.custom_id === DELETE_BUTTON) {
    later(async () => {
      const result = await gh.deleteMember(user.id, {
        title: `メンバーの掲載をやめる: ${displayName(member, user)}`,
        body: `Discord の \`/profile delete\` から ${who} が掲載の取り下げを希望しました。\n\nマージすると ${SITE_MEMBERS} から消えます。`,
      });
      if (result.status === "missing") return "まだ登録されていないから、消すものはないよ。";
      if (result.status === "withdrawn") return "確認待ちだった登録を取り下げたよ。サイトには載らないから安心してね。";
      return `取り下げを受け付けたよ。運営さんが確認したら、サイトから消えるからね。${pr(result.pull)}`;
    });
    return json({ type: UPDATE_MESSAGE, data: { content: "ちょっと待っててね…", components: [] } });
  }

  if (interaction.type === MODAL_SUBMIT && [EDIT_MODAL, LINKS_MODAL].includes(interaction.data.custom_id)) {
    const kind = interaction.data.custom_id;
    const values = modalValues(interaction.data);
    const avatar = avatarUrl(member, user, guildId);
    later(async () => {
      const result = await gh.saveMember(
        user.id,
        (existing) => {
          const applied = applyInput(existing, { kind, values, discordId: user.id, avatar });
          return applied.error ? applied : { ...applied, content: memberJson(applied.member) };
        },
        {
          title: `メンバー登録: ${displayName(member, user)}`,
          body: `Discord の \`/profile\` から ${who} が送ったプロフィールです。\n\nマージすると ${SITE_MEMBERS} に反映されます。マージ前にもう一度送られた内容は、この PR に追加されます。`,
        },
      );
      if (result.error) return `${result.error}\nもう一度コマンドからやり直してね。`;
      return [
        `受け付けたよ。運営さんが確認したら ${SITE_MEMBERS} に載るからね。`,
        "",
        describe(result.member, now()),
        pr(result.pull),
      ].join("\n");
    });
    return json({ type: DEFERRED_CHANNEL_MESSAGE, data: { flags: EPHEMERAL } });
  }

  return reply("ごめんね、このコマンドにはまだ対応していないんだ。");
}
