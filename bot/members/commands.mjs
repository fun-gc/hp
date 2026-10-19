// /profile コマンドを Discord のサーバーに登録する。コマンドの形を変えたら、もう一度動かす。
// GitHub Actions の「Discord のコマンドを登録」(.github/workflows/discord-commands.yml)から呼ぶ。
//
//   DISCORD_BOT_TOKEN   Bot のトークン(カレンダーと同じもの)
//   DISCORD_GUILD_ID    登録するサーバーの ID。省略すると DISCORD_CHANNEL_ID のチャンネルがあるサーバーに登録する
//
//   node bot/members/commands.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://discord.com/api/v10";
const SUB_COMMAND = 1;
const GUILD = 0;

export const commands = [
  {
    name: "profile",
    description: "サイトのメンバー欄に載せるプロフィール",
    type: 1,
    contexts: [GUILD],
    options: [
      { type: SUB_COMMAND, name: "edit", description: "プロフィールを登録・編集する(名前と Discord のユーザー ID が公開されます)" },
      { type: SUB_COMMAND, name: "links", description: "X・GitHub・Web サイトへのリンクを登録する" },
      { type: SUB_COMMAND, name: "show", description: "登録した内容を確認する(自分にだけ見えます)" },
      { type: SUB_COMMAND, name: "delete", description: "サイトへの掲載をやめ、登録した内容を消す" },
    ],
  },
];

async function discord(token, route, method = "GET", body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": "FUNGC-site-members (https://fungc.org, 1.0)",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Discord API ${method} ${route} が ${res.status} を返しました: ${await res.text()}`);
  return res.json();
}

export async function registerCommands({ log = console.log } = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN が設定されていません");
  let guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    const channelId = (process.env.DISCORD_CHANNEL_ID ?? "").split(",")[0].trim();
    if (!channelId) throw new Error("DISCORD_GUILD_ID か DISCORD_CHANNEL_ID を設定してください");
    guildId = (await discord(token, `/channels/${channelId}`)).guild_id;
  }
  const app = await discord(token, "/applications/@me");
  // サーバー単位のコマンドはすぐ使えるようになる。PUT で丸ごと置き換えるので、消したコマンドも消える
  const saved = await discord(token, `/applications/${app.id}/guilds/${guildId}/commands`, "PUT", commands);
  log(`[discord] ${saved.map((c) => `/${c.name}`).join(", ")} を登録しました`);
  return saved;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  registerCommands().catch((err) => {
    console.error(`[discord] ${err.message}`);
    process.exit(1);
  });
}
