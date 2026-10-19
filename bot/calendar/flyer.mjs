// 講座のお知らせのチラシ画像(A4 縦の FUN GC テンプレート)から、日時と場所の欄だけを切り抜いて OCR で読む。
// 本文に日時が書かれていない投稿にだけ使う。OCR は無料の tesseract.js で、日本語のデータも npm から入れたものを使う。
// テンプレートの表の位置が変わったら BOXES を直す(docs/discord-bot.md)。

import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const require = createRequire(import.meta.url);
const LANG_PATH = path.join(path.dirname(require.resolve("@tesseract.js-data/jpn/package.json")), "4.0.0_best_int");

// 欄の位置。画像の幅・高さに対する割合で [左, 上, 幅, 高さ]
const BOXES = {
  date: [0.25, 0.297, 0.68, 0.042],
  place: [0.25, 0.347, 0.68, 0.036],
};
// 解像度が違っても同じ大きさの文字で読めるよう、この幅にそろえてから切り抜く
const PAGE_WIDTH = 1600;
const A4 = 1 / Math.SQRT2;

/** Discord の添付ファイルの情報から、テンプレートのチラシらしい画像か(A4 縦か)を見る */
export function looksLikeFlyer(attachment) {
  const { content_type: type = "", width, height } = attachment ?? {};
  return type.startsWith("image/") && width > 0 && height > 0 && Math.abs(width / height - A4) < 0.02;
}

/** OCR の結果を、parse.mjs が読める文字に直す */
export function tidy(text) {
  return (
    text
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      // 日本語の文字のまわりに入る余計な空白を消す
      .replace(/ (?=[^\x00-\x7F])|(?<=[^\x00-\x7F]) /g, "")
      // 「〜」は読み落としたり「一」「ー」と読んだりするので、時刻の間を「〜」にそろえる
      .replace(/(\d{1,2}:\d{2}) ?[^\d\s:]{0,2} ?(\d{1,2}:\d{2})/g, "$1〜$2")
      // 欄の端の罫線を記号として読むことがある
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "")
      .trim()
  );
}

/** チラシを読む係を作る。使い終わったら close() する */
export function createFlyerReader() {
  let worker;
  async function ocr(image) {
    worker ??= await createWorker("jpn", 1, { langPath: LANG_PATH, cacheMethod: "none", logger: () => {} }).then(async (w) => {
      // 欄は 1 行なので、1 行として読ませる
      await w.setParameters({ tessedit_pageseg_mode: "7", user_defined_dpi: "300" });
      return w;
    });
    const { data } = await worker.recognize(image);
    return tidy(data.text);
  }

  return {
    /** 画像から「【日時】…」「【場所】…」の文字を作る。読めなければ空文字 */
    async read(buffer) {
      const page = await sharp(buffer).resize({ width: PAGE_WIDTH }).greyscale().raw().toBuffer({ resolveWithObject: true });
      const { width, height } = page.info;
      const fields = {};
      for (const [key, [x, y, w, h]] of Object.entries(BOXES)) {
        const box = { left: Math.round(x * width), top: Math.round(y * height), width: Math.round(w * width), height: Math.round(h * height) };
        const cell = sharp(page.data, { raw: page.info }).extract(box);
        // 何も書かれていない欄を読ませると、ざらつきを文字と取り違えるので読まない
        const { channels } = await cell.clone().stats();
        fields[key] = channels[0].stdev < 8 ? "" : await ocr(await cell.normalise().png().toBuffer());
      }
      if (!fields.date) return "";
      return [`【日時】${fields.date}`, fields.place && `【場所】${fields.place}`].filter(Boolean).join("\n");
    },
    async close() {
      await worker?.terminate();
    },
  };
}
