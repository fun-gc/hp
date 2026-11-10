#!/bin/sh
# サイトで使う建物の写真を、すべてレンダーし直して public/poster/ に書き出す。
#   sh tools/poster-render/render-all.sh            本番の画質(4 コアの CPU で 1 時間ほど)
#   sh tools/poster-render/render-all.sh preview    構図を確かめるための粗い画質(数分)
# リポジトリのルートで実行する。作業用の PNG は TMP(既定は /tmp/poster)に置く。
set -eu

PY=${PY:-.venv-render/bin/python}
TMP=${TMP:-/tmp/poster}
DIR=tools/poster-render
mkdir -p "$TMP"

if [ "${1:-}" = "preview" ]; then
  HERO=1200x700 SPP=16 NIGHT_SPP=24 ZOOM=800x500 ZOOM_SPP=12
else
  HERO=2400x1400 SPP=144 NIGHT_SPP=176 ZOOM=1600x1000 ZOOM_SPP=96
fi

# ---- ヒーロー: 昼、手前の箱のマット、夜(どれも同じカメラ) ----
# マットは、いちばん外側の列の箱を 1 つおきに R / G、その内側の列を B に塗り分けた絵
FRONT="7,1;7,3;7,5;7,7/7,2;7,4;7,6;7,8/6,1;6,2;6,3;6,4;6,5;6,6;6,7;6,8;6,9"
$PY $DIR/scene.py --shot hero --res $HERO --samples $SPP --out "$TMP/hero.png" --data "$TMP/hero.json"
$PY $DIR/scene.py --shot hero --res $HERO --samples 24 --matte --front "$FRONT" --out "$TMP/hero-matte.png"
$PY $DIR/scene.py --shot hero --res $HERO --samples $NIGHT_SPP --night --out "$TMP/hero-night.png"

# 広い画面用(絵の全体)と、狭い画面用(絵の横 28%〜74% を切り出した縦長)
MOBILE=0.28,0,0.74,1
$PY $DIR/post.py day "$TMP/hero.png" --name stack-day --widths 2400,1600
$PY $DIR/post.py day "$TMP/hero.png" --name stack-day-m --widths 1104,750 --crop $MOBILE
$PY $DIR/post.py front "$TMP/hero.png" --matte "$TMP/hero-matte.png" --channels g --name stack-front --widths 2400,1600
$PY $DIR/post.py front "$TMP/hero.png" --matte "$TMP/hero-matte.png" --channels g --name stack-front-m --widths 1104,750 --crop $MOBILE
$PY $DIR/post.py night "$TMP/hero-night.png" --name stack-night --widths 2400,1600
$PY $DIR/post.py night "$TMP/hero-night.png" --name stack-night-m --widths 1104,750 --crop $MOBILE

# ---- 各ページの見出し: そのページの箱に寄ったカット ----
# いちばん外側の列(i = 7)の箱が、上から順にメニューの並びになっている(scene.py の SPRITE_AT)
for z in "7,7 about" "7,6 course" "7,5 works" "7,4 members" "7,3 news" "7,2 join"; do
  set -- $z
  $PY $DIR/scene.py --shot hero --zoom "$1,62" --shift 0.16,-0.10 --res $ZOOM --samples $ZOOM_SPP --out "$TMP/zoom-$2.png" --data "$TMP/zoom-$2.json"
  $PY $DIR/post.py day "$TMP/zoom-$2.png" --name "zoom-$2" --widths 1600,800
done

# ---- 霧の向こうの函館山(昼と夜)と、紙のざらつき ----
$PY $DIR/backdrop.py
