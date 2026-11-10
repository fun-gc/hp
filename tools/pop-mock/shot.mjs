// ポップ案のイメージ(tools/pop-mock/index.html)を 1440×900 の画像に書き出す。
// 使い方: node tools/pop-mock/shot.mjs [書き出し先.png] [倍率] [3d]
// 最後に 3d を付けると、文字のタイルを 3D のレンダー(render/wall-3d.webp)に差し替えた版を撮る
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Playwright はサイトの依存に入れていないので、グローバルに入っているものも探せる require で読む
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [out = "pop-home-pc.png", scale = "2", look = ""] = process.argv.slice(2);
const html = path.join(path.dirname(fileURLToPath(import.meta.url)), "index.html");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(scale) });
page.on("requestfailed", (r) => console.log("読み込めませんでした:", r.url()));
await page.goto(pathToFileURL(html).href + (look ? `?look=${look}` : ""));
// フォントが入ってから撮る
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
console.log("書き出しました:", out);
