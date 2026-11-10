# トップページのポップ案(イメージ)

ポスター風のデザインに対して、「カラフルでポップ、でもデザイン性のある」方向を試すためのイメージです。サイト本体(`src/`)には手を入れず、トップページの最初の 1 画面(1440×900)だけを 1 枚の HTML で組んでいます。

- 色の面で区切ったタイルに、四角と四分円で組んだ FUNGC の文字を 1 文字ずつ置いています。
- 文字は小さなキャラクターの遊び場です。F のボールを持ち上げる、U のコップに入る、N のすべり台をすべる、G の最後のピースをはめる、C の入口で手を振る。
- キャラクターの形は、メンバーの役割(プログラム、グラフィック、サウンド、企画)に対応させています。
- 色は講座テンプレートの赤、緑、黄に、青とピンクを足しています。黄色は面や帯、ボタンの地にだけ使い、文字色には使っていません。
- 文章は今のサイトにある文をそのまま使っています。作品数(12 本)とお知らせも `content/` の内容です。

## 画像に書き出す

日本語のドット文字(DotGothic16)だけ、サイトの依存に入っていないので足します。Playwright も必要です。

```sh
npm ci
npm install --no-save @fontsource/dotgothic16
node tools/pop-mock/shot.mjs pop-home-pc.png
```

`index.html` をブラウザで直接開いても確認できます(画面は 1440×900 の固定です)。

## 3D 版

「3D を取り入れるとどうなるか」を見るための版です。文字のタイルを色の箱に見立て、厚みのある文字とキャラクターを中に置いて Blender(Cycles)でレンダーし、その画像を文字のタイルの位置に敷いています。文章、メニュー、ラベル、ふきだし、カーソルは平面のまま上に重ねます。

- シーンは `scene3d.py` がすべてコードで組み立てます。文字の輪郭は `index.html` の SVG と同じ形で、角を丸めてから厚みを付けています。
- 色を画面の色(CSS)と並べるので、ビュー変換は Standard にしています。箱の内側は、影で色がにごらないよう地の色でほんの少し光らせています(`GLOW`)。
- カメラは壁の少し上に置き、レンズのシフトで壁をまっすぐ収めています。箱の口がタイルの区切りにぴったり重なるので、HTML の面とそのまま並べられます。
- 重ねるものの位置は、`scene3d.py` が最後に出す `anchors`(シーンの点が画像のどこに写るか)に合わせています。シーンを動かしたら `index.html` の「3D 版で画像の上に重ねる」の数字も直します。

```sh
# Blender の Python モジュール(bpy 5.0、Python 3.11)。tools/poster-render と同じ環境に shapely(輪郭の角を丸める)を足します
uv venv -p 3.11 .venv-render
uv pip install --python .venv-render/bin/python bpy pillow shapely

# 下見(小さく、粗く)
.venv-render/bin/python tools/pop-mock/scene3d.py --res 720x382 --samples 24 --out /tmp/wall-3d.png

# 本番。PNG を WebP にして render/ に置く
.venv-render/bin/python tools/pop-mock/scene3d.py --out /tmp/wall-3d.png
.venv-render/bin/python -c "from PIL import Image; Image.open('/tmp/wall-3d.png').save('tools/pop-mock/render/wall-3d.webp', quality=92)"

# 3D 版の画面を画像にする(最後の 3d が切り替え)
node tools/pop-mock/shot.mjs pop-home-3d-pc.png 2 3d
```

ブラウザでは `index.html?look=3d` で開きます。
