// 編集画面(/admin)のログインに使う Discord の API。
// Discord の OAuth2 でユーザーを確かめ(scope は identify だけ)、Bot のトークンで FUNGC のサーバーにいるかを調べる。
//
//   DISCORD_CLIENT_ID      Developer Portal の OAuth2 にある Client ID(Bot の Application ID と同じ値)
//   DISCORD_CLIENT_SECRET  同じページの Client Secret
//   DISCORD_BOT_TOKEN      カレンダーと同じ Bot のトークン
//   DISCORD_GUILD_ID       FUNGC のサーバーの ID。省略すると DISCORD_CHANNEL_ID のチャンネルがあるサーバー

const API = "https://discord.com/api/v10";
const USER_AGENT = "FUNGC-site-admin (https://fungc.org, 1.0)";

export function authorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "identify",
    redirect_uri: redirectUri,
    state,
    // 一度許可した人には、許可の画面を出さずにすぐ戻す
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

/** 戻ってきた code をアクセストークンに換え、ログインした人の Discord のユーザー情報を返す */
export async function fetchLoginUser({ clientId, clientSecret, code, redirectUri, fetch }) {
  const tokenRes = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
  });
  if (!tokenRes.ok) {
    const hint = tokenRes.status === 401 ? "DISCORD_CLIENT_ID と DISCORD_CLIENT_SECRET が同じアプリのものか確認してください" : "";
    throw new Error(`Discord のトークンを受け取れませんでした(${tokenRes.status}${hint ? `: ${hint}` : ""})`);
  }
  const { access_token: accessToken } = await tokenRes.json();
  const userRes = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": USER_AGENT } });
  if (!userRes.ok) throw new Error(`Discord のユーザー情報を読めませんでした(${userRes.status})`);
  return userRes.json();
}

async function botGet(token, route, fetch) {
  if (!token) throw new Error("DISCORD_BOT_TOKEN が設定されていません");
  const res = await fetch(`${API}${route}`, { headers: { Authorization: `Bot ${token}`, "User-Agent": USER_AGENT } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const hint = { 401: "Bot のトークンが正しくありません", 403: "Bot がサーバーに入っていないか、権限がありません" }[res.status];
    throw new Error(`Discord API GET ${route} が ${res.status} を返しました${hint ? `(${hint})` : ""}`);
  }
  return res.json();
}

const guildOfChannel = new Map();

export async function resolveGuildId(env, fetch) {
  if (env.DISCORD_GUILD_ID) return String(env.DISCORD_GUILD_ID).trim();
  const channelId = String(env.DISCORD_CHANNEL_ID ?? "").split(",")[0].trim();
  if (!channelId) throw new Error("DISCORD_GUILD_ID か DISCORD_CHANNEL_ID を設定してください");
  if (!guildOfChannel.has(channelId)) {
    const channel = await botGet(env.DISCORD_BOT_TOKEN, `/channels/${channelId}`, fetch);
    if (!channel?.guild_id) throw new Error(`チャンネル ${channelId} のサーバーがわかりませんでした`);
    guildOfChannel.set(channelId, channel.guild_id);
  }
  return guildOfChannel.get(channelId);
}

/** FUNGC のサーバーにいれば { guildId, member }(Discord のメンバー情報)、いなければ null */
export async function findGuildMember({ env, userId, fetch }) {
  const guildId = await resolveGuildId(env, fetch);
  const member = await botGet(env.DISCORD_BOT_TOKEN, `/guilds/${guildId}/members/${userId}`, fetch);
  return member ? { guildId, member } : null;
}
