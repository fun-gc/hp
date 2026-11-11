"""ポスターのキャンバスに上げる LINE Seed JP を、太さごとに 1 つの WOFF2 にまとめる。

@fontsource/line-seed-jp は字を 120 あまりのファイルに分けて配っている(ブラウザが unicode-range で要る分だけ読む)。
キャンバスにはフォントを 1 つずつ上げるので、分かれたファイルを fontTools の merge で 1 つのフォントに戻してから、
ASCII、かな、句読点、JIS 第 1 水準の漢字、ポスターに使った字に絞る。あとで文面を少し直しても、ほとんどの字が出る。

  python fonts.py <node_modules/@fontsource/line-seed-jp> <出力フォルダ> [ポスターの HTML ...]
  → line-seed-jp-400.woff2, line-seed-jp-800.woff2
"""

import os
import re
import sys

from fontTools import subset
from fontTools.merge import Merger
from fontTools.merge import Options as MergeOptions
from fontTools.ttLib import TTFont

WEIGHTS = (400, 800)


def jis_level1():
    chars = set()
    # Shift_JIS の第 1 水準(0x889F〜0x9872)
    for hi in range(0x88, 0x99):
        for lo in list(range(0x40, 0x7F)) + list(range(0x80, 0xFD)):
            try:
                c = bytes([hi, lo]).decode("shift_jis")
            except UnicodeDecodeError:
                continue
            if len(c) == 1 and "一" <= c <= "鿿":
                chars.add(c)
    return chars


def wanted(html_files):
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= set(chr(c) for c in range(0x3000, 0x3100))  # 句読点、かな
    chars |= set(chr(c) for c in range(0xFF01, 0xFF5F))  # 全角の英数と記号
    chars |= set("—–‐‑…・「」『』〜×→←↑↓°′″")
    chars |= jis_level1()
    for path in html_files:
        text = re.sub(r"<[^>]+>", " ", open(path, encoding="utf-8").read())
        chars |= set(text)
    return {c for c in chars if ord(c) <= 0xFFFF and not c.isspace() or c == " "}


def files_for(pkg, weight):
    css = open(os.path.join(pkg, f"{weight}.css"), encoding="utf-8").read()
    return [os.path.join(pkg, m) for m in re.findall(r"url\(\./(files/[^)]+?\.woff2)\)", css)]


def merge(paths, tmp):
    """同じフォントを字で分けたファイルを、1 つに戻す。カーニング(GPOS の kern)も一緒にまとめる"""
    os.makedirs(tmp, exist_ok=True)
    ttfs = []
    for path in paths:
        out = os.path.join(tmp, os.path.basename(path).replace(".woff2", ".ttf"))
        if not os.path.exists(out):
            f = TTFont(path)
            f.flavor = None
            f.save(out)
        ttfs.append(out)
    return Merger(options=MergeOptions(drop_tables=["BASE", "vhea", "vmtx"])).merge(ttfs)


def main():
    pkg, out = sys.argv[1], sys.argv[2]
    chars = wanted(sys.argv[3:])
    os.makedirs(out, exist_ok=True)
    for w in WEIGHTS:
        paths = files_for(pkg, w)
        # latin を先にしておくと、同じ字が複数のファイルにあるとき(空白など)latin の字形が使われる
        latin = [p for p in paths if "-latin-" in p and "-latin-ext-" not in p]
        font = merge(latin + [p for p in paths if p not in latin], os.path.join(out, "ttf"))
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        opts.drop_tables += ["BASE"]
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(sorted(chars)))
        sub.subset(font)
        missing = sorted(c for c in chars if ord(c) not in font.getBestCmap() and c.strip())
        path = os.path.join(out, f"line-seed-jp-{w}.woff2")
        font.flavor = "woff2"
        font.save(path)
        print(path, f"{os.path.getsize(path) // 1024} KB", f"{len(font.getGlyphOrder())} glyphs", f"missing {len(missing)}: {''.join(missing[:40])}")


if __name__ == "__main__":
    main()
