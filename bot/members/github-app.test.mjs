import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { appJwt, importPrivateKey, installationToken } from "./github-app.mjs";

// GitHub がダウンロードさせる鍵と同じ PKCS#1 の PEM
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs1 = privateKey.export({ type: "pkcs1", format: "pem" });
const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" });
const verifyKey = await crypto.subtle.importKey(
  "spki",
  publicKey.export({ type: "spki", format: "der" }),
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  false,
  ["verify"],
);

const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString());

async function verifyJwt(jwt) {
  const [header, payload, signature] = jwt.split(".");
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    verifyKey,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return ok ? { header: decode(header), payload: decode(payload) } : null;
}

test("PKCS#1 と PKCS#8 のどちらの鍵でも JWT に署名できる", async () => {
  const now = Date.parse("2026-10-19T03:00:00Z");
  for (const pem of [pkcs1, pkcs8, pkcs1.replace(/\n/g, "\\n"), pkcs1.replace(/\n/g, " ")]) {
    const jwt = await verifyJwt(await appJwt("42", await importPrivateKey(pem), now));
    assert.deepEqual(jwt.header, { alg: "RS256", typ: "JWT" });
    assert.deepEqual(jwt.payload, { iat: now / 1000 - 60, exp: now / 1000 + 480, iss: "42" });
  }
});

test("インストールトークンを受け取り、期限まで使い回す", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(`${init.method} ${new URL(url).pathname}`);
    assert.ok(await verifyJwt(init.headers.Authorization.replace("Bearer ", "")));
    if (url.endsWith("/installation")) return new Response(JSON.stringify({ id: 7 }));
    assert.deepEqual(JSON.parse(init.body), { repositories: ["hp"] });
    return new Response(JSON.stringify({ token: "ghs_1", expires_at: "2026-10-19T04:00:00Z" }), { status: 201 });
  };
  let now = Date.parse("2026-10-19T03:00:00Z");
  const get = () => installationToken({ appId: "42", privateKey: pkcs1, repo: "fun-gc/hp", fetch, now: () => now });
  assert.equal(await get(), "ghs_1");
  assert.equal(await get(), "ghs_1");
  assert.deepEqual(calls, ["GET /repos/fun-gc/hp/installation", "POST /app/installations/7/access_tokens"]);
  // 期限が近づいたら作り直す
  now = Date.parse("2026-10-19T03:56:00Z");
  await get();
  assert.equal(calls.length, 4);
});

test("App がリポジトリに入っていなければ分かるように伝える", async () => {
  const fetch = async () => new Response("{}", { status: 404 });
  await assert.rejects(
    installationToken({ appId: "43", privateKey: pkcs8, repo: "fun-gc/hp", fetch }),
    /インストールされていません/,
  );
});
