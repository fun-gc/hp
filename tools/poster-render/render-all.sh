#!/bin/sh
# サイトで使う建物の写真を、すべてレンダーし直して public/poster/ に書き出す。
#   sh tools/poster-render/render-all.sh            本番の画質(4 コアの CPU で 2 時間ほど)
#   sh tools/poster-render/render-all.sh preview    構図を確かめるための粗い画質(数分)
# リポジトリのルートで実行する。作業用の PNG は TMP(既定は /tmp/poster)に置く。
set -eu

PY=${PY:-.venv-render/bin/python}
TMP=${TMP:-/tmp/poster}
DIR=tools/poster-render
mkdir -p "$TMP"

if [ "${1:-}" = "preview" ]; then
  HERO=1200x700 SPP=16 NIGHT_SPP=24 ZOOM=800x500 ZOOM_SPP=12
  MOVE=480x280 MOVE_SPP=8 LARGE=2400x1400 LARGE_SPP=16
else
  HERO=2400x1400 SPP=144 NIGHT_SPP=176 ZOOM=1600x1000 ZOOM_SPP=96
  MOVE=1440x840 MOVE_SPP=32 LARGE=4800x2800 LARGE_SPP=112
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

# ---- ミニゲーム(src/components/PanelGame.tsx): ヒーローの構図から、黄色いパネル(H05)の正面へ回り込むカメラ ----
PLAY=$TMP/play
FACE=7,4
mkdir -p "$PLAY/seq"
# 回り込む 36 コマ(1 秒に 24 コマで 1.5 秒)。コマごとのパネルの四隅を move.json に書き出し、黄色いフィルムを焼き込むのに使う
$PY $DIR/scene.py --shot hero --to play --frames 36 --res $MOVE --samples $MOVE_SPP --out "$PLAY/seq/f_" --data "$PLAY/move.json"
$PY $DIR/post.py move "$PLAY/seq/f_" --data "$PLAY/move.json" --name play/d --quality 64
$PY $DIR/post.py move "$PLAY/seq/f_" --data "$PLAY/move.json" --name play/m --quality 64 --crop $MOBILE

# 回り込んだあとの静止画。狭い画面用は写る範囲だけ、広い画面用は拡大したあとに写る範囲だけを 2 倍の大きさでレンダーする
# (PLAY_WIDE を変えたら、PanelGame.tsx の STILL も合わせる)
PLAY_WIDE=0.19,0.20,0.83,0.83
$PY $DIR/scene.py --shot play --res $HERO --samples $SPP --border 0.28,0,0.74,0.9 --out "$PLAY/play-m.png" --data "$PLAY/play.json"
$PY $DIR/scene.py --shot play --res $LARGE --samples $LARGE_SPP --border $PLAY_WIDE --out "$PLAY/play-d.png"
$PY $DIR/post.py day "$PLAY/play-m.png" --film "$PLAY/play.json:$FACE" --name play/still-m --widths 1104,750 --crop $MOBILE
$PY $DIR/post.py day "$PLAY/play-d.png" --film "$PLAY/play.json:$FACE" --name play/still-d --widths 3072,1920 --crop $PLAY_WIDE

# ドット画面の素材。パネルの穴をすべて閉じた絵と、すべて開いた絵を、穴 1 つが 20px の平らな長方形に切り出す
PLATE=0.285,0.355,0.735,0.645
for s in "off bg" "on full"; do
  set -- $s
  $PY $DIR/scene.py --shot play --res $LARGE --samples $SPP --panel "$FACE,$2" --border $PLATE --out "$PLAY/play-$1.png"
  $PY $DIR/post.py day "$PLAY/play-d.png" --patch "$PLAY/play-$1.png@$PLATE" --film "$PLAY/play.json:$FACE" --rectify "$PLAY/play.json:$FACE" --cell 20 --name "play/panel-$1"
done

# ---- 霧の向こうの函館山(昼と夜)と、紙のざらつき ----
$PY $DIR/backdrop.py
