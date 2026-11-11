# Miraive 2027 のポスター(A1 縦)

新入生歓迎イベント Miraive 2027 の展示に貼るポスターです。トップページのヒーロー(建物「THE STACK」と黄色い FUNGC)を、A1 の縦長に組み直しています。

- 仕上がり: A1(594 × 841mm)。ポスターの枠は 96px/in で 2245 × 3179。
- 本体は Claude の Design キャンバス(Artifact)にあり、そこで文字を直したり、PDF や PNG に書き出したりできます。このフォルダの `Main.dc.html` は、そのキャンバスの 1 枚と同じものです。
- 印刷用の PDF と下見の PNG は、project files の `fungc-website/miraive-poster/` に置いています。

## つくりかた

ポスターは「背景の 1 枚(写真)」の上に「文字と線(HTML)」を重ねています。文字は PDF でも文字のまま(拡大しても粗くならない)で、写真だけが画像です。

| ファイル | 役割 |
| --- | --- |
| `render.sh` | ヒーローと同じカメラで、建物を 2 倍の 4800 × 2800 にレンダーし直す。H05 のパネルの穴を全部開けた絵と閉じた絵もつくる |
| `compose.py` | 背景の 1 枚を組む。空のグラデーション → 函館山 → 建物の写真の順に重ね、H05 のパネルに「MIRAIVE 2027」と鍋のドット絵を出し、黄色いフィルムを乗算で貼る |
| `fonts.py` | LINE Seed JP を太さごとに 1 つの WOFF2 にまとめる(キャンバスにはフォントを 1 つずつ上げるため) |
| `outline.py` | 黄色い FUNGC の黒い縁取りを、字の形の SVG パスにする |
| `Main.dc.html` | ポスターの文字と線。キャンバスの書式(`.dc.html`)のまま |
| `shot.mjs` | `Main.dc.html` を手元の Chromium で描き、PNG と A1 の PDF にする |

```sh
# 1. 建物をレンダーし直す(bpy の入れ方は tools/poster-render/README.md)
sh tools/miraive-poster/render.sh
# 2. 背景の 1 枚(3310 × 4688、A1 で約 142dpi)
python tools/miraive-poster/compose.py --hero /tmp/miraive/hero.png --on /tmp/miraive/panel-full.png --off /tmp/miraive/panel-bg.png --out bg.jpg
# 3. フォント(npm ci のあと。Raleway と IBM Plex Mono は PDF 用に足す)
npm install --no-save @fontsource/raleway @fontsource/ibm-plex-mono
python tools/miraive-poster/fonts.py node_modules/@fontsource/line-seed-jp fonts tools/miraive-poster/Main.dc.html
# 4. assets.json に /_blob/... と手元のファイルの対応を書いて、PNG と PDF にする
NODE_PATH=$(npm root -g) node tools/miraive-poster/shot.mjs tools/miraive-poster/Main.dc.html assets.json poster --pdf --static-fonts --scale 1
```

Python は numpy、opencv-python-headless、pillow、fonttools、brotli が要ります(`compose.py` は `tools/poster-render/post.py` の仕上げをそのまま使うので、写真の調子はサイトと同じになります)。

## 印刷用の PDF

- 文字は文字のまま、フォントを埋め込んでいます(どれも CID TrueType)。
- Type 3 フォントは入れていません(印刷所によっては受け付けないため)。そのために 2 つ手を入れています。
  - Google Fonts の Raleway は可変フォントで、Chromium の PDF では Type 3 になります。`--static-fonts` で、太さごとのファイル(@fontsource)に差し替えて書き出します。
  - 縁取りを CSS の `-webkit-text-stroke` で描くと、その字も Type 3 になります。そこで縁取りは `outline.py` で字の形をパスにして、`Main.dc.html` に置いています。黄色い字を動かしたら、`outline.py` で出し直して貼り替えてください。
- 色は RGB のままです。塗り足しはなく、仕上がりの A1 ちょうどの大きさです。

## 位置の決め方

- 写真は、ポスターの幅を 100 とした単位で、幅 145 にして (-33, -2) に置いています(`compose.py` の `PHOTO`)。
- 黄色い FUNGC は、サイトのヒーロー(`src/components/HomeHero.tsx` の `letters`)と同じ位置関係を、この写真の置き方に写したものです。5 文字とも建物の手前にあり、左上の角が 1 本の直線に乗ります。写真の置き方を変えたら、文字の位置も同じ式で写し直してください(写真の中の位置 × 1.45 − 33 など)。
- H05 のパネルのマス目は横 76 × 縦 28。ドット絵は `compose.py` の `dot_pattern` で描いています。
