import assert from "node:assert/strict";
import test from "node:test";
import { handleAdmin } from "./handler.mjs";
import { sealSession, SESSION_COOKIE, STATE_COOKIE } from "./session.mjs";

const ORIGIN = "https://fungc.org";
const NOW = Date.parse("2026-11-17T03:00:00Z");
const now = () => NOW;
const user = { id: "123456789012345678", username: "fugu", global_name: "ふぐ", avatar: "abc" };
const guildId = "999999999999999999";
const env = {
  DISCORD_CLIENT_ID: "111",
  DISCORD_CLIENT_SECRET: "client-secret",
  DISCORD_BOT_TOKEN: "bot-token",
  DISCORD_GUILD_ID: guildId,
  GITHUB_TOKEN: "gh-token",
};

const NEWS = "---\ntitle: 前からあるお知らせ\ndate: 2026-10-15\ntags: [お知らせ]\n---\n本文\n";
const WORK = "---\ntitle: 前からある作品\nauthors: [ふぐ]\nyear: 2026\nthumbnail: /works/2026-old.png\n---\n説明\n";
const MEMBER = `${JSON.stringify({ discordId: user.id, name: "ふぐ", roles: [], admissionYear: 2025, medals: [], public: true }, null, 2)}\n`;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");
const GIF = Buffer.from("GIF89a-image").toString("base64");

// Discord と GitHub の代わり。GitHub はブランチごとのファイルの状態(コミットごとのスナップショット)を覚えておく
function fakeServices({ guildMembers = [user.id] } = {}) {
  const hash = (text) => {
    let h = 0x811c9dc5;
    for (const c of new TextEncoder().encode(text)) h = Math.imul(h ^ c, 0x01000193) >>> 0;
    return h.toString(16).padStart(8, "0");
  };
  let seq = 0;
  const snapshots = new Map();
  const snapshot = (files) => {
    const oid = `commit${++seq}`;
    snapshots.set(oid, new Map(files));
    return oid;
  };
  const main = snapshot([
    ["content/news/2026-10-15-website.md", NEWS],
    ["content/works/2026-old.md", WORK],
    ["public/works/2026-old.png", "PNGDATA"],
    ["content/members/_example.json", "{}"],
    [`content/members/${user.id}.json`, MEMBER],
    ["content/schedule.json", "[]\n"],
  ]);
  const branches = new Map([["main", { oid: main, base: main }]]);
  const pulls = [];
  const commits = [];
  const calls = [];
  const filesOf = (branch) => snapshots.get(branches.get(branch).oid);

  const reply = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status });

  function resolve(expression) {
    const i = expression.indexOf(":");
    const branch = branches.get(i < 0 ? expression : expression.slice(0, i));
    if (!branch) return null;
    if (i < 0) return { oid: branch.oid };
    const path = expression.slice(i + 1);
    const files = snapshots.get(branch.oid);
    if (files.has(path)) return { oid: hash(files.get(path)), text: files.get(path) };
    const entries = [...files]
      .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/"))
      .map(([p, text]) => ({ name: p.slice(path.length + 1), oid: hash(text), object: { text } }));
    return entries.length ? { entries } : null;
  }

  function graphql({ query, variables }) {
    if (query.includes("createCommitOnBranch")) {
      const { input } = variables;
      const branch = branches.get(input.branch.branchName);
      if (branch.oid !== input.expectedHeadOid) {
        return { errors: [{ message: `Expected branch to point to "${input.expectedHeadOid}" but it did not. Pull and try again.` }] };
      }
      const files = new Map(snapshots.get(branch.oid));
      for (const { path } of input.fileChanges.deletions) {
        if (!files.has(path)) return { errors: [{ message: `A path was requested for deletion which does not exist: ${path}` }] };
        files.delete(path);
      }
      for (const { path, contents } of input.fileChanges.additions) {
        const bytes = Buffer.from(contents, "base64");
        files.set(path, path.startsWith("public/") ? `binary:${contents}` : bytes.toString("utf8"));
      }
      branch.oid = snapshot(files);
      commits.push({ branch: input.branch.branchName, headline: input.message.headline, body: input.message.body, ...input.fileChanges });
      return { data: { createCommitOnBranch: { commit: { oid: branch.oid, url: `https://github.com/fun-gc/hp/commit/${branch.oid}` } } } };
    }
    const repository = {};
    for (const [name, value] of Object.entries(variables)) {
      if (name === "rev") repository.head = resolve(value);
      else if (["news", "works", "members", "schedule"].includes(name)) repository[name] = resolve(value);
      else if (/^e\d+$/.test(name)) repository[`f${name.slice(1)}`] = resolve(value);
    }
    return { data: { repository } };
  }

  // main の変更を取り込む(3 方向のマージ。両方が同じファイルを変えていたらぶつかる)
  function merge(baseName) {
    const branch = branches.get(baseName);
    const mainOid = branches.get("main").oid;
    if (branch.base === mainOid) return reply(null, 204);
    const [o, b, m] = [branch.base, branch.oid, mainOid].map((oid) => snapshots.get(oid));
    const out = new Map();
    for (const path of new Set([...o.keys(), ...b.keys(), ...m.keys()])) {
      const [vo, vb, vm] = [o.get(path), b.get(path), m.get(path)];
      const v = vm === vo ? vb : vb === vo || vb === vm ? vm : Symbol.for("conflict");
      if (v === Symbol.for("conflict")) return reply({ message: "Merge conflict" }, 409);
      if (v !== undefined) out.set(path, v);
    }
    branch.oid = snapshot(out);
    branch.base = mainOid;
    return reply({ sha: branch.oid }, 201);
  }

  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const auth = init.headers?.Authorization;
    calls.push(`${method} ${url.hostname}${url.pathname}`);

    if (url.hostname === "discord.com") {
      if (url.pathname === "/api/v10/oauth2/token") {
        const body = new URLSearchParams(init.body);
        if (auth !== `Basic ${btoa("111:client-secret")}` || body.get("code") !== "good-code") return reply({ error: "invalid_grant" }, 400);
        assert.equal(body.get("redirect_uri"), `${ORIGIN}/api/admin/callback`);
        return reply({ access_token: "user-token", token_type: "Bearer" });
      }
      if (url.pathname === "/api/v10/users/@me") return auth === "Bearer user-token" ? reply(user) : reply({}, 401);
      const m = /^\/api\/v10\/guilds\/(\d+)\/members\/(\d+)$/.exec(url.pathname);
      if (m) {
        assert.equal(auth, "Bot bot-token");
        assert.equal(m[1], guildId);
        return guildMembers.includes(m[2]) ? reply({ user, nick: "ふぐ太郎", avatar: null, roles: [] }) : reply({ code: 10007 }, 404);
      }
      return reply({}, 404);
    }

    assert.equal(auth, "Bearer gh-token");
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.pathname === "/graphql") return reply(graphql(body));
    const route = url.pathname.replace("/repos/fun-gc/hp", "");
    if (method === "GET" && route === "/pulls") {
      const head = url.searchParams.get("head").replace("fun-gc:", "");
      return reply(pulls.filter((p) => p.state === "open" && p.head === head));
    }
    if (method === "POST" && route === "/pulls") {
      const pull = { number: pulls.length + 1, state: "open", head: body.head, base: body.base, title: body.title, body: body.body };
      pull.html_url = `https://github.com/fun-gc/hp/pull/${pull.number}`;
      pulls.push(pull);
      return reply(pull, 201);
    }
    if (method === "GET" && route === "/git/ref/heads/main") return reply({ object: { sha: branches.get("main").oid } });
    if (method === "POST" && route === "/git/refs") {
      const name = body.ref.replace("refs/heads/", "");
      if (branches.has(name)) return reply({ message: "Reference already exists" }, 422);
      branches.set(name, { oid: body.sha, base: body.sha });
      return reply({}, 201);
    }
    if (method === "PATCH" && route.startsWith("/git/refs/heads/")) {
      branches.set(route.replace("/git/refs/heads/", ""), { oid: body.sha, base: body.sha });
      return reply({});
    }
    if (method === "POST" && route === "/merges") return merge(body.base);
    return reply({ message: "Not Found" }, 404);
  };

  // main に直接コミットする(ほかの人の PR がマージされたときの代わり)
  const pushMain = (path, text) => {
    const files = new Map(snapshots.get(branches.get("main").oid));
    files.set(path, text);
    branches.get("main").oid = snapshot(files);
  };

  return { fetch, pulls, commits, calls, branches, filesOf, pushMain, hash };
}

async function sessionCookie(extra = {}) {
  const token = await sealSession({ id: user.id, username: "fugu", name: "ふぐ太郎", avatar: "https://cdn/a.png", exp: NOW / 1000 + 3600, ...extra }, env.DISCORD_CLIENT_SECRET);
  return `${SESSION_COOKIE}=${token}`;
}

async function call(services, method, route, { body, cookie, origin = ORIGIN, envOverride = {} } = {}) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  if (origin) headers.set("Origin", origin);
  if (body) headers.set("Content-Type", "application/json");
  const request = new Request(`${ORIGIN}/api/admin/${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const res = await handleAdmin(request, { ...env, ...envOverride }, { fetch: services.fetch, now });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
}

test("ログイン: Discord の画面へ送り、戻ってきた人がサーバーのメンバーならクッキーを付ける", async () => {
  const services = fakeServices();
  const start = await call(services, "GET", "login");
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get("Location"));
  assert.equal(location.origin + location.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(location.searchParams.get("client_id"), "111");
  assert.equal(location.searchParams.get("scope"), "identify");
  assert.equal(location.searchParams.get("redirect_uri"), `${ORIGIN}/api/admin/callback`);
  const state = location.searchParams.get("state");
  assert.match(start.headers.getSetCookie()[0], new RegExp(`^${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`));

  const back = await call(services, "GET", `callback?code=good-code&state=${state}`, { cookie: `${STATE_COOKIE}=${state}` });
  assert.equal(back.status, 302);
  assert.equal(back.headers.get("Location"), `${ORIGIN}/admin/`);
  const cookies = back.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith(`${STATE_COOKIE}=;`) && c.includes("Max-Age=0")));
  const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`)).split(";")[0];

  const me = await call(services, "GET", "session", { cookie: session });
  assert.equal(me.status, 200);
  assert.deepEqual(me.data.user, {
    id: user.id,
    username: "fugu",
    name: "ふぐ太郎",
    avatar: `https://cdn.discordapp.com/avatars/${user.id}/abc.png?size=256`,
  });
  assert.deepEqual(me.data.missing, []);
});

test("ログイン: state が合わない・キャンセル・サーバーにいない・設定がないときは /admin/ にわけを付けて戻す", async () => {
  const services = fakeServices({ guildMembers: [] });
  const where = (res) => res.headers.get("Location");
  assert.equal(where(await call(services, "GET", "callback?code=good-code&state=a", { cookie: `${STATE_COOKIE}=b` })), `${ORIGIN}/admin/?error=state`);
  assert.equal(where(await call(services, "GET", "callback?code=good-code&state=a")), `${ORIGIN}/admin/?error=state`);
  assert.equal(where(await call(services, "GET", "callback?error=access_denied&state=a", { cookie: `${STATE_COOKIE}=a` })), `${ORIGIN}/admin/?error=denied`);
  assert.equal(where(await call(services, "GET", "callback?code=good-code&state=a", { cookie: `${STATE_COOKIE}=a` })), `${ORIGIN}/admin/?error=not-member`);
  assert.equal(where(await call(services, "GET", "callback?code=bad-code&state=a", { cookie: `${STATE_COOKIE}=a` })), `${ORIGIN}/admin/?error=failed`);
  assert.equal(where(await call(services, "GET", "login", { envOverride: { DISCORD_CLIENT_SECRET: "" } })), `${ORIGIN}/admin/?error=setup`);
});

test("ログインしていない・クッキーを書き換えた・期限が切れたときは 401", async () => {
  const services = fakeServices();
  assert.equal((await call(services, "GET", "session")).status, 401);
  assert.equal((await call(services, "GET", "content")).status, 401);
  assert.equal((await call(services, "GET", "session", { cookie: `${SESSION_COOKIE}=abc.def` })).status, 401);
  assert.equal((await call(services, "GET", "session", { cookie: await sessionCookie({ exp: NOW / 1000 - 1 }) })).status, 401);
  assert.equal((await call(services, "POST", "save", { body: { kind: "news" } })).status, 401);
  assert.deepEqual(services.calls, []);
});

test("ログアウトするとクッキーを消す", async () => {
  const services = fakeServices();
  const res = await call(services, "POST", "logout", { cookie: await sessionCookie() });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Set-Cookie"), new RegExp(`^${SESSION_COOKIE}=; .*Max-Age=0`));
  assert.equal((await call(services, "POST", "logout", { origin: "https://evil.example" })).status, 403);
});

test("読み込み: PR がなければ main、あれば本人のブランチの内容を返す", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const first = await call(services, "GET", "content", { cookie });
  assert.equal(first.status, 200);
  assert.equal(first.data.ref, "main");
  assert.equal(first.data.pull, null);
  assert.deepEqual(
    first.data.news.map((n) => [n.key, n.data.title, n.data.date, n.data.tags, n.body]),
    [["2026-10-15-website", "前からあるお知らせ", "2026-10-15", ["お知らせ"], "本文"]],
  );
  assert.deepEqual(
    first.data.members.map((m) => m.key),
    [user.id],
  );
  assert.deepEqual(first.data.schedule, { oid: services.hash("[]\n"), items: [] });

  const news = first.data.news[0];
  await call(services, "POST", "save", { cookie, body: { kind: "news", key: news.key, oid: news.oid, data: { ...news.data, title: "直したお知らせ" }, body: news.body } });
  const second = await call(services, "GET", "content", { cookie });
  assert.equal(second.data.ref, `edit/${user.id}`);
  assert.deepEqual(second.data.pull, { number: 1, url: "https://github.com/fun-gc/hp/pull/1" });
  assert.equal(second.data.news[0].data.title, "直したお知らせ");
});

test("保存: 編集した人のブランチにコミットして PR を作り、2 回目からは同じ PR に積む", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const created = await call(services, "POST", "save", {
    cookie,
    body: { kind: "news", key: "2026-11-17-miraive", isNew: true, data: { title: "Miraive で展示します", date: "2026-11-17", tags: ["イベント"] }, body: "本文" },
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  assert.deepEqual(created.data.pull, { number: 1, url: "https://github.com/fun-gc/hp/pull/1" });
  const branch = `edit/${user.id}`;
  assert.equal(services.filesOf(branch).get("content/news/2026-11-17-miraive.md"), "---\ntitle: Miraive で展示します\ndate: 2026-11-17\ntags: [イベント]\n---\n本文\n");
  assert.equal(services.commits[0].headline, "お知らせを追加: Miraive で展示します");
  assert.match(services.commits[0].body, /ふぐ太郎\(@fugu、Discord ID 123456789012345678\)が編集画面/);
  assert.equal(services.pulls[0].title, "サイトの編集: ふぐ太郎");
  assert.equal(services.pulls[0].head, branch);
  assert.equal(services.pulls[0].base, "main");
  // main はまだ変わらない(運営がマージするまで公開されない)
  assert.equal(services.filesOf("main").has("content/news/2026-11-17-miraive.md"), false);

  // ほかの人の PR が main に入ったあとに保存すると、先に main を取り込んでから積む
  services.pushMain("content/news/2026-10-20-other.md", "---\ntitle: ほかの人\ndate: 2026-10-20\n---\n");
  const { data } = await call(services, "GET", "content", { cookie });
  const mine = data.news.find((n) => n.key === "2026-11-17-miraive");
  const updated = await call(services, "POST", "save", { cookie, body: { kind: "news", key: mine.key, oid: mine.oid, data: { ...mine.data, tags: [] }, body: "本文を直した" } });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal(services.pulls.length, 1);
  assert.equal(services.commits.at(-1).headline, "お知らせを更新: Miraive で展示します");
  assert.ok(services.filesOf(branch).has("content/news/2026-10-20-other.md"));
  assert.equal(services.filesOf(branch).get("content/news/2026-11-17-miraive.md"), "---\ntitle: Miraive で展示します\ndate: 2026-11-17\n---\n本文を直した\n");

  // 何も変えずに保存したときはコミットしない
  const again = await call(services, "GET", "content", { cookie });
  const same = again.data.news.find((n) => n.key === "2026-11-17-miraive");
  const unchanged = await call(services, "POST", "save", { cookie, body: { kind: "news", key: same.key, oid: same.oid, data: same.data, body: same.body } });
  assert.equal(unchanged.data.unchanged, true);
  assert.equal(services.commits.length, 2);
});

test("保存: PR がないときに何も変えずに保存しても、ブランチも PR も作らない", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const { data } = await call(services, "GET", "content", { cookie });
  const news = data.news[0];
  const res = await call(services, "POST", "save", { cookie, body: { kind: "news", key: news.key, oid: news.oid, data: news.data, body: news.body } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.unchanged, true);
  assert.equal(services.branches.has(`edit/${user.id}`), false);
  assert.equal(services.pulls.length, 0);
  assert.equal(services.commits.length, 0);
});

test("保存: ほかの人が先に変えていたら 409 で止め、上書きしない", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const { data } = await call(services, "GET", "content", { cookie });
  const news = data.news[0];
  services.pushMain("content/news/2026-10-15-website.md", NEWS.replace("本文", "ほかの人が直した本文"));
  const res = await call(services, "POST", "save", { cookie, body: { kind: "news", key: news.key, oid: news.oid, data: news.data, body: "上書き" } });
  assert.equal(res.status, 409);
  assert.equal(res.data.conflict, true);
  assert.match(res.data.error, /読み込み直して/);
  assert.equal(services.commits.length, 0);

  const exists = await call(services, "POST", "save", {
    cookie,
    body: { kind: "news", key: "2026-10-15-website", isNew: true, data: { title: "同じ名前", date: "2026-10-15" }, body: "" },
  });
  assert.equal(exists.status, 409);
  assert.match(exists.data.error, /同じファイル名/);
});

test("保存: 入力のまちがい・ほかのサイトから・サーバーを抜けた人ははじく", async () => {
  const cookie = await sessionCookie();
  const services = fakeServices();
  const bad = await call(services, "POST", "save", { cookie, body: { kind: "news", key: "2026-11-17-x", isNew: true, data: { title: "", date: "2026-11-17" }, body: "" } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /タイトルを入れてください/);
  const badKey = await call(services, "POST", "save", { cookie, body: { kind: "news", key: "x", isNew: true, data: { title: "a", date: "2026-11-17" } } });
  assert.match(badKey.data.error, /ファイル名/);
  assert.deepEqual(services.calls, []);

  const cross = await call(services, "POST", "save", { cookie, origin: "https://evil.example", body: { kind: "schedule", data: [] } });
  assert.equal(cross.status, 403);

  const left = fakeServices({ guildMembers: [] });
  const res = await call(left, "POST", "save", { cookie, body: { kind: "schedule", oid: left.hash("[]\n"), data: [{ date: "2026-11-20", title: "講座" }] } });
  assert.equal(res.status, 403);
  assert.match(res.data.error, /Discord サーバー/);
  assert.equal(left.commits.length, 0);
});

test("作品: サムネイル画像を同じコミットで置き、拡張子が変わったら前の画像を消す", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const { data } = await call(services, "GET", "content", { cookie });
  const work = data.works.find((w) => w.key === "2026-old");
  assert.equal(work.data.thumbnail, "/works/2026-old.png");

  const res = await call(services, "POST", "save", { cookie, body: { kind: "works", key: work.key, oid: work.oid, data: work.data, body: work.body, upload: { base64: `data:image/gif;base64,${GIF}` } } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const files = services.filesOf(`edit/${user.id}`);
  assert.equal(files.get("public/works/2026-old.gif"), `binary:${GIF}`);
  assert.equal(files.has("public/works/2026-old.png"), false);
  assert.match(files.get("content/works/2026-old.md"), /^thumbnail: \/works\/2026-old\.gif$/m);
  assert.deepEqual(services.commits[0].deletions, [{ path: "public/works/2026-old.png" }]);

  const notImage = await call(services, "POST", "save", { cookie, body: { kind: "works", key: work.key, oid: work.oid, data: work.data, upload: { base64: Buffer.from("<svg/>").toString("base64") } } });
  assert.equal(notImage.status, 400);
  assert.match(notImage.data.error, /PNG/);

  const created = await call(services, "POST", "save", {
    cookie,
    body: { kind: "works", key: "2026-new-game", isNew: true, data: { title: "新しい作品", authors: ["ふぐ"], year: 2026 }, body: "", upload: { base64: PNG } },
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  assert.match(services.filesOf(`edit/${user.id}`).get("content/works/2026-new-game.md"), /^thumbnail: \/works\/2026-new-game\.png$/m);
});

test("削除: ファイルを消すコミットを積む。作品は自分の名前のサムネイルも消す", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const { data } = await call(services, "GET", "content", { cookie });
  const work = data.works[0];
  const res = await call(services, "POST", "save", { cookie, body: { kind: "works", action: "delete", key: work.key, oid: work.oid } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(services.commits[0].headline, "作品を削除: 前からある作品");
  const files = services.filesOf(`edit/${user.id}`);
  assert.equal(files.has("content/works/2026-old.md"), false);
  assert.equal(files.has("public/works/2026-old.png"), false);

  const member = data.members[0];
  const stale = await call(services, "POST", "save", { cookie, body: { kind: "members", action: "delete", key: member.key, oid: "old-oid" } });
  assert.equal(stale.status, 409);
});

test("予定: 一覧をまるごと保存する", async () => {
  const services = fakeServices();
  const cookie = await sessionCookie();
  const { data } = await call(services, "GET", "content", { cookie });
  const res = await call(services, "POST", "save", {
    cookie,
    body: {
      kind: "schedule",
      oid: data.schedule.oid,
      data: [
        { date: "2026-12-01", title: "後の予定", kind: "event" },
        { date: "2026-11-20", start: "18:00", title: "Unity 講座", kind: "course", place: "" },
      ],
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(services.commits[0].headline, "予定を更新: 2026-11-20 Unity 講座、2026-12-01 後の予定");
  const saved = JSON.parse(services.filesOf(`edit/${user.id}`).get("content/schedule.json"));
  assert.deepEqual(
    saved.map((e) => e.title),
    ["Unity 講座", "後の予定"],
  );
  const bad = await call(services, "POST", "save", { cookie, body: { kind: "schedule", oid: data.schedule.oid, data: [{ date: "2026-11-31", title: "x" }] } });
  assert.match(bad.data.error, /1 件目の日付/);
});

test("設定が足りないときは、ログインした人に足りない名前を返す", async () => {
  const services = fakeServices();
  const res = await call(services, "GET", "session", { cookie: await sessionCookie(), envOverride: { GITHUB_TOKEN: "", DISCORD_BOT_TOKEN: "" } });
  assert.deepEqual(res.data.missing, ["DISCORD_BOT_TOKEN", "GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY"]);
  const content = await call(services, "GET", "content", { cookie: await sessionCookie(), envOverride: { GITHUB_TOKEN: "" } });
  assert.equal(content.status, 503);
});
