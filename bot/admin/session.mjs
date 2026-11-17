// 編集画面(/admin)のログイン状態を、署名付きのクッキーで持つ。サーバー側には何も保存しない。
// 署名の鍵は DISCORD_CLIENT_SECRET から HKDF で作るので、別の秘密の値を設定しなくてよい。
// シークレットを作り直すと、それまでのクッキーは使えなくなる(全員がログアウトされる)。
// Cloudflare(Pages Functions)と Node のどちらでも動くよう、Web Crypto だけを使う。

const enc = new TextEncoder();
const dec = new TextDecoder();

// __Host- を付けると、Secure・Path=/・Domain なしでないとブラウザが受け取らない。サブドメインから上書きされない
export const SESSION_COOKIE = "__Host-fungc-admin";
// Discord から戻ってきたときに、ログインを始めたのが同じブラウザかを確かめる値
export const STATE_COOKIE = "__Host-fungc-oauth";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const STATE_SECONDS = 10 * 60;

export function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export const randomToken = (bytes = 24) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

const keys = new Map();
function sessionKey(secret) {
  if (!keys.has(secret)) {
    keys.set(
      secret,
      crypto.subtle
        .importKey("raw", enc.encode(secret), "HKDF", false, ["deriveKey"])
        .then((base) =>
          crypto.subtle.deriveKey(
            { name: "HKDF", hash: "SHA-256", salt: enc.encode("fungc-admin"), info: enc.encode("session-v1") },
            base,
            { name: "HMAC", hash: "SHA-256", length: 256 },
            false,
            ["sign", "verify"],
          ),
        ),
    );
  }
  return keys.get(secret);
}

/** data に exp(UNIX 秒)を入れて渡す */
export async function sealSession(data, secret) {
  const body = base64url(enc.encode(JSON.stringify(data)));
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(secret), enc.encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}

/** 署名が正しく、期限が切れていなければ中身を返す。それ以外は null */
export async function openSession(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const [body, signature, extra] = String(token).split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await sessionKey(secret), fromBase64url(signature), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(dec.decode(fromBase64url(body)));
    if (typeof data?.exp !== "number" || data.exp * 1000 <= now) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name && !(name in cookies)) cookies[name] = part.slice(i + 1).trim();
  }
  return cookies;
}

/** Set-Cookie の値。maxAge を 0 にすると消える */
export function setCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** 長さの違いから中身を推測されないよう、最後まで比べる */
export function sameText(a, b) {
  const x = enc.encode(String(a ?? ""));
  const y = enc.encode(String(b ?? ""));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
