import assert from "node:assert/strict";
import test from "node:test";
import { openSession, parseCookies, sameText, sealSession, setCookie } from "./session.mjs";

const secret = "client-secret-for-test";
const now = Date.parse("2026-11-17T00:00:00Z");
const exp = Math.floor(now / 1000) + 60;

test("署名したクッキーは同じ秘密の値で開ける", async () => {
  const token = await sealSession({ id: "123", name: "ふぐ", exp }, secret);
  assert.deepEqual(await openSession(token, secret, now), { id: "123", name: "ふぐ", exp });
});

test("書き換えたクッキー・違う秘密の値・期限切れは開けない", async () => {
  const token = await sealSession({ id: "123", exp }, secret);
  const [body, signature] = token.split(".");
  const forged = `${Buffer.from(JSON.stringify({ id: "999", exp })).toString("base64url")}.${signature}`;
  assert.equal(await openSession(forged, secret, now), null);
  assert.equal(await openSession(`${body}.${signature}x`, secret, now), null);
  assert.equal(await openSession(token, "another-secret", now), null);
  assert.equal(await openSession(token, secret, (exp + 1) * 1000), null);
  assert.equal(await openSession("", secret, now), null);
  assert.equal(await openSession(token, "", now), null);
});

test("クッキーの読み書き", () => {
  assert.deepEqual(parseCookies("a=1; __Host-x=abc.def; b"), { a: "1", "__Host-x": "abc.def" });
  assert.equal(setCookie("__Host-x", "v", 60), "__Host-x=v; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60");
});

test("文字の比較", () => {
  assert.equal(sameText("abc", "abc"), true);
  assert.equal(sameText("abc", "abd"), false);
  assert.equal(sameText("abc", "abcd"), false);
  assert.equal(sameText(undefined, ""), true);
});
