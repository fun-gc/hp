# ポスター風デザインの建物「THE STACK」

トップページや各ページの見出しにある建物の写真は、実際の写真ではなく、3D でつくったシーンを Blender(Cycles)でレンダーしたものです。シーンは `scene.py` がすべてコードで組み立てます。

## どんな建物か

1 辺 6m のコンクリートの箱を、上の階ほど手前へせり出すように積んだ建物です(逆さの階段)。下から見上げて、画面の右上から左下へ階段状の輪郭が走る構図で撮っています。

- 箱の正面: コンクリートの枠の奥に、ガラス、スクリーン、丸窓、ルーバー、吹き抜けのテラスのどれかが入ります。
- 箱の側面: 穴あきのアルミパネルです。穴の大きさを 32 × 32 マスの絵(`pictograms.py`)から決めているので、近くで見るとただの穴、離れて見るとドット絵になります。夜はパネルの奥が光り、ドット絵が黄色く浮かびます。
- 箱の裏(軒裏): 型枠の跡のあるコンクリートに、照明と箱の番号(`H08` など)が入ります。

いちばん外側の列の箱は、上から順にサイトのメニューと対応しています(`scene.py` の `SPRITE_AT`)。

| 箱 | 絵 | ページ |
| --- | --- | --- |
| H08 | 立方体 | About |
| H07 | 階段 | Course |
| H06 | 再生ボタン | Works |
| H05 | 人 | Members |
| H04 | 吹き出し | News |
| H03 | プラス | Join |

## サイトでの使い方

写真はどれも空を透明にした切り抜きです。CSS で引いた空の色と霧の向こうの函館山の上に重ねます。

- トップのヒーロー(`src/components/HomeHero.tsx`)は、建物の写真 → 文字 → 手前の箱だけの写真(`stack-front`)の順に重ねています。文字が箱の後ろに回り込んで見えるのはこのためです。
- 夜の写真(`stack-night`)は昼と同じカメラなので、同じ建物に明かりが入ったように見えます(`src/components/NightStage.tsx`)。
- 各ページの見出し(`src/components/Heading.tsx` の `PageHeading`)は、そのページの箱に寄ったカット(`zoom-*`)を使い、箱の穴あきパネルに黄色いフィルムを重ねます。

黄色いフィルムや線を建物の面にぴったり合わせるために、`scene.py --data` で、見えている面の四隅が写真のどこに来るかを JSON に書き出せます。`HomeHero.tsx` の `FACE` と `Heading.tsx` の `moduleOf` の `film` は、その値を写したものです。構図や建物の形を変えたら、ここも書き直してください。

## レンダーし直す

Blender の Python モジュール(bpy)を使います。bpy 5.0 は Python 3.11 が必要です。

```sh
uv venv -p 3.11 .venv-render
uv pip install --python .venv-render/bin/python bpy numpy pillow opencv-python-headless

sh tools/poster-render/render-all.sh preview   # 粗い画質で全体を確かめる(数分)
sh tools/poster-render/render-all.sh           # 本番の画質(4 コアの CPU で 1 時間ほど)
```

`render-all.sh` は次の 3 つを順に動かします。1 枚だけやり直したいときは、中のコマンドをそのまま使えます。

| ファイル | 役割 |
| --- | --- |
| `scene.py` | シーンを組み立ててレンダーする(空が透明な PNG)。`--night` で夜、`--matte` で手前の箱のマット、`--zoom i,k,レンズ` で 1 つの箱に寄る |
| `post.py` | レンダーを青みのグレー 1 色の調子に整え(夜は明かりの黄色だけ残す)、幅ごとの WebP にして `public/poster/` に書き出す |
| `backdrop.py` | 霧の向こうの函館山(昼と夜)と、紙のざらつきの画像を描く。レンダーは使わない |

まず `--res 600x350 --samples 12` のように小さくして構図や光を確かめてから、本番の大きさで描くと早く進みます。`--clay` を付けると、素材を灰色 1 色にして形だけを確かめられます。

## Blender で開いて調整する

`--save-blend` を付けると、シーンを `.blend` で保存します(`--out` を付けなければレンダーはしません)。Blender 5.0 以降で開けます。

```sh
.venv-render/bin/python tools/poster-render/scene.py --shot hero --save-blend the-stack.blend
```

## 主な調整箇所

| やりたいこと | 場所 |
| --- | --- |
| 建物の形(せり出し方)を変える | `scene.py` の `layout()`、`--seed` |
| どの箱にどの絵を出すか | `scene.py` の `SPRITE_AT`(指定のない箱は乱数で決まる) |
| 箱の正面の種類 | `scene.py` の `FRONT_AT`、`FRONT_KINDS` |
| ドット絵を足す、描き直す | `pictograms.py` の `SPRITES`、`GRADIENTS` |
| 光の向きと明るさ | `scene.py` の `--sun 高さ,向き`、`--sun-strength`、`--sky`、`--exposure` |
| 構図 | `scene.py` の `SHOTS`(カメラの位置、注視点、ロール、焦点距離)。`--cam` で一時的に上書きできる |
| 写真の色味、明るさ、粒子 | `post.py` の `DAY` / `NIGHT` / `GLOW`、`--gamma`、`--contrast`、`--grain` |
| 函館山の形、街の明かり | `backdrop.py` の `RIDGE`、`MASTS`、`city_lights()` |
