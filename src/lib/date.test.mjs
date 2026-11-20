import assert from "node:assert/strict";
import test from "node:test";
import { todayInJapan } from "./date.ts";

test("日本時間の 0 時で日付が変わる", () => {
  assert.equal(todayInJapan(new Date("2026-11-19T14:59:59.999Z")), "2026-11-19");
  assert.equal(todayInJapan(new Date("2026-11-19T15:00:00Z")), "2026-11-20");
});

test("月や年もまたぐ", () => {
  assert.equal(todayInJapan(new Date("2026-11-30T15:00:00Z")), "2026-12-01");
  assert.equal(todayInJapan(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
});

test("日本時間 0:05 の再ビルドでは、前の日の予定を外す(UTC で日付を取っていたころは残っていた)", () => {
  const events = [{ date: "2026-11-19" }, { date: "2026-11-20" }, { date: "2026-11-21" }];
  const buildAt = new Date("2026-11-19T15:05:00Z"); // 日本時間 11/20 0:05
  const buildDate = todayInJapan(buildAt);
  assert.deepEqual(
    events.filter((e) => e.date >= buildDate).map((e) => e.date),
    ["2026-11-20", "2026-11-21"],
  );
  assert.equal(buildAt.toISOString().slice(0, 10), "2026-11-19");
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
