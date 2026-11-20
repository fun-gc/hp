"""ヒーローの黄色い FUNGC に重ねる、黒い線のための Raleway(太さ 600)を作る。

Raleway は可変フォントで、G のような文字は「C の形」と「右下の棒」を重ねて作ってある。
塗りでは重なりは見えないが、-webkit-text-stroke で線を引くと重なった内側の輪郭まで描かれ、
G の棒の中に余計な線が出る。そこで太さ 600 に固定し、重なりを 1 つの輪郭にまとめた
F・U・N・G・C だけのフォントを作り、線(globals.css の .title-letter::after)にだけ使う。

使い方: pip install fonttools skia-pathops brotli
        python3 tools/title-outline-font/make.py <Raleway の可変フォント(立体、latin)>
  元のフォントは、npm run build のあと out/_next/static/media/ にある Raleway の woff2 のうち、
  fvar があり、斜体でなく、F・U・N・G・C を含むもの(Google Fonts の Raleway、SIL OFL 1.1)。
出力: src/app/fonts/raleway-600-title-outline.woff2
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.varLib.instancer import instantiateVariableFont

LETTERS = "FUNGC"
WEIGHT = 600  # globals.css の .title-letter の font-weight と同じ
OUT = Path(__file__).resolve().parents[2] / "src/app/fonts/raleway-600-title-outline.woff2"

font = TTFont(sys.argv[1])
font = instantiateVariableFont(font, {"wght": WEIGHT})
removeOverlaps(font)

options = subset.Options()
options.layout_features = []
options.name_IDs = ["*"]
options.notdef_outline = True
subsetter = subset.Subsetter(options)
subsetter.populate(text=LETTERS)
subsetter.subset(font)

# 元の Raleway と取り違えないよう、名前を変えておく(OFL の決まりにも沿う)
for record in font["name"].names:
    if record.nameID in (1, 4, 16):
        record.string = "FUNGC Title Outline"
    elif record.nameID == 3:
        record.string = "4.026;FUNGC;FUNGCTitleOutline"
    elif record.nameID == 6:
        record.string = "FUNGCTitleOutline"

font.flavor = "woff2"
OUT.parent.mkdir(parents=True, exist_ok=True)
font.save(OUT)
print(OUT, OUT.stat().st_size, "bytes")
