// GitHub App として fun-gc/hp に書き込むためのトークンを作る。
// App の秘密鍵で署名した JWT を GitHub に渡し、1 時間だけ使えるインストールトークンを受け取る。
// 秘密鍵に期限はないので、個人のトークンのように毎年作り直す必要がない。
//
//   GITHUB_APP_ID           App の設定画面にある App ID(Client ID でも可)
//   GITHUB_APP_PRIVATE_KEY  App の設定画面で作った秘密鍵(.pem の中身をそのまま貼る)

const API = "https://api.github.com";
// 期限の 5 分前には作り直す
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// 同じ Worker が続けてリクエストを受けたときは、作ったトークンを使い回す
const cache = new Map();

const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encodeJson = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));

// DER の長さ部分
function derLength(n) {
  if (n < 0x80) return [n];
  const bytes = [];
  for (let v = n; v > 0; v >>= 8) bytes.unshift(v & 0xff);
  return [0x80 | bytes.length, ...bytes];
}
const der = (tag, content) => [tag, ...derLength(content.length), ...content];

// GitHub が渡す鍵は PKCS#1(BEGIN RSA PRIVATE KEY)だが、Web Crypto は PKCS#8 しか読めないので包み直す
function pkcs1ToPkcs8(pkcs1) {
  const rsaEncryption = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  return Uint8Array.from(der(0x30, [0x02, 0x01, 0x00, ...der(0x30, rsaEncryption), ...der(0x04, [...pkcs1])]));
}

export async function importPrivateKey(pem) {
  // Cloudflare の画面に貼ったときに改行が \n やスペースになっていても読めるよう、本体の文字だけを取り出す
  const text = String(pem).replace(/\\n/g, "\n");
  const body = text.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const pkcs8 = /BEGIN RSA PRIVATE KEY/.test(text) ? pkcs1ToPkcs8(bytes) : bytes;
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function appJwt(appId, privateKey, now = Date.now()) {
  const iat = Math.floor(now / 1000) - 60; // GitHub との時計のずれに備えて少し前にする
  const unsigned = `${encodeJson({ alg: "RS256", typ: "JWT" })}.${encodeJson({ iat, exp: iat + 9 * 60, iss: String(appId) })}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

/** repo に入っている App のインストールトークンを返す */
export async function installationToken({ appId, privateKey, repo, fetch = globalThis.fetch, now = Date.now }) {
  const key = `${appId} ${repo}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now()) return cached.token;

  const jwt = await appJwt(appId, await importPrivateKey(privateKey), now());
  const call = async (method, route, body) => {
    const res = await fetch(`${API}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "FUNGC-site-members",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const hint = {
        401: "GITHUB_APP_ID と GITHUB_APP_PRIVATE_KEY が同じ App のものか確認してください",
        404: `GitHub App が ${repo} にインストールされていません`,
      }[res.status];
      throw new Error(`GitHub App の認証に失敗しました(${res.status}${hint ? `: ${hint}` : ""})`);
    }
    return res.json();
  };

  const installation = await call("GET", `/repos/${repo}/installation`);
  const { token, expires_at } = await call("POST", `/app/installations/${installation.id}/access_tokens`, {
    repositories: [repo.split("/")[1]],
  });
  cache.set(key, { token, expiresAt: Date.parse(expires_at) });
  return token;
}
