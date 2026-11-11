#!/bin/sh
# ポスター用に、ヒーローと同じカメラで 2 倍の解像度(4800 × 2800)にレンダーし直す。
# A1 に置くと写真の幅がポスターの 1.45 倍になるので、サイトの 2400px では 70dpi 台にしかならない。4800px で約 142dpi。
#   sh tools/miraive-poster/render.sh            (リポジトリのルートで。4 コアの CPU で 1 時間あまり)
# bpy の入れ方は tools/poster-render/README.md。作業用の PNG は TMP(既定は /tmp/miraive)に置く。
set -eu

PY=${PY:-.venv-render/bin/python}
TMP=${TMP:-/tmp/miraive}
RES=${RES:-4800x2800}
mkdir -p "$TMP"

$PY tools/poster-render/scene.py --shot hero --res $RES --samples 144 --out "$TMP/hero.png" --data "$TMP/hero.json"
# H05(7,4)の穴あきパネルの、穴を全部開けた絵と全部閉じた絵(パネルのまわりだけ)。compose.py がマスごとに出し分ける
BORDER=0.2273,0.4664,0.4421,0.7141
$PY tools/poster-render/scene.py --shot hero --res $RES --samples 144 --panel 7,4,full --border $BORDER --out "$TMP/panel-full.png"
$PY tools/poster-render/scene.py --shot hero --res $RES --samples 144 --panel 7,4,bg --border $BORDER --out "$TMP/panel-bg.png"
