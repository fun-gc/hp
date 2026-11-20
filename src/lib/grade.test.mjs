import assert from "node:assert/strict";
import test from "node:test";
import { academicYear, memberStanding } from "./grade.ts";

test("年度は日本時間の 4 月 1 日 0 時に切り替わる", () => {
  assert.equal(academicYear(new Date("2027-03-31T14:59:59Z")), 2026); // 日本時間 3/31 23:59:59
  assert.equal(academicYear(new Date("2027-03-31T15:00:00Z")), 2027); // 日本時間 4/1 0:00
});

test("1〜3 月は前の年の年度", () => {
  assert.equal(academicYear(new Date("2027-01-15T03:00:00Z")), 2026);
  assert.equal(academicYear(new Date("2026-12-31T15:00:00Z")), 2026); // 日本時間 2027/1/1
});

test("入学年度から学年を数える", () => {
  const now = new Date("2026-11-20T03:00:00Z");
  assert.deepEqual(memberStanding(2026, now), { grade: 1, alumni: false, label: "1年" });
  assert.deepEqual(memberStanding(2025, now), { grade: 2, alumni: false, label: "2年" });
  assert.deepEqual(memberStanding(2024, now), { grade: 3, alumni: false, label: "3年" });
});

test("4 年生になったら OB・OG", () => {
  assert.deepEqual(memberStanding(2023, new Date("2026-11-20T03:00:00Z")), { grade: 4, alumni: true, label: "OB・OG" });
});

test("4 月 1 日の再ビルドで学年が繰り上がる", () => {
  assert.equal(memberStanding(2024, new Date("2027-03-31T14:59:59Z")).label, "3年");
  assert.equal(memberStanding(2024, new Date("2027-03-31T15:00:00Z")).label, "OB・OG");
});

test("入学前(入学年度が先)の人は 1 年と出す", () => {
  assert.deepEqual(memberStanding(2027, new Date("2027-03-01T03:00:00Z")), { grade: 0, alumni: false, label: "1年" });
});

test("運営が入れた表示が優先される", () => {
  const now = new Date("2026-11-20T03:00:00Z");
  assert.equal(memberStanding(2022, now, { gradeLabel: "M1" }).label, "M1");
  assert.deepEqual(memberStanding(2022, now, { alumni: false }), { grade: 5, alumni: false, label: "5年" });
  assert.equal(memberStanding(2025, now, { alumni: true }).label, "OB・OG");
});
