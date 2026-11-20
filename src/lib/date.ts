// サイトの日付はどれも日本時間で決める。ビルドする Cloudflare や GitHub Actions のサーバーは UTC なので、
// new Date().toISOString() のまま日付を取ると、日本時間の 0〜9 時には前の日になってしまう。
// ブラウザで使っても、閲覧する人の端末のタイムゾーンには左右されない。
// (src/lib/*.test.mjs から Node でそのまま読むので、このファイルはほかのファイルを import しない)

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間で見た日付を "YYYY-MM-DD" で返す。now を省くと今 */
export function todayInJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
