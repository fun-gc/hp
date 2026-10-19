import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { createFlyerReader, looksLikeFlyer, tidy } from "./flyer.mjs";
import { parsePost } from "./parse.mjs";

test("A4 縦の画像だけをチラシとみなす", () => {
  assert.equal(looksLikeFlyer({ content_type: "image/png", width: 993, height: 1403 }), true);
  assert.equal(looksLikeFlyer({ content_type: "image/jpeg", width: 2480, height: 3508 }), true);
  assert.equal(looksLikeFlyer({ content_type: "image/png", width: 1920, height: 1080 }), false);
  assert.equal(looksLikeFlyer({ content_type: "application/pdf", width: 993, height: 1403 }), false);
  assert.equal(looksLikeFlyer({ content_type: "image/png" }), false);
});

test("OCR の読み癖を直す", () => {
  // 実際のチラシで出た読み方
  assert.equal(tidy("2026 年 10 月 28 日 ( 水 ) 18:15 一 19:45\n"), "2026年10月28日(水) 18:15〜19:45");
  assert.equal(tidy("2026 年 10 月 28 日 ( 水 ) 18:1519:45\n"), "2026年10月28日(水) 18:15〜19:45");
  assert.equal(tidy("2026 年 10 月 28 日 ( 水 ) 18:15ー19:45"), "2026年10月28日(水) 18:15〜19:45");
  assert.equal(tidy("'365\n"), "365");
  assert.equal(tidy("\n"), "");
});

test("チラシの日時と場所の欄を読む", async () => {
  // 実際のチラシから、日時と場所の欄だけを残した画像
  const image = fs.readFileSync(new URL("./fixtures/flyer.png", import.meta.url));
  const reader = createFlyerReader();
  try {
    const flyer = await reader.read(image);
    assert.equal(flyer, "【日時】2026年10月28日(水) 18:15〜19:45\n【場所】365");
    const [e] = parsePost({ content: flyer, postedAt: "2026-10-19T03:00:00Z", threadName: "オブジェクト指向を C# で学ぼう" });
    assert.deepEqual([e.date, e.start, e.end, e.place], ["2026-10-28", "18:15", "19:45", "365"]);
  } finally {
    await reader.close();
  }
});

test("日時の欄が空なら何も返さない", async () => {
  const reader = createFlyerReader();
  try {
    const blank = await sharp({ create: { width: 993, height: 1403, channels: 3, background: "#fff" } }).png().toBuffer();
    assert.equal(await reader.read(blank), "");
  } finally {
    await reader.close();
  }
});
