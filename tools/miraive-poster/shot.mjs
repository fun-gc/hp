// キャンバスの Main.dc.html を手元の Chromium で描いて、PNG(下見)と PDF(A1)を書き出す。
//   NODE_PATH=$(npm root -g) node tools/miraive-poster/shot.mjs <Main.dc.html> <assets.json> <出力の名前> [--pdf] [--static-fonts] [--scale 0.5]
// assets.json は {"/_blob/...": "/絶対パス/bg.jpg", ...}。キャンバスでは /_blob/ の URL になる画像とフォントを、手元のファイルに差し替える。
// Playwright はリポジトリの依存に入れていないので、入っている環境(NODE_PATH)のものを使う。
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [src, assetsPath, outName, ...rest] = process.argv.slice(2);
const pdf = rest.includes("--pdf");
const scaleAt = rest.indexOf("--scale");
const scale = scaleAt >= 0 ? Number(rest[scaleAt + 1]) : 0.5;

// 枠の大きさ。A1(594 × 841mm)を 96px/in で
const W = 2245;
const H = 3179;

const assets = JSON.parse(readFileSync(assetsPath, "utf8"));
let html = readFileSync(src, "utf8");
for (const [from, to] of Object.entries(assets)) {
  html = html.split(from).join(pathToFileURL(to).href);
}
// キャンバスの外では <helmet> も <x-dc> もただの要素なので、そのまま描ける。support.js はキャンバスにしか無いので外す
html = html.replace('<script src="./support.js"></script>', "");
// --static-fonts: Google Fonts の Raleway は可変フォントで、PDF に Type 3 フォントとして入る(印刷所によっては嫌われる)。
// 同じ書体の太さごとのファイル(@fontsource/raleway、@fontsource/ibm-plex-mono)に差し替えて、TrueType のまま埋め込む
if (rest.includes("--static-fonts")) {
  const css = ["@fontsource/raleway/300.css", "@fontsource/raleway/600.css", "@fontsource/ibm-plex-mono/400.css", "@fontsource/ibm-plex-mono/500.css"];
  const links = css.map((c) => `<link rel="stylesheet" href="${pathToFileURL(require.resolve(c)).href}">`).join("");
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/[^"]+" rel="stylesheet">/, links);
}
const tmp = resolve(dirname(resolve(outName)), ".render.html");
writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${outName}.png`, clip: { x: 0, y: 0, width: W, height: H } });
if (pdf) {
  // 枠がそのまま 1 ページになる。端の 0.1mm ぶん 2 ページ目にはみ出さないよう、1 ページ目だけを書き出す
  await page.pdf({ path: `${outName}.pdf`, width: "594mm", height: "841mm", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: "1" });
}
await browser.close();
console.log("wrote", `${outName}.png`, pdf ? `${outName}.pdf` : "");
