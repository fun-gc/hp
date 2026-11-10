"""FUNGC poster scene: THE STACK.

An inverted staircase of 6 m concrete cube modules. Every module steps further out than the one below it and the one
beside it, so from below each one shows three faces, like the isometric cube in the FUNGC logo:
  front  (-Y)  a deep concrete frame with glazing, balconies, blinds, a porthole or louvres
  side   (-X)  perforated aluminium panels; the hole size is driven by a small bitmap, so some faces carry dot pictograms
  soffit (-Z)  board-marked concrete with light fittings

Everything (geometry, procedural materials, light, camera) is built from code and rendered with Cycles.
Run with the bpy wheel (Blender 5.0, Python 3.11) -- see README.md.
"""

import argparse
import json
import math
import os
import random
import sys

import bpy  # noqa: I001 (bpy has to come first: it sets up bmesh / mathutils)
import bmesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pictograms  # noqa: E402

S = 6.0  # module edge (m)
U = 3.0  # the modules step out in multiples of this
GAP = 0.06  # shadow gap between modules
CELLS = 32  # perforation cells per module edge
P = S / CELLS  # perforation pitch (0.1875 m)
RIM = 0.56  # width of the concrete frame around the front opening
RIM_D = 4 * P  # depth of that frame (0.75 m), so the side panels start on the perforation grid
SLAB = (S - GAP - 28 * P) / 2  # floor / roof slab thickness: leaves 28 cells of panel between them
WALL = 0.30
STAND = 0.16  # the panels stand this far off the wall behind them
PANEL = 8 * P  # panel width (1.5 m)
YB = 4.0  # every module runs back to this plane
NI, NK = 8, 12


# ---------------------------------------------------------------- layout


def layout(seed):
    """How far each module (column i, row k) steps out, in units of U. None = no module there."""
    rnd = random.Random(seed)
    a = [0]
    for _ in range(NI - 1):
        a.append(a[-1] + rnd.choice([1, 2, 2]))
    b = [0]
    for _ in range(NK - 1):
        b.append(b[-1] + rnd.choice([1, 2, 2, 2]))
    proj = {}
    for i in range(NI):
        for k in range(NK):
            j = rnd.choice([-1, 0, 0, 0, 0, 0, 1, 1, 2])
            proj[(i, k)] = max(0, a[i] + b[k] + j)
    return proj


# pictograms pinned to particular modules (column, row), so the faces that matter in a shot show what we want
# The outermost column steps down the picture like the site menu: one module per page, top to bottom.
SPRITE_AT = {
    (7, 8): "blocks",
    (7, 7): "cube",  # about
    (7, 6): "stairs",  # course
    (7, 5): "play",  # works
    (7, 4): "person",  # members
    (7, 3): "bubble",  # news
    (7, 2): "plus",  # join
    (7, 1): "heart",
    (6, 7): "sun",
    (6, 6): "tri",
    (6, 5): "arrow",
    (6, 4): "ring",
    (6, 3): "star",
    (5, 6): "stripes",
    (5, 5): "ring",
}
# and the same for what fills the front of a module
FRONT_AT = {(7, 5): "porthole", (7, 7): "glass", (7, 3): "louver", (7, 2): "screen"}

FRONT_KINDS = ["glass", "glass", "glass", "glass", "screen", "screen", "porthole", "louver", "open"]


# ---------------------------------------------------------------- mesh helpers


class Bucket:
    """Collects quads for one material. UVs are in metres; per-face floats feed the shaders."""

    ATTRS = ("rnd", "lit", "tile_u", "tile_v", "mod", "face", "front")

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("uv")
        self.layers = {k: self.bm.faces.layers.float.new(k) for k in self.ATTRS}
        self.defaults = {}

    def quad(self, pts, uvs=None, **attrs):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        if uvs is None:
            n = f.normal if f.normal.length else (Vector(pts[1]) - Vector(pts[0])).cross(Vector(pts[2]) - Vector(pts[0]))
            ax = max(range(3), key=lambda a: abs(n[a]))
            u, v = [(1, 2), (0, 2), (0, 1)][ax]
            uvs = [(p[u], p[v]) for p in pts]
        for loop, uvc in zip(f.loops, uvs):
            loop[self.uv].uv = uvc
        merged = {**self.defaults, **attrs}
        for k, val in merged.items():
            f[self.layers[k]] = val
        return f

    def box(self, lo, hi, skip="", **attrs):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        if "x" not in skip:
            self.quad([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], **attrs)
        if "X" not in skip:
            self.quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], **attrs)
        if "y" not in skip:
            self.quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], **attrs)
        if "Y" not in skip:
            self.quad([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], **attrs)
        if "z" not in skip:
            self.quad([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], **attrs)
        if "Z" not in skip:
            self.quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], **attrs)

    def finish(self, material, bevel=0.0):
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(self.name, me)
        ob.data.materials.append(material)
        bpy.context.scene.collection.objects.link(ob)
        if bevel:
            mod = ob.modifiers.new("bevel", "BEVEL")
            mod.width = bevel
            mod.segments = 2
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(40)
            mod.harden_normals = False
        return ob


class Building:
    def __init__(self, seed, front_groups, panel_fill=None):
        self.seed = seed
        self.panel_fill = panel_fill or {}  # (i, k) -> tile: punch that module's whole side face from one flat tile
        self.rnd = random.Random(seed)
        self.proj = layout(seed)
        self.front_groups = front_groups
        self.b = {k: Bucket(k) for k in ("concrete", "panel", "glass", "steel", "blind", "lamp", "screen", "glow", "paint")}
        self.faces = []  # visible faces for the 2D overlay data
        self.kinds = {}
        self.labels = []  # (text, height, paint, position, which face)

    def yf(self, i, k):
        p = self.proj.get((i, k))
        return None if p is None else -U * p

    def build(self):
        for (i, k), p in sorted(self.proj.items()):
            if p is None:
                continue
            self.module(i, k)
        # the core every module plugs into, and the ground that bounces light up to the soffits
        self.b["concrete"].box((-80, YB, -1), (NI * S + 2, YB + 2, NK * S + 6), rnd=0.5)

    # ---- one module

    def module(self, i, k):
        # each module draws from its own random stream, so pinning one module never reshuffles the others
        r = self.rnd = random.Random(self.seed * 1000003 + i * 1009 + k * 9176)
        b = self.b
        yf = self.yf(i, k)
        x0, x1 = i * S + GAP / 2, (i + 1) * S - GAP / 2
        z0, z1 = k * S + GAP / 2, (k + 1) * S - GAP / 2
        left = self.yf(i - 1, k) if i > 0 else None
        below = self.yf(i, k - 1) if k > 0 else None
        side_len = (left if left is not None else YB) - yf
        soffit_len = (below if below is not None else YB) - yf
        mid = float(i * 100 + k)
        fr = 0.0
        for gi, group in enumerate(self.front_groups):
            if (i, k) in group:
                fr = gi + 1.0
        tone = r.random()
        for bucket in b.values():
            bucket.defaults = {"rnd": tone, "mod": mid, "front": fr, "lit": 0.0, "face": 0.0}
        # most modules wear white panels, some grey, a few graphite
        self.panel_tone = r.choice([0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 2.0])
        c = b["concrete"]

        # front frame (a square ring), then the tube behind it
        c.box((x0, yf, z0), (x1, yf + RIM_D, z0 + RIM), face=1.0)
        c.box((x0, yf, z1 - RIM), (x1, yf + RIM_D, z1), face=1.0)
        c.box((x0, yf, z0 + RIM), (x0 + RIM, yf + RIM_D, z1 - RIM), skip="zZ", face=1.0)
        c.box((x1 - RIM, yf, z0 + RIM), (x1, yf + RIM_D, z1 - RIM), skip="zZ", face=1.0)
        y1 = yf + RIM_D
        c.box((x0, y1, z0), (x1, YB, z0 + SLAB), skip="y", face=3.0)
        c.box((x0, y1, z1 - SLAB), (x1, YB, z1), skip="y")
        c.box((x0 + STAND, y1, z0 + SLAB), (x0 + STAND + WALL, YB, z1 - SLAB), skip="yzZ")
        c.box((x1 - WALL, y1, z0 + SLAB), (x1, YB, z1 - SLAB), skip="yzZ")

        if side_len > RIM_D + 0.2:
            self.side_panels(i, k, x0, yf, z0, side_len)
        if soffit_len > 1.0:
            self.soffit_lights(x0, x1, yf, z0, soffit_len)

        r = self.rnd = random.Random(self.seed * 1000003 + i * 1009 + k * 9176 + 1)
        kind = FRONT_AT.get((i, k)) or r.choice(FRONT_KINDS)
        self.kinds[(i, k)] = kind
        lit = 1.0 if r.random() < 0.62 else 0.0
        getattr(self, "front_" + kind)(x0, x1, yf, z0, z1, lit)

        code = f"{'ABCDEFGHJKLM'[i]}{k + 1:02d}"
        self.labels.append((code, 0.26, "dark", (x0 + RIM + 0.12, yf - 0.004, z0 + 0.15), "front"))
        if soffit_len >= S - 0.01:
            self.labels.append((code, 1.05, "white", (x0 + 0.5, yf + 1.55, z0 - 0.004), "soffit"))

        self.faces.append({"i": i, "k": k, "type": "front", "pts": [(x0, yf, z0), (x1, yf, z0), (x1, yf, z1), (x0, yf, z1)]})
        if side_len > 0.5:
            ye = yf + min(side_len, 60)
            self.faces.append({"i": i, "k": k, "type": "side", "len": side_len, "pts": [(x0, ye, z0), (x0, yf, z0), (x0, yf, z1), (x0, ye, z1)]})
        if soffit_len > 0.5:
            ye = yf + min(soffit_len, 60)
            self.faces.append({"i": i, "k": k, "type": "soffit", "pts": [(x0, ye, z0), (x1, ye, z0), (x1, yf, z0), (x0, yf, z0)]})

    # ---- side: perforated panels

    def side_panels(self, i, k, x0, yf, z0, side_len):
        r = random.Random(self.seed * 1000003 + i * 1009 + k * 9176 + 2)
        length = min(side_len - RIM_D, 40.0)
        ya = yf + RIM_D
        za = z0 + SLAB
        height = 28 * P
        # which bitmap drives the hole size on this face. Faces at least one module long can carry a pictogram
        long_face = length > 28 * P + 0.01
        tile = SPRITE_AT.get((i, k))
        fill = self.panel_fill.get((i, k))
        if fill:
            tile = fill
        elif tile is None:
            if side_len >= S - 0.01 and r.random() < 0.6:
                tile = pictograms.pick_sprite(r)
            elif long_face:
                tile = r.choice(["up", "down", "low", "fade", "bands"])  # these do not change along the face
            else:
                tile = pictograms.pick_gradient(r)
        sprite = tile in pictograms.SPRITES
        xp = x0 + 0.015
        n = int(math.ceil(length / PANEL - 1e-6))
        for a in range(n):
            u0 = a * PANEL
            u1 = min(length, u0 + PANEL)
            # uv in cells. The bitmap has a 2-cell margin around the 28 used cells.
            # A pictogram fills the first 28 cells and plain small holes carry on behind it; gradients repeat every 3 panels
            if sprite:
                name, ubase = (tile, 2 + a * 8) if a < 4 else ("bg", 2 + (a % 3) * 8)
            else:
                name, ubase = tile, 2 + ((a % 3) if long_face else a) * 8
            tu, tv = pictograms.tile_origin(name)
            for row in range(2):
                v0, v1 = row * height / 2, (row + 1) * height / 2
                g = 0.018
                pts = [
                    (xp, ya + u1 - g, za + v0 + g),
                    (xp, ya + u0 + g, za + v0 + g),
                    (xp, ya + u0 + g, za + v1 - g),
                    (xp, ya + u1 - g, za + v1 - g),
                ]
                if sprite and a < 4:
                    # seen from outside, +Y runs to the left: flip so the picture is not mirrored
                    uvs = [(30 - (p[1] - ya) / P, (p[2] - za) / P + 2) for p in pts]
                else:
                    uvs = [((p[1] - ya - u0) / P + ubase, (p[2] - za) / P + 2) for p in pts]
                self.b["panel"].quad(pts, uvs=uvs, tile_u=tu, tile_v=tv, rnd=r.random(), face=self.panel_tone)
        # the cell grid of the whole face, for the 2D overlay data: (column, row) = (0, 0) at the front bottom corner
        self.faces.append(
            {
                "i": i,
                "k": k,
                "type": "panel",
                "cols": round(length / P),
                "rows": 28,
                "pts": [(xp, ya, za), (xp, ya + length, za), (xp, ya + length, za + height), (xp, ya, za + height)],
            }
        )
        # behind the panels: a dark glass lining. Lit at night, it shines through the holes and the dot picture glows
        lit = 1.0 if (fill or tile in pictograms.SPRITES or r.random() < 0.5) else 0.0
        xg = x0 + STAND - 0.012
        self.b["glow"].quad(
            [(xg, ya + length, za), (xg, ya, za), (xg, ya, za + height), (xg, ya + length, za + height)],
            lit=lit,
        )
        # the subframe the panels hang on
        st = self.b["steel"]
        for row in range(3):
            zz = za + row * height / 2
            st.box((x0 + 0.03, ya, zz - 0.03), (x0 + STAND, ya + length, zz + 0.03), skip="yY")

    # ---- soffit: light fittings

    def soffit_lights(self, x0, x1, yf, z0, soffit_len):
        n = int(min(soffit_len, 30.0) // U)
        for a in range(n):
            y = yf + U * (a + 0.5)
            for fx in (0.25, 0.75):
                x = x0 + (x1 - x0) * fx
                self.b["lamp"].box((x - 0.09, y - 0.09, z0 - 0.03), (x + 0.09, y + 0.09, z0 + 0.01), lit=1.0)
                self.b["steel"].box((x - 0.13, y - 0.13, z0 - 0.018), (x + 0.13, y + 0.13, z0 + 0.01))

    # ---- fronts

    def room(self, x0, x1, yg, z0, z1, lit, levels=2):
        """What is behind the glazing: a back wall, strip lights, desks and screens."""
        r = self.rnd
        c = self.b["concrete"]
        xa, xb = x0 + STAND + WALL, x1 - WALL
        depth = 5.2
        c.box((xa, yg + depth, z0 + SLAB), (xb, yg + depth + 0.2, z1 - SLAB), skip="Y", rnd=0.9)
        h = (z1 - z0 - 2 * SLAB) / levels
        for lv in range(levels):
            zf = z0 + SLAB + lv * h
            zc = zf + h - (0.15 if lv < levels - 1 else 0.0)
            on = lit if r.random() < 0.8 else 1.0 - lit
            for fx in (0.3, 0.7):
                x = xa + (xb - xa) * fx
                self.b["lamp"].box((x - 0.07, yg + 0.5, zc - 0.05), (x + 0.07, yg + depth - 0.4, zc - 0.005), lit=on)
            for _ in range(r.randint(1, 3)):
                dx = r.uniform(xa + 0.3, xb - 1.9)
                dy = yg + r.uniform(0.7, 3.2)
                self.b["steel"].box((dx, dy, zf + 0.7), (dx + 1.5, dy + 0.7, zf + 0.74))
                self.b["steel"].box((dx + 0.05, dy + 0.05, zf), (dx + 0.1, dy + 0.65, zf + 0.7))
                self.b["steel"].box((dx + 1.4, dy + 0.05, zf), (dx + 1.45, dy + 0.65, zf + 0.7))
                mx = dx + r.uniform(0.2, 0.7)
                self.b["glow"].quad(
                    [(mx, dy + 0.5, zf + 0.82), (mx + 0.56, dy + 0.5, zf + 0.82), (mx + 0.56, dy + 0.5, zf + 1.16), (mx, dy + 0.5, zf + 1.16)],
                    lit=1.0 if r.random() < 0.75 else 0.0,
                    face=2.0,
                )

    def railing(self, xa, xb, y, z, height=1.08):
        st = self.b["steel"]
        n = max(2, int(round((xb - xa) / 1.2)))
        for a in range(n + 1):
            x = xa + (xb - xa) * a / n
            st.box((x - 0.02, y - 0.025, z), (x + 0.02, y + 0.025, z + height))
        st.box((xa, y - 0.035, z + height), (xb, y + 0.035, z + height + 0.045))
        for a in range(1, 5):
            zz = z + height * a / 5
            st.box((xa, y - 0.008, zz - 0.008), (xb, y + 0.008, zz + 0.008))

    def glazing(self, xa, xb, yg, za, zb, lit, bays=None):
        """Mullions, a transom, glass, and roller blinds pulled down to different heights."""
        r = self.rnd
        st = self.b["steel"]
        bays = bays or max(2, int(round((xb - xa) / 1.25)))
        w = (xb - xa) / bays
        for a in range(bays + 1):
            x = xa + w * a
            st.box((x - 0.03, yg - 0.08, za), (x + 0.03, yg + 0.06, zb))
        st.box((xa, yg - 0.08, zb - 0.06), (xb, yg + 0.06, zb))
        st.box((xa, yg - 0.08, za), (xb, yg + 0.06, za + 0.08))
        zt = za + 2.15
        if zb - zt > 0.25:
            st.box((xa, yg - 0.06, zt - 0.03), (xb, yg + 0.05, zt + 0.03))
        self.b["glass"].quad([(xa, yg, za), (xb, yg, za), (xb, yg, zb), (xa, yg, zb)])
        for a in range(bays):
            if r.random() < 0.55:
                drop = r.choice([0.25, 0.4, 0.4, 0.6, 0.85, 1.0]) * (zb - za)
                xl, xr = xa + w * a + 0.05, xa + w * (a + 1) - 0.05
                self.b["blind"].quad(
                    [(xl, yg + 0.1, zb - drop), (xr, yg + 0.1, zb - drop), (xr, yg + 0.1, zb - 0.02), (xl, yg + 0.1, zb - 0.02)],
                    rnd=r.random(),
                    lit=lit,
                )

    def two_levels(self, x0, x1, yf, z0, z1, lit, recess):
        """A mezzanine slab with a balcony in front of the glazing line. Returns the inner extents."""
        xa, xb = x0 + STAND + WALL, x1 - WALL
        zm = (z0 + z1) / 2
        c = self.b["concrete"]
        c.box((xa, yf + 0.22, zm - 0.14), (xb, YB, zm + 0.14), skip="Y")
        yg = yf + recess
        self.room(x0, x1, yg, z0, z1, lit)
        return xa, xb, zm, yg

    def front_glass(self, x0, x1, yf, z0, z1, lit):
        recess = self.rnd.choice([1.5, 1.5, 2.25])
        xa, xb, zm, yg = self.two_levels(x0, x1, yf, z0, z1, lit, recess)
        self.glazing(xa, xb, yg, z0 + SLAB, zm - 0.14, lit)
        self.glazing(xa, xb, yg, zm + 0.14, z1 - SLAB, lit)
        self.railing(xa, xb, yf + 0.3, z0 + SLAB)
        self.railing(xa, xb, yf + 0.3, zm + 0.14)

    def front_screen(self, x0, x1, yf, z0, z1, lit):
        """Glazing behind sliding perforated screens, some slid open."""
        r = self.rnd
        xa, xb, zm, yg = self.two_levels(x0, x1, yf, z0, z1, lit, 1.5)
        self.glazing(xa, xb, yg, z0 + SLAB, zm - 0.14, lit)
        self.glazing(xa, xb, yg, zm + 0.14, z1 - SLAB, lit)
        tu, tv = pictograms.tile_origin(pictograms.pick_gradient(r))
        ys = yf + 0.34
        for za, zb in ((z0 + SLAB, zm - 0.14), (zm + 0.14, z1 - SLAB)):
            self.b["steel"].box((xa, ys - 0.04, zb - 0.07), (xb, ys + 0.04, zb))
            self.b["steel"].box((xa, ys - 0.04, za), (xb, ys + 0.04, za + 0.05))
            w = (xb - xa) / 4
            for a in range(4):
                if r.random() < 0.3:
                    continue
                xl = xa + w * a + r.choice([0.0, 0.0, 0.35 * w]) + 0.02
                xr = min(xb, xl + w - 0.04)
                pts = [(xl, ys, za + 0.06), (xr, ys, za + 0.06), (xr, ys, zb - 0.08), (xl, ys, zb - 0.08)]
                uvs = [((p[0] - x0) / P, (p[2] - z0) / P) for p in pts]
                self.b["screen"].quad(pts, uvs=uvs, tile_u=tu, tile_v=tv, rnd=r.random())

    def front_porthole(self, x0, x1, yf, z0, z1, lit):
        """A concrete end wall with one big round window."""
        c = self.b["concrete"]
        yw = yf + 0.42
        t = 0.34
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        rad = 1.72
        xa, xb = x0 + RIM - 0.02, x1 - RIM + 0.02
        za, zb = z0 + RIM - 0.02, z1 - RIM + 0.02
        n = 96
        ring = []
        for a in range(n):
            th = 2 * math.pi * a / n
            dx, dz = math.cos(th), math.sin(th)
            s = min((xb - cx) / abs(dx) if abs(dx) > 1e-9 else 1e9, (zb - cz) / abs(dz) if abs(dz) > 1e-9 else 1e9)
            ring.append(((cx + dx * s, cz + dz * s), (cx + dx * rad, cz + dz * rad), (cx + dx * (rad - 0.07), cz + dz * (rad - 0.07))))
        st = self.b["steel"]
        for a in range(n):
            (o0, c0, s0), (o1, c1, s1) = ring[a], ring[(a + 1) % n]
            c.quad([(o0[0], yw, o0[1]), (o1[0], yw, o1[1]), (c1[0], yw, c1[1]), (c0[0], yw, c0[1])])
            c.quad([(c0[0], yw, c0[1]), (c1[0], yw, c1[1]), (c1[0], yw + t, c1[1]), (c0[0], yw + t, c0[1])])
            # steel ring holding the glass
            st.quad([(c0[0], yw + 0.12, c0[1]), (c1[0], yw + 0.12, c1[1]), (s1[0], yw + 0.12, s1[1]), (s0[0], yw + 0.12, s0[1])])
            st.quad([(s0[0], yw + 0.12, s0[1]), (s1[0], yw + 0.12, s1[1]), (s1[0], yw + 0.3, s1[1]), (s0[0], yw + 0.3, s0[1])])
        st.box((cx - 0.025, yw + 0.14, cz - rad), (cx + 0.025, yw + 0.26, cz + rad))
        st.box((cx - rad, yw + 0.14, cz - 0.025), (cx + rad, yw + 0.26, cz + 0.025))
        g = rad + 0.05
        self.b["glass"].quad([(cx - g, yw + 0.2, cz - g), (cx + g, yw + 0.2, cz - g), (cx + g, yw + 0.2, cz + g), (cx - g, yw + 0.2, cz + g)])
        xa2, xb2 = x0 + STAND + WALL, x1 - WALL
        zm = (z0 + z1) / 2
        c.box((xa2, yw + 1.6, zm - 0.14), (xb2, YB, zm + 0.14), skip="Y")
        self.room(x0, x1, yw + 0.4, z0, z1, lit)

    def front_louver(self, x0, x1, yf, z0, z1, lit):
        """A plant floor: tilted blades across the whole opening."""
        st = self.b["steel"]
        xa, xb = x0 + RIM - 0.02, x1 - RIM + 0.02
        za, zb = z0 + RIM, z1 - RIM
        n = 26
        y = yf + 0.3
        for a in range(n):
            z = za + (zb - za) * (a + 0.5) / n
            st.quad([(xa, y, z - 0.07), (xb, y, z - 0.07), (xb, y + 0.16, z + 0.05), (xa, y + 0.16, z + 0.05)])
        for fx in (0.0, 1 / 3, 2 / 3, 1.0):
            x = xa + (xb - xa) * fx
            st.box((x - 0.035, y - 0.02, za), (x + 0.035, y + 0.2, zb))
        self.b["concrete"].box((xa, yf + 1.4, za), (xb, yf + 1.6, zb), skip="Y", rnd=0.2)
        xm = (xa + xb) / 2
        self.b["lamp"].box((xm - 1.2, yf + 1.3, zb - 0.5), (xm + 1.2, yf + 1.38, zb - 0.38), lit=lit)

    def front_open(self, x0, x1, yf, z0, z1, lit):
        """A loggia: the glazing sits far back, behind a double-height terrace."""
        xa, xb = x0 + STAND + WALL, x1 - WALL
        yg = yf + 4.5
        self.room(x0, x1, yg, z0, z1, lit, levels=1)
        self.glazing(xa, xb, yg, z0 + SLAB, z1 - SLAB, lit, bays=3)
        self.railing(xa, xb, yf + 0.3, z0 + SLAB)
        for fx in (0.3, 0.7):
            x = xa + (xb - xa) * fx
            self.b["lamp"].box((x - 0.16, yf + 2.2, z1 - SLAB - 0.035), (x + 0.16, yf + 2.52, z1 - SLAB + 0.01), lit=1.0)


# ---------------------------------------------------------------- materials


def new_material(name):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt


class NT:
    """Small helpers to write node trees as expressions."""

    def __init__(self, nt):
        self.nt = nt

    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def link(self, a, b):
        self.nt.links.new(a, b)

    def m(self, op, a=None, b=None, c=None, clamp=False):
        n = self.nt.nodes.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                self.nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    def attr(self, name):
        n = self.nt.nodes.new("ShaderNodeAttribute")
        n.attribute_type = "GEOMETRY"
        n.attribute_name = name
        return n.outputs["Fac"]

    def noise(self, vec, scale, detail=4.0, rough=0.55, stretch=None):
        if stretch:
            mp = self.node("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = stretch
            self.link(vec, mp.inputs["Vector"])
            vec = mp.outputs[0]
        n = self.node("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        self.link(vec, n.inputs["Vector"])
        return n.outputs["Fac"]

    def grey(self, v, tint=(1.0, 1.0, 1.0)):
        c = self.node("ShaderNodeCombineColor")
        for i in range(3):
            self.link(self.m("MULTIPLY", v, tint[i]), c.inputs[i])
        return c.outputs[0]

    def ramp(self, v, lo, hi):
        n = self.node("ShaderNodeMapRange")
        n.inputs["From Min"].default_value = lo
        n.inputs["From Max"].default_value = hi
        self.link(v, n.inputs["Value"])
        return n.outputs["Result"]

    def principled(self):
        out = self.node("ShaderNodeOutputMaterial")
        bsdf = self.node("ShaderNodeBsdfPrincipled")
        self.link(bsdf.outputs[0], out.inputs["Surface"])
        return bsdf, out


def concrete_material(night):
    """Board-marked concrete: cloudy tone, rain streaks, formwork joints and tie holes."""
    m, nt = new_material("concrete")
    t = NT(nt)
    bsdf, _ = t.principled()
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    nsep = t.node("ShaderNodeSeparateXYZ")
    t.link(geo.outputs["Normal"], nsep.inputs[0])

    cloud = t.noise(pos, 0.16, 5.0, 0.6)
    fine = t.noise(pos, 2.2, 6.0, 0.65)
    streak = t.noise(pos, 1.0, 5.0, 0.6, stretch=(2.6, 2.6, 0.09))
    grain = t.noise(pos, 38.0, 2.0, 0.5)

    # joints: lines every 1.5 m along each axis, ignored along the axis the face looks down
    def lines(coord, ncomp, period, width):
        d = t.m("ABSOLUTE", t.m("SUBTRACT", t.m("FRACT", t.m("DIVIDE", coord, period)), 0.5))
        on = t.m("GREATER_THAN", d, 0.5 - width / period)
        flat = t.m("LESS_THAN", t.m("ABSOLUTE", ncomp), 0.5)
        return t.m("MULTIPLY", on, flat)

    joint = None
    for comp in "XYZ":
        ln = lines(sep.outputs[comp], nsep.outputs[comp], 1.5, 0.011)
        joint = ln if joint is None else t.m("MAXIMUM", joint, ln)
    board = lines(sep.outputs["Z"], nsep.outputs["Z"], 0.3, 0.004)
    board_y = lines(sep.outputs["Y"], t.m("SUBTRACT", 1.0, t.m("ABSOLUTE", nsep.outputs["Z"])), 0.3, 0.004)
    board = t.m("MAXIMUM", board, board_y)

    # tie holes: a dot grid 0.75 x 0.75 m, drawn in the two axes the face spans
    def dots(c1, c2):
        f1 = t.m("SUBTRACT", t.m("FRACT", t.m("ADD", t.m("DIVIDE", c1, 0.75), 0.5)), 0.5)
        f2 = t.m("SUBTRACT", t.m("FRACT", t.m("ADD", t.m("DIVIDE", c2, 0.75), 0.5)), 0.5)
        d2 = t.m("ADD", t.m("MULTIPLY", f1, f1), t.m("MULTIPLY", f2, f2))
        return t.m("LESS_THAN", d2, (0.022 / 0.75) ** 2)

    ax, ay, az = (t.m("ABSOLUTE", nsep.outputs[c]) for c in "XYZ")
    tie = t.m("MULTIPLY", dots(sep.outputs["Y"], sep.outputs["Z"]), t.m("GREATER_THAN", ax, 0.9))
    tie = t.m("MAXIMUM", tie, t.m("MULTIPLY", dots(sep.outputs["X"], sep.outputs["Z"]), t.m("GREATER_THAN", ay, 0.9)))
    tie = t.m("MAXIMUM", tie, t.m("MULTIPLY", dots(sep.outputs["X"], sep.outputs["Y"]), t.m("GREATER_THAN", az, 0.9)))

    rnd = t.attr("rnd")
    base = t.m("ADD", 0.36, t.m("MULTIPLY", rnd, 0.12))
    tone = t.m("MULTIPLY", base, t.m("ADD", 0.74, t.m("MULTIPLY", t.ramp(cloud, 0.25, 0.75), 0.42)))
    tone = t.m("MULTIPLY", tone, t.m("ADD", 0.86, t.m("MULTIPLY", fine, 0.26)))
    # rain streaks only on walls, darker under the top of each module
    wall = t.m("SUBTRACT", 1.0, az)
    st_mask = t.m("MULTIPLY", t.ramp(streak, 0.5, 0.72), wall)
    tone = t.m("MULTIPLY", tone, t.m("SUBTRACT", 1.0, t.m("MULTIPLY", st_mask, 0.42)))
    down = t.m("LESS_THAN", nsep.outputs["Z"], -0.9)
    blotch = t.ramp(t.noise(pos, 0.45, 5.0, 0.7), 0.42, 0.7)
    tone = t.m("MULTIPLY", tone, t.m("SUBTRACT", 1.0, t.m("MULTIPLY", down, t.m("ADD", 0.08, t.m("MULTIPLY", blotch, 0.2)))))
    tone = t.m("MULTIPLY", tone, t.m("SUBTRACT", 1.0, t.m("MULTIPLY", joint, 0.4)))
    tone = t.m("MULTIPLY", tone, t.m("SUBTRACT", 1.0, t.m("MULTIPLY", tie, 0.55)))
    tone = t.m("MULTIPLY", tone, t.m("SUBTRACT", 1.0, t.m("MULTIPLY", board, 0.07)))
    t.link(t.grey(tone, (1.0, 0.985, 0.955)), bsdf.inputs["Base Color"])
    t.link(t.m("ADD", 0.68, t.m("MULTIPLY", fine, 0.25)), bsdf.inputs["Roughness"])

    h = t.m("MULTIPLY", fine, 0.35)
    h = t.m("ADD", h, t.m("MULTIPLY", grain, 0.08))
    h = t.m("SUBTRACT", h, t.m("MULTIPLY", joint, 0.9))
    h = t.m("SUBTRACT", h, t.m("MULTIPLY", tie, 1.2))
    h = t.m("SUBTRACT", h, t.m("MULTIPLY", board, 0.25))
    bump = t.node("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.012
    t.link(h, bump.inputs["Height"])
    t.link(bump.outputs[0], bsdf.inputs["Normal"])
    return m


def perforated_material(name, atlas, night, tone=0.78):
    """Painted aluminium sheet. The hole in each 0.1875 m cell gets its radius from one texel of the atlas."""
    m, nt = new_material(name)
    t = NT(nt)
    bsdf, _ = t.principled()
    uv = t.node("ShaderNodeUVMap")
    uv.uv_map = "uv"
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(uv.outputs[0], sep.inputs[0])
    cu, cv = sep.outputs["X"], sep.outputs["Y"]  # in cells
    fu = t.m("SUBTRACT", t.m("FRACT", cu), 0.5)
    fv = t.m("SUBTRACT", t.m("FRACT", cv), 0.5)
    dist = t.m("SQRT", t.m("ADD", t.m("MULTIPLY", fu, fu), t.m("MULTIPLY", fv, fv)))

    # atlas lookup: tile origin (per face) + the cell inside the tile
    comb = t.node("ShaderNodeCombineXYZ")
    aw, ah = atlas.size
    t.link(t.m("DIVIDE", t.m("ADD", t.attr("tile_u"), cu), float(aw)), comb.inputs[0])
    t.link(t.m("DIVIDE", t.m("ADD", t.attr("tile_v"), cv), float(ah)), comb.inputs[1])
    tex = t.node("ShaderNodeTexImage")
    tex.image = atlas
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"
    t.link(comb.outputs[0], tex.inputs["Vector"])
    val = tex.outputs["Color"]
    sepc = t.node("ShaderNodeSeparateColor")
    t.link(val, sepc.inputs[0])
    radius = t.m("ADD", 0.13, t.m("MULTIPLY", sepc.outputs[0], 0.33))
    solid = t.m("GREATER_THAN", dist, radius)
    t.link(solid, bsdf.inputs["Alpha"])

    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    cloud = t.noise(pos, 0.5, 4.0, 0.6)
    streak = t.noise(pos, 1.2, 4.0, 0.6, stretch=(3.0, 3.0, 0.12))
    kind = t.attr("face")  # 0 white, 1 grey, 2 graphite
    base = t.m("SUBTRACT", tone, t.m("MULTIPLY", t.m("MINIMUM", kind, 1.0), 0.3))
    base = t.m("SUBTRACT", base, t.m("MULTIPLY", t.m("MAXIMUM", t.m("SUBTRACT", kind, 1.0), 0.0), 0.3))
    v = t.m("ADD", t.m("SUBTRACT", base, 0.07), t.m("MULTIPLY", t.attr("rnd"), 0.1))
    v = t.m("MULTIPLY", v, t.m("ADD", 0.9, t.m("MULTIPLY", cloud, 0.2)))
    v = t.m("MULTIPLY", v, t.m("SUBTRACT", 1.0, t.m("MULTIPLY", t.ramp(streak, 0.55, 0.8), 0.14)))
    if night:
        v = t.m("MULTIPLY", v, 0.8)
    t.link(t.grey(v, (0.985, 1.0, 1.02)), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Coat Weight"].default_value = 0.1
    bsdf.inputs["Coat Roughness"].default_value = 0.3
    # the punched edge of each hole catches a little light
    lip = t.m("MULTIPLY", t.m("LESS_THAN", dist, t.m("ADD", radius, 0.06)), -1.0)
    bump = t.node("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    bump.inputs["Distance"].default_value = 0.004
    t.link(lip, bump.inputs["Height"])
    t.link(bump.outputs[0], bsdf.inputs["Normal"])
    return m


def glass_material():
    """Architectural glazing: mostly a mirror of the sky at grazing angles, a dim view into the room head on."""
    m, nt = new_material("glass")
    t = NT(nt)
    out = t.node("ShaderNodeOutputMaterial")
    glossy = t.node("ShaderNodeBsdfGlossy")
    glossy.inputs["Roughness"].default_value = 0.015
    glossy.inputs["Color"].default_value = (0.9, 0.93, 0.95, 1)
    through = t.node("ShaderNodeBsdfTransparent")
    through.inputs["Color"].default_value = (0.62, 0.68, 0.7, 1)
    fres = t.node("ShaderNodeFresnel")
    fres.inputs["IOR"].default_value = 1.7
    mix = t.node("ShaderNodeMixShader")
    t.link(t.m("ADD", t.m("MULTIPLY", fres.outputs[0], 0.9), 0.06, clamp=True), mix.inputs[0])
    t.link(through.outputs[0], mix.inputs[1])
    t.link(glossy.outputs[0], mix.inputs[2])
    t.link(mix.outputs[0], out.inputs["Surface"])
    return m


def steel_material():
    m, nt = new_material("steel")
    t = NT(nt)
    bsdf, _ = t.principled()
    bsdf.inputs["Base Color"].default_value = (0.035, 0.038, 0.042, 1)
    bsdf.inputs["Metallic"].default_value = 0.6
    bsdf.inputs["Roughness"].default_value = 0.42
    return m


def blind_material(night):
    m, nt = new_material("blind")
    t = NT(nt)
    bsdf, _ = t.principled()
    v = t.m("ADD", 0.62, t.m("MULTIPLY", t.attr("rnd"), 0.16))
    t.link(t.grey(v, (1.0, 0.99, 0.96)), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    if night:
        # a lit room makes its blinds glow
        t.link(t.grey(1.0, (1.0, 0.86, 0.3)), bsdf.inputs["Emission Color"])
        t.link(t.m("MULTIPLY", t.attr("lit"), 2.2), bsdf.inputs["Emission Strength"])
    return m


def emission_material(name, color, strength, off=0.02):
    """Light fittings, screens and the glazing behind the panels. `lit` (per face) switches them on."""
    m, nt = new_material(name)
    t = NT(nt)
    bsdf, _ = t.principled()
    bsdf.inputs["Base Color"].default_value = (off, off, off * 1.1, 1)
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    t.link(t.m("MULTIPLY", t.attr("lit"), strength), bsdf.inputs["Emission Strength"])
    return m


def ground_material():
    m, nt = new_material("ground")
    t = NT(nt)
    bsdf, _ = t.principled()
    bsdf.inputs["Base Color"].default_value = (0.3, 0.3, 0.3, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    return m


def matte_material():
    """For the matte pass: each group of 'front' modules lights up one colour channel."""
    m, nt = new_material("matte")
    t = NT(nt)
    out = t.node("ShaderNodeOutputMaterial")
    em = t.node("ShaderNodeEmission")
    fr = t.attr("front")
    c = t.node("ShaderNodeCombineColor")
    for ch in range(3):
        d = t.m("ABSOLUTE", t.m("SUBTRACT", fr, ch + 1.0))
        t.link(t.m("LESS_THAN", d, 0.5), c.inputs[ch])
    t.link(c.outputs[0], em.inputs["Color"])
    t.link(em.outputs[0], out.inputs["Surface"])
    return m


def paint_material(name, value):
    m, nt = new_material(name)
    t = NT(nt)
    bsdf, _ = t.principled()
    bsdf.inputs["Base Color"].default_value = (value, value, value * 1.03, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    return m


def add_labels(labels, font_path):
    """Module codes painted on the frames (small, dark) and on the big soffits (large, white)."""
    font = bpy.data.fonts.load(font_path) if font_path and os.path.exists(font_path) else None
    mats = {"dark": paint_material("paint_dark", 0.045), "white": paint_material("paint_white", 0.62)}
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for paint in mats:
        bm = bmesh.new()
        for text, height, p, pos, where in labels:
            if p != paint:
                continue
            cu = bpy.data.curves.new("label", "FONT")
            cu.body = text
            cu.size = height
            if font:
                cu.font = font
            ob = bpy.data.objects.new("label", cu)
            me = bpy.data.meshes.new_from_object(ob)
            # front: reads left to right along +X, up +Z. soffit: seen from below, so its top points to -Y
            rot = Matrix.Rotation(math.radians(90 if where == "front" else 180), 4, "X")
            me.transform(Matrix.Translation(pos) @ rot)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
            bpy.data.objects.remove(ob)
            bpy.data.curves.remove(cu)
        me = bpy.data.meshes.new("labels_" + paint)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("labels_" + paint, me)
        ob.data.materials.append(mats[paint])
        bpy.context.scene.collection.objects.link(ob)
    del depsgraph


def make_atlas():
    grid, cols, rows = pictograms.build_atlas()
    w, h = cols * CELLS, rows * CELLS
    img = bpy.data.images.new("perforation", w, h, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    px = []
    for y in range(h):
        for x in range(w):
            v = grid[y][x]
            px.extend((v, v, v, 1.0))
    img.pixels.foreach_set(px)
    img.pack()
    return img


# ---------------------------------------------------------------- light and camera


def setup_world(night, sun_elev, sun_az, sky_strength, sun_strength):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("world")
    scene.world = world
    if world.node_tree is None:
        world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    t = NT(nt)
    out = t.node("ShaderNodeOutputWorld")
    bg = t.node("ShaderNodeBackground")
    if night:
        bg.inputs["Color"].default_value = (0.07, 0.11, 0.2, 1)
        bg.inputs["Strength"].default_value = sky_strength
    else:
        sky = t.node("ShaderNodeTexSky")
        sky.sky_type = "MULTIPLE_SCATTERING"
        sky.sun_disc = False
        sky.sun_elevation = math.radians(sun_elev)
        sky.sun_rotation = math.radians(sun_az)
        sky.air_density = 1.0
        sky.aerosol_density = 2.2
        sky.ozone_density = 1.0
        # an overcast veil: pull the sky towards a flat grey so the shadows stay soft and readable
        mix = t.node("ShaderNodeMix", data_type="RGBA")
        mix.inputs["Factor"].default_value = 0.55
        t.link(sky.outputs[0], mix.inputs["A"])
        mix.inputs["B"].default_value = (0.75, 0.8, 0.88, 1)
        t.link(mix.outputs["Result"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = sky_strength
    t.link(bg.outputs[0], out.inputs["Surface"])

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = sun_strength
    sun_data.angle = math.radians(2.5 if not night else 6.0)
    if night:
        sun_data.color = (0.55, 0.7, 1.0)
    sun = bpy.data.objects.new("sun", sun_data)
    scene.collection.objects.link(sun)
    el, az = math.radians(sun_elev), math.radians(sun_az)
    # direction the light travels
    d = Vector((-math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), -math.sin(el)))
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def setup_camera(loc, target, roll, lens, shift=(0.0, 0.0)):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = lens
    cam_data.sensor_width = 36.0
    cam_data.clip_start = 0.5
    cam_data.clip_end = 2000
    cam_data.shift_x, cam_data.shift_y = shift
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = loc
    d = Vector(target) - Vector(loc)
    q = d.to_track_quat("-Z", "Y")
    cam.rotation_euler = (q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(roll), 4, "Z")).to_euler()
    scene.camera = cam
    return cam


SHOTS = {
    # name: camera position, target, roll (deg), lens (mm)
    # hero: the building fills the upper left, its stepped edge runs from the top right corner down to the bottom left
    "hero": dict(loc=(4.0, -90.0, 22.0), target=(46.0, -60.0, 34.0), roll=24.0, lens=30.0),
}


# ---------------------------------------------------------------- main


def parse_groups(text):
    groups = []
    for part in (text or "").split("/"):
        g = set()
        for item in part.split(";"):
            if item.strip():
                i, k = item.split(",")
                g.add((int(i), int(k)))
        groups.append(g)
    return groups


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", default="hero")
    ap.add_argument("--seed", type=int, default=3)
    ap.add_argument("--res", default="1200x1200")
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--night", action="store_true")
    ap.add_argument("--clay", action="store_true", help="grey materials, to judge form and framing quickly")
    ap.add_argument("--matte", action="store_true", help="render the front-module matte instead of the picture")
    ap.add_argument("--front", default="", help='front modules: "i,k;i,k / i,k" (up to three groups -> R, G, B)')
    ap.add_argument("--cam", default="", help="override: x,y,z,tx,ty,tz,roll,lens")
    ap.add_argument("--sun", default="42,225", help="sun elevation and azimuth in degrees (azimuth 0 = light arriving from +Y)")
    ap.add_argument("--sky", type=float, default=0.3)
    ap.add_argument("--sun-strength", type=float, default=5.5)
    ap.add_argument("--zoom", default="", help="i,k,lens: from the shot's camera position, look at that module with a longer lens")
    ap.add_argument("--shift", default="0,0", help="lens shift x,y as a fraction of the picture width: moves the subject left / up")
    ap.add_argument("--exposure", type=float, default=0.0)
    ap.add_argument("--panel", default="", help='i,k,tile: punch that module\'s whole side face from one flat tile ("full" = every hole open, "bg" = closed)')
    ap.add_argument("--border", default="", help="x0,y0,x1,y1 as fractions of the picture (y down): render only that part, the rest stays empty")
    ap.add_argument("--font", default="/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf", help="font for the painted module codes")
    ap.add_argument("--out", default="")
    ap.add_argument("--data", default="", help="write the 2D positions of the visible faces as JSON")
    ap.add_argument("--save-blend", default="")
    args = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    w, h = (int(v) for v in args.res.split("x"))

    panel_fill = {}
    if args.panel:
        pi, pk, ptile = args.panel.split(",")
        panel_fill[(int(pi), int(pk))] = ptile
    building = Building(args.seed, parse_groups(args.front), panel_fill)
    building.build()

    atlas = make_atlas()
    night = args.night
    if args.clay:
        clay, nt = new_material("clay")
        t = NT(nt)
        bsdf, _ = t.principled()
        bsdf.inputs["Base Color"].default_value = (0.6, 0.6, 0.6, 1)
        mats = {k: clay for k in building.b}
        mats["panel"] = perforated_material("panel", atlas, night)
        mats["screen"] = mats["panel"]
        mats["glass"] = glass_material()
    else:
        lamp_on = 9.0 if night else 0.25
        mats = {
            "concrete": concrete_material(night),
            "panel": perforated_material("panel", atlas, night),
            "screen": perforated_material("screen", atlas, night, tone=0.6),
            "glass": glass_material(),
            "steel": steel_material(),
            "blind": blind_material(night),
            "lamp": emission_material("lamp", (1.0, 0.84, 0.5) if night else (1.0, 0.95, 0.85), lamp_on, off=0.35),
            "glow": emission_material("glow", (1.0, 0.7, 0.02), 1.7 if night else 0.0),
            "paint": steel_material(),
        }
    bevels = {"concrete": 0.025, "steel": 0.0}
    for key, bucket in building.b.items():
        bucket.finish(mats[key], bevel=bevels.get(key, 0.0))

    if not args.clay:
        add_labels(building.labels, args.font)

    ground = Bucket("ground")
    ground.quad([(-400, -500, 0), (500, -500, 0), (500, 300, 0), (-400, 300, 0)])
    gob = ground.finish(ground_material())
    gob.visible_camera = False

    el, az = (float(v) for v in args.sun.split(","))
    if night:
        setup_world(True, 38, az, 1.1 * args.sky, 0.5)
    else:
        setup_world(False, el, az, args.sky, args.sun_strength)

    shot = dict(SHOTS[args.shot])
    if args.cam:
        v = [float(x) for x in args.cam.split(",")]
        shot = dict(loc=tuple(v[0:3]), target=tuple(v[3:6]), roll=v[6], lens=v[7])
    if args.zoom:
        zi, zk, zl = args.zoom.split(",")
        zi, zk = int(zi), int(zk)
        # the corner between the front and the perforated side, half way up
        shot["target"] = (zi * S + 0.6, building.yf(zi, zk) + 1.2, zk * S + S / 2)
        shot["lens"] = float(zl)
    shot["shift"] = tuple(float(v) for v in args.shift.split(","))
    cam = setup_camera(**shot)

    scene.render.engine = "CYCLES"
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.use_persistent_data = False
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.use_denoising = not args.matte
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.transmission_bounces = 4
    scene.cycles.transparent_max_bounces = 12
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.sample_clamp_indirect = 6.0
    scene.cycles.pixel_filter_type = "BLACKMAN_HARRIS"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = args.exposure
    try:
        scene.view_settings.look = "AgX - Base Contrast"
    except TypeError:
        pass
    scene.render.threads_mode = "AUTO"
    if args.border:
        bx0, by0, bx1, by1 = (float(v) for v in args.border.split(","))
        scene.render.use_border = True
        scene.render.use_crop_to_border = False
        scene.render.border_min_x, scene.render.border_max_x = bx0, bx1
        scene.render.border_min_y, scene.render.border_max_y = 1.0 - by1, 1.0 - by0

    if args.matte:
        for ob in scene.objects:
            if ob.name.startswith("labels_"):
                ob.hide_render = True  # they carry no 'front' value and would punch holes in the matte
        bpy.context.view_layer.material_override = matte_material()
        scene.cycles.max_bounces = 0
        scene.cycles.samples = max(16, args.samples)
        scene.cycles.use_adaptive_sampling = False
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
        scene.view_settings.exposure = 0.0

    bpy.context.view_layer.update()

    if args.data:
        data = {"shot": args.shot, "res": [w, h], "faces": []}
        cam_pos = cam.matrix_world.translation
        for f in building.faces:
            pts2 = []
            ok = True
            for p in f["pts"]:
                co = world_to_camera_view(scene, cam, Vector(p))
                if co.z <= 0.5:
                    ok = False
                pts2.append([round(co.x, 5), round(1.0 - co.y, 5)])
            if not ok:
                continue
            centre = sum((Vector(p) for p in f["pts"]), Vector()) / 4
            data["faces"].append(
                {
                    "i": f["i"],
                    "k": f["k"],
                    "type": f["type"],
                    "kind": building.kinds.get((f["i"], f["k"])),
                    "dist": round((centre - cam_pos).length, 3),
                    "len": f.get("len"),
                    "cols": f.get("cols"),
                    "rows": f.get("rows"),
                    "pts": pts2,
                }
            )
        with open(args.data, "w") as fh:
            json.dump(data, fh)

    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    if args.out:
        scene.render.filepath = os.path.abspath(args.out)
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
