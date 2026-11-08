// レンダーした PNG を、サイトで使う幅ごとの WebP にして public/poster/ に書き出す。
//   node tools/poster-render/export.mjs <レンダー画像のフォルダ>
// 幅は src/components/Poster.tsx の photoWidths と合わせる。
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const widths = {
  hero: [800, 1200, 1800],
  night: [960, 1440, 1920],
  detail: [800, 1200, 1600],
  detail2: [800, 1200, 1600],
};

const src = process.argv[2];
if (!src) {
  console.error("使い方: node tools/poster-render/export.mjs <レンダー画像のフォルダ>");
  process.exit(1);
}
const outDir = path.join(process.cwd(), "public", "poster");
fs.mkdirSync(outDir, { recursive: true });

for (const [name, list] of Object.entries(widths)) {
  const file = path.join(src, `${name}.png`);
  if (!fs.existsSync(file)) {
    console.warn(`${file} がないので飛ばします`);
    continue;
  }
  for (const w of list) {
    const out = path.join(outDir, `${name}-${w}.webp`);
    await sharp(file).removeAlpha().resize({ width: w }).webp({ quality: 78, effort: 6 }).toFile(out);
    console.log(out, `${Math.round(fs.statSync(out).size / 1024)} KB`);
  }
}
