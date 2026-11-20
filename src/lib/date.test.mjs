import assert from "node:assert/strict";
import test from "node:test";
import { todayInJapan, upcomingEvents } from "./date.ts";

test("日本時間の 0 時で日付が変わる", () => {
  assert.equal(todayInJapan(new Date("2026-11-19T14:59:59.999Z")), "2026-11-19");
  assert.equal(todayInJapan(new Date("2026-11-19T15:00:00Z")), "2026-11-20");
});

test("月や年もまたぐ", () => {
  assert.equal(todayInJapan(new Date("2026-11-30T15:00:00Z")), "2026-12-01");
  assert.equal(todayInJapan(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
});

test("日付が変わった直後の再ビルドでは、前の日の予定を外し、今日の予定は残す", () => {
  const events = [{ date: "2026-11-19", title: "a" }, { date: "2026-11-20", title: "b" }, { date: "2026-11-21", title: "c" }];
  // 日本時間 11/20 0:17(UTC ではまだ 11/19。UTC で日付を取っていたころは 11/19 の予定が残っていた)
  const buildAt = new Date("2026-11-19T15:17:00Z");
  assert.deepEqual(upcomingEvents(events, buildAt), events.slice(1));
  // 日本時間 11/19 23:59 なら、11/19 の予定はまだ残す
  assert.deepEqual(upcomingEvents(events, new Date("2026-11-19T14:59:00Z")), events);
});

test("動かしている環境のタイムゾーンに左右されない", () => {
  const original = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      assert.equal(todayInJapan(new Date("2026-11-19T15:00:00Z")), "2026-11-20", tz);
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("引数を省くと今の日付を YYYY-MM-DD で返す", () => {
  assert.match(todayInJapan(), /^\d{4}-\d{2}-\d{2}$/);
});
