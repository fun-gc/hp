"""黄色い FUNGC の黒い縁取りを、文字ではなく SVG のパスにする。

サイトのヒーローと同じく、縁取りは黄色い字を右下へずらした写しを、線だけで描いたもの。
CSS の -webkit-text-stroke のままだと、Chromium の PDF ではその字が Type 3 フォントとして入る
(印刷所によっては受け付けない)。字の形を同じ位置にパスとして置けば、PDF でもただの線になる。

    python tools/miraive-poster/outline.py node_modules/@fontsource/raleway/files/raleway-latin-600-normal.woff2 tools/miraive-poster/Main.dc.html

Main.dc.html の黄色い字(font-size: 391px)を探して、縁取りの <svg> を 1 字ずつ出力する。
出力をキャンバスの Main.dc.html の、それぞれの字のすぐ後ろに貼る。
"""

import re
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

SIZE = 391  # 字の大きさ(px)
SHIFT = 11.7  # 縁取りを右下へずらす量(px)。字の大きさの 3%
# span の上端からベースラインまで(px)。Raleway 600 を 391px、line-height 0.74 で置いたとき、
# Chromium はここにベースラインを置く(ブラウザで測った値。Google Fonts の Raleway でも同じ)
BASELINE = 283
STROKE = 2
INK = "#15202a"


def layout_unit(v):
    # Chromium は位置を 1/64px 単位に切り捨てて持つ
    return int(v * 64) / 64


def num(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def main():
    font_path, html_path = sys.argv[1:3]
    font = TTFont(font_path)
    scale = SIZE / font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    html = open(html_path, encoding="utf-8").read()
    pattern = re.compile(
        r'<span style="position: absolute; left: ([\d.]+)px; top: ([\d.]+)px; [^"]*font-size: '
        + str(SIZE)
        + r'px;[^"]*color: #fff200">(.)</span>'
    )
    for left, top, letter in pattern.findall(html):
        x0 = layout_unit(float(left) + SHIFT)
        y0 = layout_unit(float(top) + SHIFT) + BASELINE
        glyph = glyphs[cmap[ord(letter)]]
        pen = SVGPathPen(glyphs, ntos=num)
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x0, y0)))
        bounds = BoundsPen(glyphs)
        glyph.draw(TransformPen(bounds, (scale, 0, 0, -scale, x0, y0)))
        xmin, ymin, xmax, ymax = bounds.bounds
        # 線の太さとかどの尖りのぶん、少し広く取る
        pad = STROKE * 2
        bx, by = int(xmin - pad), int(ymin - pad)
        bw, bh = int(xmax + pad) + 1 - bx, int(ymax + pad) + 1 - by
        print(
            f'<svg viewBox="{bx} {by} {bw} {bh}" style="position: absolute; left: {bx}px; top: {by}px; '
            f'width: {bw}px; height: {bh}px; overflow: visible; pointer-events: none" aria-hidden="true">'
            f'<path d="{pen.getCommands()}" fill="none" stroke="{INK}" stroke-width="{STROKE}"></path></svg>'
        )


if __name__ == "__main__":
    main()
