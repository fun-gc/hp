// サイトのカレンダーと同じ予定を、Discord のチャンネルに「今月の予定」として掲示する。
// 月ごとに 1 件のメッセージを使い、月が変わったら新しく送り、同じ月のあいだは予定が変わるたびに書き換える。
// GitHub Actions(.github/workflows/discord-calendar.yml)から 15 分ごとに呼ぶ(docs/discord-bot.md)。
//
//   DISCORD_BOT_TOKEN          Bot のトークン
//   DISCORD_BOARD_CHANNEL_ID   掲示するチャンネルの ID
//
//   node bot/calendar/board.mjs [--events <Discord から読んだ予定の JSON>]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discord } from "./discord.mjs";

const contentDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../content");
const CALENDAR_URL = "https://fungc.org/course/#schedule";
// Discord のメッセージは 2000 文字まで
const MAX_LENGTH = 2000;

const kindLabels = { course: "講座", exhibition: "展示", event: "イベント", other: "その他" };
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

/** 日本時間の今日を { year, month, date: "YYYY-MM-DD" } で返す */
export function todayInJapan(now = Date.now()) {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  const date = jst.toISOString().slice(0, 10);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, date };
}

export const boardTitle = (year, month) => `## 📅 ${year}年${month}月の予定`;

/** content/schedule.json と Discord から読んだ予定を、サイトと同じ順にまとめる */
export function loadEvents(discordEventsFile) {
  return [path.join(contentDir, "schedule.json"), discordEventsFile]
    .filter((file) => file && fs.existsSync(file))
    .flatMap((file) => JSON.parse(fs.readFileSync(file, "utf8")))
    .sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
}

function line(e, today) {
  const [y, m, d] = e.date.split("-").map(Number);
  const weekday = weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const time = e.start ? ` ${e.start}${e.end ? `〜${e.end}` : "〜"}` : "";
  // フォーラムから読んだ予定は、スレッドへのリンク(Discord ではスレッド名で表示される)にする
  const what = e.discordThreadId ? `<#${e.discordThreadId}>` : `【${kindLabels[e.kind] ?? kindLabels.other}】${e.title}`;
  const place = e.place ? ` @${e.place}` : "";
  const text = `**${m}/${d}(${weekday})**${time}：${what}${place}`;
  // 終わった予定は打ち消し線、今日の予定は印を付ける
  if (e.date < today) return `~~${text.replaceAll("~~", "")}~~`;
  return e.date === today ? `${text} ← 今日` : text;
}

/** 掲示するメッセージの本文を作る */
export function renderBoard(events, { year, month, date: today }) {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const lines = events.filter((e) => e.date.startsWith(prefix)).map((e) => line(e, today));
  const head = boardTitle(year, month);
  const foot = `\nカレンダー: <${CALENDAR_URL}>\n-# サイトのカレンダーから自動で掲示しています`;
  if (!lines.length) return `${head}\n今月の予定はまだありません。${foot}`;

  const body = [];
  for (const [i, l] of lines.entries()) {
    const rest = lines.length - i;
    const more = `ほか ${rest} 件はカレンダーを見てください。`;
    if ([head, ...body, l, more, foot].join("\n").length > MAX_LENGTH) {
      body.push(more);
      break;
    }
    body.push(l);
  }
  return [head, ...body, foot].join("\n");
}

/** 今月の掲示メッセージを送るか書き換える。何をしたかを返す */
export async function postBoard({ token, channelId, events, now = Date.now(), log = console.log }) {
  const today = todayInJapan(now);
  const content = renderBoard(events, today);
  const me = await discord(token, "/users/@me");
  const recent = (await discord(token, `/channels/${channelId}/messages?limit=50`)) ?? [];
  const current = recent.find((m) => m.author?.id === me.id && m.content.startsWith(boardTitle(today.year, today.month)));
  // 予定の名前に @everyone などが入っていても通知しない
  const message = { content, allowed_mentions: { parse: [] } };

  if (!current) {
    await discord(token, `/channels/${channelId}/messages`, "POST", message);
    log(`[discord] ${today.year}年${today.month}月の予定を掲示しました`);
    return "posted";
  }
  if (current.content === content) return "unchanged";
  await discord(token, `/channels/${channelId}/messages/${current.id}`, "PATCH", message);
  log(`[discord] ${today.year}年${today.month}月の予定の掲示を書き換えました`);
  return "edited";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const eventsIndex = args.indexOf("--events");
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_BOARD_CHANNEL_ID;
  if (!token || !channelId) {
    console.log("[discord] DISCORD_BOT_TOKEN か DISCORD_BOARD_CHANNEL_ID が未設定なので、予定は掲示しません");
  } else {
    const events = loadEvents(eventsIndex >= 0 ? path.resolve(args[eventsIndex + 1]) : path.join(contentDir, "discord-events.json"));
    postBoard({ token, channelId, events }).catch((err) => {
      console.error(`[discord] ${err.message}`);
      process.exit(1);
    });
  }
}
