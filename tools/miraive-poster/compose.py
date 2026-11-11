"""Miraive ポスター(A1 縦)の背景の 1 枚を組み立てる。

空のグラデーション → 霧の向こうの函館山 → 建物の写真(ヒーローと同じカメラ)の順に重ね、
写真の中では H05 の穴あきパネルにドットの文字と絵を出し、黄色いフィルムを乗算で貼る。
文字(FUNGC の大文字や本文)はここでは描かず、ポスターの HTML の側で、この 1 枚の上に重ねる。

位置は、ポスターの幅を 100 とした単位(u)で決める。ポスターの HTML は 96px/in で 2245 × 3179(A1)なので、1u = 22.45px。

  # 本番: 4800 × 2800 でレンダーし直した生の絵(scene.py の出力)から
  python compose.py --hero hero-4800.png --on panel-full-4800.png --off panel-bg-4800.png --out bg.jpg
  # 下見: サイトの 2400px の絵と、project files の panel-on / panel-off(2400 の生のレンダー)から
  python compose.py --hero-graded ../../public/poster/stack-day-2400.webp --on panel-on.png --off panel-off.png --out bg-preview.jpg

写真は拡大も縮小もせず 1:1 で置く(ラスターの解像度を写真の幅から決める)。4800 の写真なら A1 で約 142dpi。
"""

import argparse
import os
import sys
from types import SimpleNamespace

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "poster-render"))
from post import grade_day, load  # noqa: E402

# ---------------------------------------------------------------- ポスターと写真の置き方

POSTER = (2245, 3179)  # A1(594 × 841mm)を 96px/in で
U = POSTER[0] / 100  # 1u の px

# 写真(レンダーした絵。幅 100 × 高さ 58.33 の単位)を、幅 s 倍にして (x, y) に置く。建物はポスターの左上を埋め、
# 階段状の輪郭が右上から左下へ走る。右下に空が大きく残る
PHOTO = dict(s=1.45, x=-33.0, y=-2.0)

# 霧の向こうの函館山(public/poster/hakodate-1600.webp)。建物の下の地平に置く(右の空の文章と重ならない所)
MOUNTAIN = dict(x=-8.0, y=72.5, w=64.0, opacity=0.9)

SKY = (0xC2, 0xC9, 0xD0)
PAPER = (0xDD, 0xE1, 0xE5)
# 縦方向のグラデーション(ポスターの高さに対する割合)。写真の下のあたりで紙の色になる
GRADIENT = [(0.0, SKY), (0.36, SKY), (0.60, PAPER), (1.0, PAPER)]

YELLOW = (1.0, 0xF2 / 255, 0.0)  # --color-fun-yellow

# ---------------------------------------------------------------- H05 のパネル

# 穴のマス目の四隅(絵の幅 100 × 高さ 58.33 の単位、左上から時計回り)。scene.py --data の type: "panel" と同じ形
GRID = [(27.494, 27.904), (43.01, 32.775), (39.234, 40.957), (23.932, 34.809)]
COLS, ROWS = 76, 28

FONT = {
    "M": ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
    "I": [".XXX.", "..X..", "..X..", "..X..", "..X..", "..X..", ".XXX."],
    "R": ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
    "A": [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    "V": ["X...X", "X...X", "X...X", "X...X", "X...X", ".X.X.", "..X.."],
    "E": ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
    "2": [".XXX.", "X...X", "....X", "...X.", "..X..", ".X...", "XXXXX"],
    "0": [".XXX.", "X...X", "X..XX", "X.X.X", "XX..X", "X...X", ".XXX."],
    "7": ["XXXXX", "....X", "...X.", "..X..", ".X...", ".X...", ".X..."],
}

# 湯気の立つ鍋(右の 28 列)。協力型のクッキングゲームの印
POT = [
    "............................",
    "........X.....X.....X.......",
    ".......X.....X.....X........",
    ".......X.....X.....X........",
    "........X.....X.....X.......",
    ".........X.....X.....X......",
    ".........X.....X.....X......",
    "........X.....X.....X.......",
    "............................",
    ".............XX.............",
    "............XXXX............",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "...XXXXXXXXXXXXXXXXXXXXXX...",
    "............................",
    "XX..XXXXXXXXXXXXXXXXXXXX..XX",
    "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "XX..XXXXXXXXXXXXXXXXXXXX..XX",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXX....",
    "....XXXXXXXXXXXXXXXXXXXX....",
    ".....XXXXXXXXXXXXXXXXXX.....",
    "............................",
    "............................",
    "............................",
]


def text_cells(text):
    rows = [""] * 7
    for i, ch in enumerate(text):
        g = FONT[ch]
        for r in range(7):
            rows[r] += ("." if i else "") + g[r]
    return rows


def dot_pattern(kind):
    """76 × 28 の真偽の表。True のマスは穴を大きく開ける"""
    p = np.zeros((ROWS, COLS), bool)

    def put(rows, c0, r0):
        for r, line in enumerate(rows):
            for c, ch in enumerate(line):
                if ch == "X":
                    p[r0 + r, c0 + c] = True

    if kind == "checker":
        p[:] = (np.add.outer(np.arange(ROWS), np.arange(COLS)) % 2) == 0
        return p
    # 左の 48 列に MIRAIVE / 2027、右の 28 列に鍋
    put(text_cells("MIRAIVE"), 3, 5)
    put(text_cells("2027"), 3, 16)
    put(POT, 48, 0)
    return p


def cell_mask(pattern, size, grid_px):
    """パネルのマス目を絵の上に写し、マスごとの 0/1 の面を作る(射影変換、最近傍)"""
    src = np.float32([[-0.5, -0.5], [COLS - 0.5, -0.5], [COLS - 0.5, ROWS - 0.5], [-0.5, ROWS - 0.5]])
    dst = np.float32(grid_px)
    h = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(pattern.astype(np.float32), h, size, flags=cv2.INTER_NEAREST, borderValue=0)


def polygon_mask(pts_px, size, ss=4):
    """なめらかな縁の多角形の面(4 倍で塗って縮める)"""
    w, h = size
    big = np.zeros((h * ss, w * ss), np.uint8)
    cv2.fillPoly(big, [np.round(np.array(pts_px) * ss).astype(np.int32)], 255, lineType=cv2.LINE_AA)
    return cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


GRADE = SimpleNamespace(black=0.02, white=0.97, gamma=1.3, contrast=0.35, grain=0.028)


def build_photo(args):
    """H05 にドットを出し、黄色いフィルムを貼った建物の写真(RGBA、0..1、straight alpha)"""
    on, off = load(args.on), load(args.off)
    if args.hero:
        raw = load(args.hero)
        h, w = raw.shape[:2]
        grid_px = [(x / 100 * w, y / 100 * w) for x, y in GRID]
        m = cell_mask(dot_pattern(args.pattern), (w, h), grid_px)[..., None]
        quad = polygon_mask(grid_px, (w, h))[..., None]
        # パネルの中だけ、穴を開けた絵と閉じた絵をマスごとに出し分ける(パネルの外は元の絵のまま)
        mixed = off * (1 - m) + on * m
        raw = raw * (1 - quad) + mixed * quad
        photo = grade_day(raw, GRADE)
    else:
        # 下見: 仕上げ済みの WebP に、同じ調子に仕上げたパネルを貼る。粒子は絵の大きさと種が同じなので、元の絵とそろう
        hero = np.asarray(Image.open(args.hero_graded).convert("RGBA")).astype(np.float32) / 255
        h, w = hero.shape[:2]
        if on.shape[:2] != (h, w):
            raise SystemExit("--on / --off と --hero-graded の大きさが違う")
        grid_px = [(x / 100 * w, y / 100 * w) for x, y in GRID]
        m = cell_mask(dot_pattern(args.pattern), (w, h), grid_px)[..., None]
        quad = polygon_mask(grid_px, (w, h))[..., None]
        g_on, g_off = grade_day(on, GRADE), grade_day(off, GRADE)
        mixed = g_off * (1 - m) + g_on * m
        photo = hero * (1 - quad) + mixed * quad
    # 黄色いフィルム(乗算)。パネルの外形にぴったり
    film = 1 - quad + quad * np.array(YELLOW, np.float32)
    photo[..., :3] = photo[..., :3] * film
    return photo


def srgb_gradient(height, stops):
    ys = np.linspace(0, 1, height)
    cols = [np.interp(ys, [s[0] for s in stops], [s[1][c] for s in stops]) for c in range(3)]
    return np.stack(cols, -1).astype(np.float32) / 255


def over(dst, src_rgba, x, y, opacity=1.0):
    """dst(RGB)の (x, y) に src(RGBA、straight alpha)を重ねる。はみ出した所は切る"""
    H, W = dst.shape[:2]
    h, w = src_rgba.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    s = src_rgba[y0 - y : y1 - y, x0 - x : x1 - x]
    a = s[..., 3:4] * opacity
    dst[y0:y1, x0:x1] = s[..., :3] * a + dst[y0:y1, x0:x1] * (1 - a)


def resize_rgba(im, width):
    h, w = im.shape[:2]
    height = round(h * width / w)
    a = im[..., 3:4]
    pm = np.dstack([im[..., :3] * a, a])
    pm = cv2.resize(pm, (width, height), interpolation=cv2.INTER_AREA if width < w else cv2.INTER_CUBIC)
    sa = np.clip(pm[..., 3:4], 0, 1)
    rgb = np.where(sa > 1e-4, pm[..., :3] / np.maximum(sa, 1e-4), 0)
    return np.dstack([np.clip(rgb, 0, 1), sa])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hero", default="", help="生のレンダー(scene.py --shot hero の PNG)")
    ap.add_argument("--hero-graded", default="", help="下見用: 仕上げ済みの WebP(public/poster/stack-day-2400.webp)")
    ap.add_argument("--on", required=True, help="H05 の穴を全部開けたレンダー(scene.py --panel 7,4,full --border ...)")
    ap.add_argument("--off", required=True, help="H05 の穴を全部閉じたレンダー(scene.py --panel 7,4,bg --border ...)")
    ap.add_argument("--pattern", default="miraive", choices=["miraive", "checker"])
    ap.add_argument("--mountain", default=os.path.join(HERE, "..", "..", "public", "poster", "hakodate-1600.webp"))
    ap.add_argument("--noise", type=float, default=0.012, help="空と紙に重ねる細かい粒子の強さ")
    ap.add_argument("--out", required=True)
    ap.add_argument("--quality", type=int, default=92)
    args = ap.parse_args()
    if not (args.hero or args.hero_graded):
        raise SystemExit("--hero か --hero-graded が要る")

    photo = build_photo(args)
    pw = photo.shape[1]
    # 写真を 1:1 で置けるように、ラスターの解像度(CSS の 1px あたりの画素数)を決める
    k = pw / (PHOTO["s"] * POSTER[0])
    W, H = round(POSTER[0] * k), round(POSTER[1] * k)
    px = U * k  # 1u の画素数

    bg = np.repeat(srgb_gradient(H, GRADIENT)[:, None, :], W, axis=1)

    mt = np.asarray(Image.open(args.mountain).convert("RGBA")).astype(np.float32) / 255
    mt = resize_rgba(mt, round(MOUNTAIN["w"] * px))
    over(bg, mt, round(MOUNTAIN["x"] * px), round(MOUNTAIN["y"] * px), MOUNTAIN["opacity"])

    if args.noise:
        rng = np.random.default_rng(11)
        n = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 0.6)
        bg = np.clip(bg + (n / n.std() * args.noise)[..., None], 0, 1)

    over(bg, photo, round(PHOTO["x"] * px), round(PHOTO["y"] * px))

    out = (np.clip(bg, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(out, "RGB").save(args.out, quality=args.quality, subsampling=0, dpi=(round(96 * k), round(96 * k)))
    print(args.out, f"{W}x{H}", f"{k:.4f}px/css-px", f"{96 * k:.0f}dpi at A1", f"{os.path.getsize(args.out) // 1024} KB")


if __name__ == "__main__":
    main()
