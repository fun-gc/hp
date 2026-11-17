// Cloudflare Pages Functions で動く、編集画面(/admin)の API(https://fungc.org/api/admin/...)。
// サイト本体は静的な HTML のままで、/api/admin/ 以下だけが Cloudflare 上でリクエストごとに動く。
// 中身は bot/admin/handler.mjs(docs/admin.md)。
import { handleAdmin } from "../../../bot/admin/handler.mjs";

export function onRequest(context) {
  return handleAdmin(context.request, context.env);
}
