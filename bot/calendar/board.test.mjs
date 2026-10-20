import assert from "node:assert/strict";
import test from "node:test";
import { postBoard, renderBoard, todayInJapan } from "./board.mjs";

const today = { year: 2026, month: 10, date: "2026-10-20" };
const events = [
  { date: "2026-09-30", title: "先月の会", kind: "event" },
  { date: "2026-10-15", start: "18:15", end: "19:45", title: "第3回 C#講座", kind: "course", place: "365" },
  { date: "2026-10-20", start: "13:00", title: "もくもく会", kind: "course" },
  { date: "2026-10-22", start: "18:15", end: "19:45", title: "自作ゲーム制作演習 企画説明会", kind: "course", place: "365" },
  { date: "2026-10-31", title: "未来祭 展示", kind: "exhibition" },
  { date: "2026-11-01", title: "来月の会", kind: "event" },
];

test("今月の予定だけを並べ、終わった予定は打ち消し線、今日の予定には印を付ける", () => {
  assert.equal(
    renderBoard(events, today),
    [
      "## 📅 2026年10月の予定",
      "~~**10/15(木)** 18:15〜19:45 【講座】第3回 C#講座 @365~~",
      "**10/20(火)** 13:00〜 【講座】もくもく会 ← 今日",
      "**10/22(木)** 18:15〜19:45 【講座】自作ゲーム制作演習 企画説明会 @365",
      "**10/31(土)** 【展示】未来祭 展示",
      "",
      "カレンダー: <https://fungc.org/course/#schedule>",
      "-# サイトのカレンダーから自動で掲示しています",
    ].join("\n"),
  );
});

test("予定がない月と、2000 文字を超える月", () => {
  assert.match(renderBoard([], today), /今月の予定はまだありません。/);
  const many = Array.from({ length: 80 }, (_, i) => ({ date: "2026-10-25", title: `とても長い名前の予定 ${i} `.repeat(3), kind: "event" }));
  const text = renderBoard(many, today);
  assert.ok(text.length <= 2000);
  assert.match(text, /ほか \d+ 件はカレンダーを見てください。/);
});

test("日本時間で月を決める", () => {
  // 日本時間 11/1 0:30 は UTC では 10/31
  assert.deepEqual(todayInJapan(Date.parse("2026-10-31T15:30:00Z")), { year: 2026, month: 11, date: "2026-11-01" });
});

// Discord の API をまねる
function fakeDiscord(messages) {
  const calls = [];
  globalThis.fetch = async (url, { method = "GET", body } = {}) => {
    const route = String(url).replace("https://discord.com/api/v10", "");
    calls.push([method, route, body && JSON.parse(body)]);
    const json = (data) => new Response(JSON.stringify(data), { status: 200 });
    if (route === "/users/@me") return json({ id: "BOT" });
    if (method === "GET") return json(messages);
    return json({ id: "NEW" });
  };
  return calls;
}

test("今月の掲示がなければ新しく送り、あれば書き換える", async () => {
  const now = Date.parse("2026-10-20T03:00:00Z");
  const log = () => {};
  const lastMonth = { id: "OLD", author: { id: "BOT" }, content: "## 📅 2026年9月の予定\n…" };

  let calls = fakeDiscord([lastMonth]);
  assert.equal(await postBoard({ token: "t", channelId: "C", events, now, log }), "posted");
  const [method, route, body] = calls.at(-1);
  assert.deepEqual([method, route], ["POST", "/channels/C/messages"]);
  assert.deepEqual(body.allowed_mentions, { parse: [] });

  const thisMonth = { id: "CUR", author: { id: "BOT" }, content: "## 📅 2026年10月の予定\n古い内容" };
  calls = fakeDiscord([thisMonth, lastMonth]);
  assert.equal(await postBoard({ token: "t", channelId: "C", events, now, log }), "edited");
  assert.deepEqual(calls.at(-1).slice(0, 2), ["PATCH", "/channels/C/messages/CUR"]);

  calls = fakeDiscord([{ ...thisMonth, content: renderBoard(events, todayInJapan(now)) }]);
  assert.equal(await postBoard({ token: "t", channelId: "C", events, now, log }), "unchanged");
  assert.equal(calls.length, 2);
});
