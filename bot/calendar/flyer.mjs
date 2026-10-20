// 講座のお知らせのチラシ画像(A4 縦の FUN GC テンプレート)から、日時と場所の欄だけを切り抜いて OCR で読む。
// 本文に日時が書かれていない投稿にだけ使う。OCR は無料の tesseract.js で、日本語のデータも npm から入れたものを使う。
// 表の位置はチラシごとに違う(見出しの行数などでずれる)ので、見出しの横の赤・緑の四角を探して欄の位置を決める(docs/discord-bot.md)。

import path from "node:path";
import { createRequire } from "node:module";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const require = createRequire(import.meta.url);
const LANG_PATH = path.join(path.dirname(require.resolve("@tesseract.js-data/jpn/package.json")), "4.0.0_best_int");

// 解像度が違っても同じ大きさの文字で読めるよう、この幅にそろえてから切り抜く
const PAGE_WIDTH = 1600;
const A4 = 1 / Math.SQRT2;

/** Discord の添付ファイルの情報から、テンプレートのチラシらしい画像か(A4 縦か)を見る */
export function looksLikeFlyer(attachment) {
  const { content_type: type = "", width, height } = attachment ?? {};
  return type.startsWith("image/") && width > 0 && height > 0 && Math.abs(width / height - A4) < 0.02;
}

const isRed = (r, g, b) => r > 180 && g < 90 && b < 90;
const isGreen = (r, g, b) => g > 130 && r < 110 && b < 130 && g - r > 50;

/**
 * 表の「日時」「場所」の欄の位置を探す。見出しの左には、日時なら赤、場所なら緑の小さな四角がある。
 * 赤い四角のすぐ下に緑の四角がある組を日時と場所の行とみなし、四角の右の灰色の見出し欄が終わる所から右の罫線までを欄とする。
 * 見つからなければ null。page は sharp の raw(RGB)
 */
export function locateCells({ data, info }) {
  const { width: W, height: H } = info;
  const at = (x, y) => {
    const i = (y * W + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // 左端の帯で、色の付いた小さな四角を縦に探す(上の飾りの横線は幅が広いので除く)
  const squares = (test) => {
    const found = [];
    let run = null;
    for (let y = 0; y < H; y++) {
      const xs = [];
      for (let x = Math.round(0.06 * W); x < Math.round(0.14 * W); x++) if (test(...at(x, y))) xs.push(x);
      if (xs.length >= 3) {
        run ??= { top: y, left: xs[0], right: xs.at(-1) };
        run.bottom = y;
        run.left = Math.min(run.left, xs[0]);
        run.right = Math.max(run.right, xs.at(-1));
      } else if (run) {
        const w = run.right - run.left + 1;
        const h = run.bottom - run.top + 1;
        if (w < 0.025 * W && Math.abs(w - h) <= Math.max(3, 0.3 * w)) found.push(run);
        run = null;
      }
    }
    return found;
  };
  const greens = squares(isGreen);
  let date, place;
  for (const red of squares(isRed)) {
    place = greens.find((g) => g.top > red.bottom && g.top - red.top < 0.08 * H);
    if (place) {
      date = red;
      break;
    }
  }
  if (!date) return null;

  const rowHeight = place.top - date.top;
  return [date, place].map((square) => {
    const middle = Math.round((square.top + square.bottom) / 2);
    // 文字のない、行の上のほうをたどって欄の左右の端を探す
    const probe = Math.round(middle - 0.35 * rowHeight);
    let left = square.right + 1;
    while (left < W - 1 && Math.min(...at(left, probe)) < 250) left++;
    let right = left + 1;
    while (right < W - 1 && Math.min(...at(right, probe)) >= 245) right++;
    const half = Math.round(0.3 * rowHeight);
    const top = Math.max(0, middle - half);
    return { left: left + 4, top, width: Math.max(1, right - left - 8), height: Math.min(H - top, 2 * half) };
  });
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
      const page = await sharp(buffer).resize({ width: PAGE_WIDTH }).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
      const cells = locateCells(page);
      if (!cells) return "";
      const fields = {};
      for (const [key, box] of [["date", cells[0]], ["place", cells[1]]]) {
        const cell = sharp(page.data, { raw: page.info }).extract(box).greyscale();
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
