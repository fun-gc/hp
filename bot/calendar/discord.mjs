// Discord の REST API を Bot のトークンで呼ぶ。レート制限(429)は待ってやり直し、404 は null を返す。

const API = "https://discord.com/api/v10";

export async function discord(token, route, method = "GET", body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}${route}`, {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        "User-Agent": "FUNGC-site-calendar (https://fungc.org, 1.0)",
        ...(body && { "Content-Type": "application/json" }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (res.status === 429) {
      const { retry_after = 1 } = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil(retry_after * 1000) + 100));
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      const hint = {
        401: "トークンが正しくありません",
        403: "Bot にチャンネルの閲覧・メッセージ履歴・送信の権限がありません",
      }[res.status];
      throw new Error(`Discord API ${method} ${route} が ${res.status} を返しました${hint ? `(${hint})` : ""}`);
    }
    return res.status === 204 ? null : res.json();
  }
  throw new Error(`Discord API ${route} のレート制限が解けませんでした`);
}
