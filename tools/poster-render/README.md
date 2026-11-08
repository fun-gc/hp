# ポスター風デザインの建物レンダー

トップページや各ページの見出しにある建物の写真は、実際の写真ではなく、3D でつくったシーンを Blender(Cycles)でレンダーしたものです。シーンは `scene.py` がすべてコードで組み立てます。

- 建物: 3m の立方体のモジュールを斜めの稜線に沿って積み上げ、ところどころ抜きや張り出しをつくっています(`layout()`)。
- 穴あき金属パネル: 面ごとに穴の大きさ(`rmin` / `rmax`)と密度(`dens`)を持たせ、下から上へ穴が大きくなるグラデーションなどをつくっています(`perforated_material()`)。穴は本当に抜けていて、奥のガラスやコンクリートの壁が見えます。
- 奥の壁: 方立て(縦横の枠)の入ったガラスか、コンクリート(`inner_material()`)。夜のカットでは一部の部屋に黄色い明かりがつき、パネルの穴から光がもれます。
- 枠: モジュールの 12 本の辺に白い梁を通しています。
- 光: 空(Sky Texture の彩度を落としたもの)と太陽。影がはっきり出るよう、空は暗めにしています。

## レンダーし直す

Blender の Python モジュール(bpy)を使います。bpy 5.0 は Python 3.11 が必要です。

```sh
uv venv -p 3.11 .venv-render
uv pip install --python .venv-render/bin/python bpy

mkdir -p /tmp/poster
.venv-render/bin/python tools/poster-render/scene.py --shot hero --res 1800x1800 --samples 128 --out /tmp/poster/hero.png
.venv-render/bin/python tools/poster-render/scene.py --shot night --res 1920x1080 --samples 96 --rim 800 --exposure 0 --out /tmp/poster/night.png
.venv-render/bin/python tools/poster-render/scene.py --shot detail --res 1600x1000 --samples 96 --out /tmp/poster/detail.png
.venv-render/bin/python tools/poster-render/scene.py --shot detail2 --res 1600x1000 --samples 96 --out /tmp/poster/detail2.png

# サイトで使う幅ごとの WebP にして public/poster/ に書き出す
node tools/poster-render/export.mjs /tmp/poster
```

まず `--res 480x300 --samples 12` のように小さくして構図や光を確かめてから、本番の大きさで描くと早く進みます。

## Blender で開いて調整する

`--save-blend` を付けると、レンダーせずにシーンを `.blend` で保存します。Blender 5.0 以降で開けます。

```sh
.venv-render/bin/python tools/poster-render/scene.py --shot hero --save-blend fungc-poster.blend
```

## 主な調整箇所

| やりたいこと | 場所 |
| --- | --- |
| 建物の形を変える | `layout()` の稜線の式、`--seed` |
| 穴の大きさ・密度・グラデーション | `build_tower()` で面ごとに決める `rmin` / `rmax` / `dens` |
| パネルの色味や汚れ | `perforated_material()` の `base` と `weather` |
| 光の向きと明るさ | `SUN`(`--sun 傾き,向き`)、`SKY`(`--sky`)、`--exposure` |
| 構図 | `SHOTS`(カメラの位置、注視点、焦点距離、ロール)、`--cam` で一時的に上書き |
