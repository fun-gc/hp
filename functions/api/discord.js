// Cloudflare Pages Functions で動く、Discord の /profile コマンドの受け口(https://fungc.org/api/discord)。
// サイト本体は静的な HTML のままで、このファイルだけが Cloudflare 上でリクエストごとに動く。
// 中身は bot/members/interactions.mjs(docs/discord-bot.md)。
import { handleInteraction } from "../../bot/members/interactions.mjs";

export function onRequestPost(context) {
  return handleInteraction(context.request, context.env, { waitUntil: (p) => context.waitUntil(p) });
}
