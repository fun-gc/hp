"""The small bitmaps that drive the perforation of the aluminium panels.

One tile is 32 x 32 cells = one 6 m module face; each cell is one punched hole and its value (0..1) is the hole size.
The panels use the middle 28 x 28 cells. Tiles are either gradients or pictograms (a cube, a play mark, a heart ...),
so that a few faces of the building read as dot pictures, the way a perforated facade can carry an image.
"""

import math
import random

N = 32
M = 2  # margin
W = N - 2 * M  # 28 used cells
LO, HI = 0.08, 1.0


def blank(v=LO):
    return [[v] * W for _ in range(W)]


def from_fn(fn):
    """fn(x, y) with x, y in -1..1 (y up) -> value"""
    g = blank()
    for r in range(W):
        for c in range(W):
            x = (c + 0.5) / W * 2 - 1
            y = (r + 0.5) / W * 2 - 1
            g[r][c] = max(0.0, min(1.0, fn(x, y)))
    return g


def poly(points):
    def inside(x, y):
        n = len(points)
        hit = False
        for a in range(n):
            x1, y1 = points[a]
            x2, y2 = points[(a + 1) % n]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                hit = not hit
        return hit

    return inside


def shape(inside, on=HI, off=LO):
    return from_fn(lambda x, y: on if inside(x, y) else off)


def cube(x, y):
    """The FUNGC logo cube seen from below: three faces, three hole sizes."""
    r = 0.9
    ax, ay = abs(x), y
    if ax > r * 0.866 or abs(ay) > r - ax * 0.577:
        return LO
    if y > abs(x) * 0.577:
        return 1.0 if y < r - abs(x) * 0.577 else LO
    return 0.5 if x < 0 else 0.22


def heart(x, y):
    x, y = x * 1.25, y * 1.25 + 0.15
    return HI if (x * x + y * y - 1) ** 3 - x * x * y * y * y < 0 else LO


def ring(x, y):
    d = math.hypot(x, y)
    return HI if 0.55 < d < 0.86 or d < 0.2 else LO


def sun(x, y):
    return 1.0 - math.hypot(x, y) / 1.25


def plus(x, y):
    return HI if (abs(x) < 0.27 and abs(y) < 0.82) or (abs(y) < 0.27 and abs(x) < 0.82) else LO


def stripes(x, y):
    return HI if math.floor((x + y + 2) * 3.5) % 2 == 0 else 0.18


def person(x, y):
    if math.hypot(x, y - 0.5) < 0.3:
        return HI
    if -0.85 < y < 0.12 and abs(x) < 0.25 + (0.12 - y) * 0.42:
        return HI
    return LO


def smile(x, y):
    d = math.hypot(x, y)
    if 0.72 < d < 0.9:
        return HI
    if math.hypot(abs(x) - 0.3, y - 0.25) < 0.13:
        return HI
    if 0.36 < d < 0.52 and y < -0.12:
        return HI
    return LO


def arrow(x, y):
    # an arrow pointing up and to the right
    u, v = (x + y) / 1.414, (y - x) / 1.414
    if abs(v) < 0.13 and -0.95 < u < 0.5:
        return HI
    if 0.25 < u < 0.95 and abs(v) < (0.95 - u) * 0.75:
        return HI
    return LO


FONT = {
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "N": ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
    "G": [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
}


def letter(ch):
    g = blank()
    rows = FONT[ch]
    for r, row in enumerate(rows):
        for c, px in enumerate(row):
            if px == "#":
                for dy in range(4):
                    for dx in range(4):
                        g[W - 1 - (r * 4 + dy)][4 + c * 4 + dx] = HI
    return g


def blocks(seed):
    rnd = random.Random(seed)
    g = blank()
    for br in range(7):
        for bc in range(7):
            v = rnd.choice([0.1, 0.1, 0.35, 0.6, 1.0])
            for dy in range(4):
                for dx in range(4):
                    g[br * 4 + dy][bc * 4 + dx] = v
    return g


def bubble(x, y):
    """A speech bubble with three dots."""
    body = abs(x) < 0.86 and -0.22 < y < 0.82
    tail = poly([(-0.55, -0.22), (-0.05, -0.22), (-0.6, -0.82)])(x, y)
    dot = any(math.hypot(x - cx, y - 0.3) < 0.12 for cx in (-0.42, 0.0, 0.42))
    return HI if (body or tail) and not dot else LO


stairs_pts = [(-0.85, -0.8), (0.85, -0.8), (0.85, 0.8), (0.425, 0.8), (0.425, 0.4), (0.0, 0.4), (0.0, 0.0), (-0.425, 0.0), (-0.425, -0.4), (-0.85, -0.4)]
star_pts = [(math.sin(a * math.pi / 5) * (0.92 if a % 2 == 0 else 0.4), math.cos(a * math.pi / 5) * (0.92 if a % 2 == 0 else 0.4)) for a in range(10)]

GRADIENTS = {
    "up": from_fn(lambda x, y: (y + 1) / 2),
    "down": from_fn(lambda x, y: (1 - y) / 2),
    "diag": from_fn(lambda x, y: (x + y + 2) / 4),
    "diag2": from_fn(lambda x, y: (y - x + 2) / 4),
    "low": blank(0.3),
    "high": blank(0.85),
    "fade": from_fn(lambda x, y: ((y + 1) / 2) ** 2.2),
    "bands": from_fn(lambda x, y: 0.9 if math.floor((y + 1) * 2) % 2 == 0 else 0.25),
    "bg": blank(LO),  # what carries on behind a pictogram on a long face
    "full": blank(HI),  # every hole wide open (scene.py --panel: the "all on" state of a face used as a dot display)
}

SPRITES = {
    "cube": from_fn(cube),
    "play": shape(poly([(-0.6, -0.8), (0.82, 0.0), (-0.6, 0.8)])),
    "heart": from_fn(heart),
    "ring": from_fn(ring),
    "sun": from_fn(sun),
    "plus": from_fn(plus),
    "tri": shape(poly([(0.0, 0.85), (0.9, -0.75), (-0.9, -0.75)])),
    "stripes": from_fn(stripes),
    "person": from_fn(person),
    "smile": from_fn(smile),
    "arrow": from_fn(arrow),
    "star": shape(poly(star_pts)),
    "stairs": shape(poly(stairs_pts)),
    "bubble": from_fn(bubble),
    "blocks": blocks(5),
    "F": letter("F"),
    "U": letter("U"),
    "N": letter("N"),
    "G": letter("G"),
    "C": letter("C"),
}

ORDER = list(GRADIENTS) + list(SPRITES)
COLS = 6
ROWS = math.ceil(len(ORDER) / COLS)
# how often each one is picked for a full cube face
SPRITE_WEIGHTS = {
    "cube": 5, "play": 4, "heart": 3, "ring": 4, "sun": 3, "plus": 4, "tri": 4, "stripes": 3, "person": 2,
    "smile": 1, "arrow": 4, "star": 2, "blocks": 3, "stairs": 2, "bubble": 2, "F": 0, "U": 0, "N": 0, "G": 0, "C": 0,
}  # fmt: skip
GRADIENT_WEIGHTS = {"up": 5, "down": 3, "diag": 3, "diag2": 3, "low": 3, "high": 1, "fade": 4, "bands": 1, "bg": 0}


def padded(g):
    """Grow a 28 x 28 tile to 32 x 32 by repeating its edge cells."""
    out = []
    for r in range(N):
        rr = min(W - 1, max(0, r - M))
        out.append([g[rr][min(W - 1, max(0, c - M))] for c in range(N)])
    return out


def build_atlas():
    grid = [[0.0] * (COLS * N) for _ in range(ROWS * N)]
    for idx, name in enumerate(ORDER):
        tile = padded(GRADIENTS.get(name) or SPRITES[name])
        ox, oy = (idx % COLS) * N, (idx // COLS) * N
        for r in range(N):
            for c in range(N):
                grid[oy + r][ox + c] = tile[r][c]
    return grid, COLS, ROWS


def tile_origin(name):
    idx = ORDER.index(name)
    return float((idx % COLS) * N), float((idx // COLS) * N)


def _pick(rnd, weights):
    names = list(weights)
    return rnd.choices(names, weights=[weights[n] for n in names])[0]


def pick_sprite(rnd):
    return _pick(rnd, SPRITE_WEIGHTS)


def pick_gradient(rnd):
    return _pick(rnd, GRADIENT_WEIGHTS)
