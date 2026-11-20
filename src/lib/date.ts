// サイトの日付はどれも日本時間で決める。ビルドする Cloudflare や GitHub Actions のサーバーは UTC なので、
// new Date().toISOString() のまま日付を取ると、日本時間の 0〜9 時には前の日になってしまう。
// ブラウザで使っても、閲覧する人の端末のタイムゾーンには左右されない。
// (src/lib/date.test.mjs と bot/calendar/board.mjs から Node でそのまま読むので、このファイルはほかのファイルを import しない。
//  @/ や拡張子なしの import、enum などの TypeScript だけの書き方は Node で読めない)

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 日本時間で見た日付を "YYYY-MM-DD" で返す。now を省くと今 */
export function todayInJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 予定のうち、日本時間の今日より前のもの(終わった日の予定)を外す。今日の予定は残す。now を省くと今 */
export function upcomingEvents<T extends { date: string }>(events: T[], now: Date = new Date()): T[] {
  const today = todayInJapan(now);
  return events.filter((e) => e.date >= today);
}
