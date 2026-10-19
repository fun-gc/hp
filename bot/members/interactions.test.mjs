import assert from "node:assert/strict";
import test from "node:test";
import { memberSchema } from "../../src/lib/schema.ts";
import { handleInteraction, verifySignature } from "./interactions.mjs";

const now = () => new Date("2026-10-19T03:00:00Z");
const user = { id: "123456789012345678", username: "fugu", global_name: "ふぐ", avatar: "abc" };
const guildId = "999999999999999999";

const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", keys.publicKey)).toString("hex");

async function signedRequest(payload) {
  const body = JSON.stringify(payload);
  const timestamp = "1760000000";
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, keys.privateKey, new TextEncoder().encode(timestamp + body));
  return new Request("https://fungc.org/api/discord", {
    method: "POST",
    headers: { "X-Signature-Ed25519": Buffer.from(signature).toString("hex"), "X-Signature-Timestamp": timestamp },
    body,
  });
}

// GitHub と Discord の代わり。ブランチごとのファイルと PR、Discord に返した文を覚えておく
function fakeServices() {
  const branches = new Map([["main", new Map()]]);
  const pulls = [];
  const replies = [];
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.hostname === "discord.com") {
      replies.push(body.content);
      return json({});
    }
    const route = url.pathname.replace("/repos/fun-gc/hp", "");
    let m;
    if (method === "GET" && route === "/pulls") {
      const head = url.searchParams.get("head").replace("fun-gc:", "");
      return json(pulls.filter((p) => p.state === "open" && p.head === head));
    }
    if (method === "POST" && route === "/pulls") {
      const pull = { number: pulls.length + 1, state: "open", head: body.head, title: body.title, html_url: `https://github.com/fun-gc/hp/pull/${pulls.length + 1}` };
      pulls.push(pull);
      return json(pull, 201);
    }
    if (method === "PATCH" && (m = route.match(/^\/pulls\/(\d+)$/))) {
      Object.assign(pulls[m[1] - 1], body);
      return json(pulls[m[1] - 1]);
    }
    if (method === "GET" && route === "/git/ref/heads/main") return json({ object: { sha: "main" } });
    if (method === "POST" && route === "/git/refs") {
      const name = body.ref.replace("refs/heads/", "");
      if (branches.has(name)) return json({ message: "Reference already exists" }, 422);
      branches.set(name, new Map(branches.get("main")));
      return json({}, 201);
    }
    if (method === "PATCH" && (m = route.match(/^\/git\/refs\/heads\/(.+)$/))) {
      branches.set(m[1], new Map(branches.get("main")));
      return json({});
    }
    if ((m = route.match(/^\/contents\/(.+)$/))) {
      const files = branches.get(method === "GET" ? url.searchParams.get("ref") : body.branch);
      const path = m[1];
      if (method === "GET") {
        if (!files?.has(path)) return json({ message: "Not Found" }, 404);
        return json({ sha: `sha-${files.get(path).length}`, content: Buffer.from(files.get(path)).toString("base64") });
      }
      if (files.has(path) !== Boolean(body.sha)) return json({ message: "sha mismatch" }, 422);
      if (method === "PUT") files.set(path, Buffer.from(body.content, "base64").toString());
      if (method === "DELETE") files.delete(path);
      return json({});
    }
    throw new Error(`想定外のリクエスト ${method} ${url}`);
  };
  return { fetch, branches, pulls, replies };
}

async function send(services, payload) {
  const tasks = [];
  const res = await handleInteraction(
    await signedRequest({ application_id: "1", token: "t", guild_id: guildId, member: { user }, ...payload }),
    { DISCORD_PUBLIC_KEY: publicKey, GITHUB_TOKEN: "gh" },
    { waitUntil: (p) => tasks.push(p), fetch: services.fetch, now },
  );
  await Promise.all(tasks);
  return res.status === 200 ? res.json() : res;
}

const command = (sub) => ({ type: 2, data: { name: "profile", options: [{ type: 1, name: sub }] } });
const editSubmit = (name) => ({
  type: 5,
  data: {
    custom_id: "profile:edit",
    components: [
      { type: 18, component: { type: 4, custom_id: "name", value: name } },
      { type: 18, component: { type: 3, custom_id: "admissionYear", values: ["2025"] } },
      { type: 18, component: { type: 3, custom_id: "roles", values: ["programmer"] } },
      { type: 18, component: { type: 4, custom_id: "bio", value: "" } },
      { type: 18, component: { type: 4, custom_id: "favoriteGames", value: "Celeste" } },
    ],
  },
});
const path = `content/members/${user.id}.json`;

test("署名が正しくないリクエストは断る", async () => {
  const req = await signedRequest({ type: 1 });
  assert.equal(await verifySignature(publicKey, req.headers.get("X-Signature-Ed25519"), "1760000000", await req.text()), true);
  assert.equal(await verifySignature(publicKey, "00".repeat(64), "1760000000", "{}"), false);
  const res = await handleInteraction(
    new Request("https://fungc.org/api/discord", { method: "POST", body: "{}", headers: { "X-Signature-Ed25519": "00", "X-Signature-Timestamp": "1" } }),
    { DISCORD_PUBLIC_KEY: publicKey },
    { waitUntil() {} },
  );
  assert.equal(res.status, 401);
});

test("Discord からの疎通確認(PING)に答える", async () => {
  assert.deepEqual(await send(fakeServices(), { type: 1 }), { type: 1 });
});

test("登録から編集、取り下げまで", async () => {
  const services = fakeServices();

  // 未登録ならリンクより先に登録を促す
  assert.match((await send(services, command("links"))).data.content, /先に/);

  const modal = await send(services, command("edit"));
  assert.equal(modal.type, 9);
  assert.equal(modal.data.components[0].component.value, "ふぐ");

  // 送信すると PR ができ、本人には結果が返る
  assert.equal((await send(services, editSubmit("ふぐ太郎"))).type, 5);
  assert.equal(services.pulls.length, 1);
  assert.match(services.replies.at(-1), /受け付けました[\s\S]*ふぐ太郎[\s\S]*pull\/1/);
  const saved = JSON.parse(services.branches.get(`member/${user.id}`).get(path));
  assert.ok(memberSchema.safeParse(saved).success);
  assert.equal(saved.public, true);

  // マージ前にもう一度送ると同じ PR に積み、フォームには確認待ちの内容が入る
  assert.equal((await send(services, command("edit"))).data.components[0].component.value, "ふぐ太郎");
  await send(services, editSubmit("ふぐ次郎"));
  assert.equal(services.pulls.length, 1);
  await send(services, command("show"));
  assert.match(services.replies.at(-1), /ふぐ次郎[\s\S]*確認待ち/);

  // まだ載っていないうちに取り下げると PR を閉じる
  assert.match((await send(services, command("delete"))).data.content, /よろしいですか/);
  assert.equal((await send(services, { type: 3, data: { custom_id: "profile:delete" } })).type, 7);
  assert.match(services.replies.at(-1), /取り下げました/);
  assert.equal(services.pulls[0].state, "closed");
});

test("載っている人の編集はメダルを残し、取り下げはファイルを消す PR にする", async () => {
  const services = fakeServices();
  const published = { discordId: user.id, name: "ふぐ", roles: [], admissionYear: 2024, medals: ["first-game"], public: true };
  services.branches.get("main").set(path, JSON.stringify(published));
  // 前の PR のブランチが残っていても main から作り直す
  services.branches.set(`member/${user.id}`, new Map());

  await send(services, editSubmit("ふぐ"));
  const saved = JSON.parse(services.branches.get(`member/${user.id}`).get(path));
  assert.deepEqual(saved.medals, ["first-game"]);
  assert.equal(saved.admissionYear, 2025);

  await send(services, { type: 3, data: { custom_id: "profile:delete" } });
  assert.equal(services.branches.get(`member/${user.id}`).has(path), false);
  assert.equal(services.pulls.length, 1);
  assert.match(services.pulls[0].title, /掲載をやめる/);
  assert.match(services.replies.at(-1), /受け付けました/);
});

test("入力に問題があれば PR を作らずに伝える", async () => {
  const services = fakeServices();
  await send(services, editSubmit(""));
  assert.equal(services.pulls.length, 0);
  assert.match(services.replies.at(-1), /入力を確かめてください/);
});
