"""What sits behind the cut-out building: the far shore in the mist, and a tile of paper grain.

The ridge is Mt. Hakodate as you see it from the campus, across the bay: a long low back with the broadcast masts
on the summit, its foot lost in sea mist. Both pictures are drawn with numpy, no render needed.

The night version is the same shore after dark: the mountain is a darker shape, and the lights of the city lie along
the water at its foot.

  python backdrop.py            # writes public/poster/hakodate-{1600,900}.webp, hakodate-night-{1600,900}.webp and grain.png
"""

import os

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.getcwd(), "public", "poster")
W, H = 1600, 380

# (x, height) of the ridge, both 0..1, read off photographs of the mountain from the north
RIDGE = [
    (0.00, 0.030), (0.12, 0.035), (0.22, 0.050), (0.28, 0.12), (0.33, 0.30), (0.38, 0.50), (0.43, 0.62),
    (0.48, 0.70), (0.53, 0.80), (0.58, 0.93), (0.62, 1.00), (0.66, 0.97), (0.70, 0.86), (0.74, 0.80),
    (0.78, 0.72), (0.82, 0.52), (0.86, 0.30), (0.90, 0.12), (0.94, 0.04), (1.00, 0.02),
]  # fmt: skip
MASTS = [(0.588, 0.11), (0.606, 0.19), (0.620, 0.13), (0.634, 0.22), (0.650, 0.10)]


def smooth_profile(xs):
    px = np.array([p[0] for p in RIDGE])
    py = np.array([p[1] for p in RIDGE])
    y = np.interp(xs, px, py)
    # round the corners of the polyline, then roughen it a little like a tree line
    k = 41
    y = np.convolve(np.pad(y, k, mode="edge"), np.ones(k) / k, mode="same")[k:-k]
    rng = np.random.default_rng(3)
    rough = np.convolve(rng.normal(0, 1, xs.size + 80), np.hanning(21) / np.hanning(21).sum(), mode="same")[40:-40]
    return y + rough * 0.006 * np.clip(y * 4, 0, 1)


TOP = 0.26  # the summit sits this far below the top edge
BASE = 0.74  # the waterline


def landscape(night=False):
    xs = np.linspace(0, 1, W)
    top, base = TOP, BASE
    prof = smooth_profile(xs)
    ridge_y = (base - prof * (base - top)) * H  # pixel row of the ridge at each x
    rows = np.arange(H)[:, None].astype(np.float32)
    inside = np.clip(rows - ridge_y[None, :] + 0.5, 0, 1) * np.clip(base * H - rows + 0.5, 0, 1)

    for mx, mh in MASTS:
        x = int(mx * W)
        y1 = int(ridge_y[x]) + 2
        y0 = int(y1 - mh * (base - top) * H)
        inside[y0:y1, x : x + 2] = np.maximum(inside[y0:y1, x : x + 2], 0.85)
        inside[y0 : y0 + 3, x - 1 : x + 3] = 0.85

    # the mountain fades towards the water, as if its foot stood in mist
    depth = np.clip((base * H - rows) / ((base - top) * H), 0, 1)
    alpha = inside * (0.10 + 0.34 * depth**0.8)
    # the sea: a faint darker band under the waterline, gone within a few rows
    sea = np.clip((rows - base * H) / (0.26 * H), 0, 1)
    alpha = np.maximum(alpha, (rows >= base * H) * 0.11 * (1 - sea) ** 2)
    # drifts of mist across the slope
    rng = np.random.default_rng(11)
    mist = np.zeros((H, W), np.float32)
    for _ in range(7):
        cx, cy = rng.uniform(0.1, 0.9) * W, rng.uniform(0.5, 0.78) * H
        sx, sy = rng.uniform(0.12, 0.3) * W, rng.uniform(0.012, 0.03) * H
        xg = np.arange(W)[None, :]
        mist += np.exp(-(((xg - cx) / sx) ** 2 + ((rows - cy) / sy) ** 2)) * rng.uniform(0.3, 0.7)
    alpha = alpha * (1 - np.clip(mist, 0, 0.85))
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 1.1)
    # soften the left and right ends so the picture has no edge
    edge = np.clip(np.minimum(xs, 1 - xs) / 0.08, 0, 1)[None, :]
    alpha = alpha * edge

    rgb = np.zeros((H, W, 3), np.float32)
    rgb[...] = (0.27, 0.33, 0.40)
    if night:
        rgb[...] = (0.14, 0.20, 0.28)
        alpha = np.clip(alpha * 1.5, 0, 0.9)
        rgb, alpha = city_lights(rgb, alpha, ridge_y, base * H)
    grain = np.random.default_rng(5).normal(0, 0.012 if night else 0.03, (H, W)).astype(np.float32)
    out = np.dstack([np.clip(rgb + grain[..., None], 0, 1), np.clip(alpha, 0, 1)])
    return (out * 255 + 0.5).astype(np.uint8)


def city_lights(rgb, alpha, ridge_y, water):
    """Scatter the lights of the town along the water: dense on the flat land to the left, thinning up the slope."""
    rng = np.random.default_rng(23)
    lights = np.zeros((H, W), np.float32)
    n = 1500
    # most of the town sits on the low land left of the mountain; some of it wraps around the foot
    x = np.where(rng.random(n) < 0.62, rng.uniform(0.05, 0.36, n), rng.uniform(0.30, 0.93, n)) * W
    up = np.abs(rng.normal(0, 1, n)) * np.where(x < 0.36 * W, 5.5, 9.0)
    y = water - 1.5 - up
    for xi, yi, b in zip(x.astype(int), y.astype(int), rng.uniform(0.35, 1.0, n)):
        if 0 <= xi < W - 1 and yi > ridge_y[xi] + 2:
            lights[yi, xi] = max(lights[yi, xi], b)
            if b > 0.8:
                lights[yi, xi + 1] = max(lights[yi, xi + 1], b * 0.8)
    # a few lamps on the summit, by the masts
    for mx, mh in MASTS:
        xi = int(mx * W)
        lights[int(ridge_y[xi] - mh * (BASE - TOP) * H) + 1, xi : xi + 2] = 1.0
    glow = cv2.GaussianBlur(lights, (0, 0), 2.6) * 6.0
    # their reflection: the same row of lights smeared down into the water
    mirror = np.zeros_like(lights)
    wr = int(water)
    depth = min(H - wr - 1, 60)
    mirror[wr + 1 : wr + 1 + depth] = lights[wr - depth : wr][::-1]
    mirror = cv2.blur(mirror, (1, 31)) * 9.0 * np.clip(1 - (np.arange(H)[:, None] - wr) / 46.0, 0, 1)
    mirror = cv2.GaussianBlur(mirror, (0, 0), 0.8)
    a = np.clip(lights * 1.0 + glow * 0.5 + mirror * 0.55, 0, 1)
    warm = np.zeros_like(rgb)
    warm[...] = (1.0, 0.93, 0.35)
    xs = np.linspace(0, 1, W)
    a = a * np.clip(np.minimum(xs, 1 - xs) / 0.08, 0, 1)[None, :]
    out_a = a + alpha * (1 - a)
    out_rgb = (warm * a[..., None] + rgb * (alpha * (1 - a))[..., None]) / np.maximum(out_a, 1e-4)[..., None]
    return out_rgb, out_a


def grain_tile(size=220):
    rng = np.random.default_rng(1)
    n = cv2.GaussianBlur(rng.normal(0, 1, (size, size)).astype(np.float32), (0, 0), 0.6)
    n /= n.std()
    out = np.zeros((size, size, 4), np.uint8)
    out[..., :3] = np.where(n[..., None] > 0, 255, 12)
    out[..., 3] = np.clip(np.abs(n) * 15, 0, 60).astype(np.uint8)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, night in (("hakodate", False), ("hakodate-night", True)):
        im = Image.fromarray(landscape(night), "RGBA")
        for w in (1600, 900):
            path = os.path.join(OUT, f"{name}-{w}.webp")
            im.resize((w, round(H * w / W)), Image.LANCZOS).save(path, "WEBP", quality=78 if night else 72, method=6)
            print(path, os.path.getsize(path) // 1024, "KB")
    path = os.path.join(OUT, "grain.png")
    Image.fromarray(grain_tile(), "RGBA").save(path, optimize=True)
    print(path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
