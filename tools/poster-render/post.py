"""Grade the renders into the poster look and write the web images (public/poster/).

The renders are cut-outs (transparent sky). Grading turns them into a cool, slightly grainy duotone like a printed
architecture photo; the night shots keep only the yellow of the lights. See README.md for the whole pipeline.

  python post.py day    hero.png  --name stack-day   --widths 2400,1600
  python post.py night  night.png --name stack-night --widths 2400,1600
  python post.py front  hero.png  --matte hero-matte.png --channels rg --name stack-front --widths 2400,1600
"""

import argparse
import os

import cv2
import numpy as np
from PIL import Image

DAY = [
    (0.00, (0.050, 0.070, 0.100)),
    (0.22, (0.170, 0.215, 0.270)),
    (0.50, (0.430, 0.480, 0.535)),
    (0.78, (0.730, 0.765, 0.800)),
    (1.00, (0.950, 0.962, 0.972)),
]
NIGHT = [
    (0.00, (0.030, 0.045, 0.070)),
    (0.30, (0.095, 0.135, 0.190)),
    (0.60, (0.290, 0.350, 0.430)),
    (1.00, (0.800, 0.850, 0.900)),
]
# the lights: from a dark amber up to the FUNGC yellow (#fff200), then a pale core
GLOW = [
    (0.00, (0.100, 0.070, 0.000)),
    (0.30, (0.640, 0.500, 0.000)),
    (0.62, (1.000, 0.949, 0.000)),
    (1.00, (1.000, 0.975, 0.450)),
]


def load(path):
    """-> float32 RGBA, 0..1, straight alpha"""
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise SystemExit(f"cannot read {path}")
    scale = 65535.0 if im.dtype == np.uint16 else 255.0
    im = im.astype(np.float32) / scale
    if im.shape[2] == 3:
        im = np.dstack([im, np.ones(im.shape[:2], np.float32)])
    return im[..., [2, 1, 0, 3]]


def luma(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def gradient_map(v, stops):
    xs = [s[0] for s in stops]
    return np.dstack([np.interp(v, xs, [s[1][c] for s in stops]) for c in range(3)]).astype(np.float32)


def curve(v, black, white, gamma, contrast):
    v = np.clip((v - black) / (white - black), 0, 1) ** gamma
    # a gentle S around the middle
    return np.clip(v + contrast * (v - 0.5) * (1 - np.abs(2 * v - 1)), 0, 1)


def grain(shape, amount, seed=7):
    rng = np.random.default_rng(seed)
    n = rng.normal(0.0, 1.0, shape).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), 0.7)
    return n * amount / n.std()


def sharpen(rgb, amount=0.35, radius=1.3):
    blur = cv2.GaussianBlur(rgb, (0, 0), radius)
    return np.clip(rgb + (rgb - blur) * amount, 0, 1)


def grade_day(im, args):
    rgb = sharpen(im[..., :3])
    v = curve(luma(rgb), args.black, args.white, args.gamma, args.contrast)
    v = np.clip(v + grain(v.shape, args.grain) * (0.35 + 0.65 * (1 - np.abs(2 * v - 1))), 0, 1)
    return np.dstack([gradient_map(v, DAY), im[..., 3]])


def grade_night(im, args):
    rgb = sharpen(im[..., :3], 0.25)
    v = curve(luma(rgb), args.black, args.white, args.gamma, args.contrast)
    r, b = rgb[..., 0], rgb[..., 2]
    warm = np.clip((r - b) / (r + 1e-3) * 1.7 - 0.2, 0, 1) * np.clip(v * 6, 0, 1)
    warm = warm[..., None]
    g = grain(v.shape, args.grain)
    cool = gradient_map(np.clip(v + g * 0.6, 0, 1), NIGHT)
    glow = gradient_map(np.clip(v * 1.25 + g * 0.3, 0, 1), GLOW)
    return np.dstack([cool * (1 - warm) + glow * warm, im[..., 3]])


def save(im, name, widths, out_dir, crop=None, quality=80):
    if crop:
        x0, y0, x1, y1 = crop
        h, w = im.shape[:2]
        im = im[int(y0 * h) : int(y1 * h), int(x0 * w) : int(x1 * w)]
    h, w = im.shape[:2]
    # premultiply for resizing so the edge pixels do not pick up colour from fully transparent ones
    a = im[..., 3:4]
    pm = np.dstack([im[..., :3] * a, a])
    for width in widths:
        if width > w:
            width = w
        height = round(h * width / w)
        small = cv2.resize(pm, (width, height), interpolation=cv2.INTER_AREA) if width != w else pm
        sa = small[..., 3:4]
        rgb = np.where(sa > 1e-4, small[..., :3] / np.maximum(sa, 1e-4), 0)
        out = np.clip(np.dstack([rgb, sa]) * 255 + 0.5, 0, 255).astype(np.uint8)
        path = os.path.join(out_dir, f"{name}-{width}.webp")
        Image.fromarray(out, "RGBA").save(path, "WEBP", quality=quality, method=6, exact=False)
        print(path, f"{width}x{height}", f"{os.path.getsize(path) // 1024} KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["day", "night", "front"])
    ap.add_argument("src")
    ap.add_argument("--name", required=True)
    ap.add_argument("--widths", default="2400,1600")
    ap.add_argument("--out-dir", default=os.path.join(os.getcwd(), "public", "poster"))
    ap.add_argument("--crop", default="", help="x0,y0,x1,y1 as fractions of the picture")
    ap.add_argument("--matte", default="")
    ap.add_argument("--channels", default="rgb", help="which matte groups make up the front layer")
    ap.add_argument("--night", action="store_true", help="front layer of a night picture")
    ap.add_argument("--black", type=float, default=0.02)
    ap.add_argument("--white", type=float, default=0.97)
    ap.add_argument("--gamma", type=float, default=None, help="default: 1.3 by day, 0.85 by night")
    ap.add_argument("--contrast", type=float, default=None, help="default: 0.35 by day, 0.2 by night")
    ap.add_argument("--grain", type=float, default=0.028)
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    im = load(args.src)
    night = args.mode == "night" or args.night
    # the night renders are dark all over, so they are lifted instead of pushed down
    if args.gamma is None:
        args.gamma = 0.85 if night else 1.3
    if args.contrast is None:
        args.contrast = 0.2 if night else 0.35
    if night:
        out = grade_night(im, args)
    else:
        out = grade_day(im, args)
    if args.mode == "front":
        matte = load(args.matte)
        if matte.shape[:2] != im.shape[:2]:
            raise SystemExit("the matte and the picture differ in size")
        keep = np.zeros(im.shape[:2], np.float32)
        for ch in args.channels:
            keep = np.maximum(keep, matte[..., "rgb".index(ch)])
        keep = np.clip(keep * matte[..., 3], 0, 1)
        # where two modules meet, a hairline of the front one shows along the joint; drop anything that thin
        # and keep the rest of the matte as it was
        k = np.ones((9, 9), np.uint8)
        solid = cv2.dilate(cv2.erode(keep, k), np.ones((13, 13), np.uint8))
        out[..., 3] = out[..., 3] * np.minimum(keep, solid)
    crop = tuple(float(v) for v in args.crop.split(",")) if args.crop else None
    save(out, args.name, [int(w) for w in args.widths.split(",")], args.out_dir, crop, args.quality)


if __name__ == "__main__":
    main()
