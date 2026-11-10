"""ポップ案の 3D 版。色の箱(タイル)の中に、FUNGC の文字とキャラクターを置いて Cycles でレンダーする。

使い方:
  .venv-render/bin/python tools/pop-mock/scene3d.py --out tools/pop-mock/render/wall-3d.png
  .venv-render/bin/python tools/pop-mock/scene3d.py --res 720x382 --samples 24 --out /tmp/test.png   # 下見

長さは index.html の 100px を 1 として組む。壁は 14.4 × 7.64、タイルは 3.6 × 3.82。
X が右、Z が上、Y が奥(箱の口が Y = 0)。
"""
import argparse
import math
import sys

import bpy  # bmesh と mathutils は bpy を読み込んだあとでないと使えない
import bmesh  # noqa: E402, I001
from mathutils import Vector  # noqa: E402
from shapely.geometry import Polygon  # noqa: E402

W, H = 14.4, 7.64  # 壁
TW, TH = 3.6, 3.82  # タイル
DEPTH = 2.2  # 箱の奥行き
CAM = Vector((7.2, -14.0, 7.2))  # カメラ。壁の少し上から見下ろし、レンズのシフトで壁をまっすぐ収める
GLOW = 0.14  # 箱の内側をどれだけ自分の色で光らせるか
Y0, Y1 = 0.55, 1.35  # 文字の手前の面と奥の面
YM = (Y0 + Y1) / 2

PAPER, INK = "#fff6df", "#1b1b33"
RED, YELLOW, GREEN, BLUE, PINK = "#ed1c24", "#fff200", "#22b14c", "#2a5cff", "#ff8fc8"


# ---------------------------------------------------------------- 素材
def lin(hexcol):
    h = hexcol.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


_mats = {}


def mat(hexcol, rough=0.42, coat=0.0, glow=0.0):
    key = (hexcol, rough, coat, glow)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f"m{hexcol}-{rough}-{coat}-{glow}")
    if m.node_tree is None:
        m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    b.inputs["Base Color"].default_value = (*lin(hexcol), 1.0)
    b.inputs["Roughness"].default_value = rough
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.12
    if glow:
        # 箱の奥の影で色がにごらないよう、地の色でほんの少しだけ光らせる
        b.inputs["Emission Color"].default_value = (*lin(hexcol), 1.0)
        b.inputs["Emission Strength"].default_value = glow
    _mats[key] = m
    return m


# ---------------------------------------------------------------- 形をつくる道具
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def obj_from_bm(name, bm, material, smooth=True):
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    me.materials.append(material)
    return link(bpy.data.objects.new(name, me))


def soften(ob, width, segments=6):
    """角を丸め、平らな面はきれいに平らなまま見せる"""
    b = ob.modifiers.new("bevel", "BEVEL")
    b.width = width
    b.segments = segments
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(40)
    weighted_normals(ob)
    return ob


def dedupe(pts):
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 1e-6 or abs(p[1] - out[-1][1]) > 1e-6):
            out.append(p)
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-6 and abs(out[0][1] - out[-1][1]) < 1e-6:
        out.pop()
    return out


def weighted_normals(ob):
    w = ob.modifiers.new("normals", "WEIGHTED_NORMAL")
    w.keep_sharp = True
    w.weight = 100


def sharpen_by_angle(me, deg=38):
    """面どうしの角度が大きい辺だけ、角をくっきり見せる(それ以外はなめらかにつなぐ)"""
    bm = bmesh.new()
    bm.from_mesh(me)
    limit = math.radians(deg)
    for e in bm.edges:
        e.smooth = len(e.link_faces) == 2 and e.calc_face_angle(0.0) < limit
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True


def rounded(pts, r):
    """輪郭の角(出っぱりもへこみも)を半径 r で丸める"""
    poly = Polygon(pts)
    if r:
        poly = poly.buffer(-r, quad_segs=10).buffer(2 * r, quad_segs=10).buffer(-r, quad_segs=10)
    poly = poly.simplify(0.0015)
    return list(poly.exterior.coords)[:-1]


def prism(name, pts_xz, y0, y1, material, bevel=0.06, corner=0.08):
    """XZ 平面の輪郭を奥行き方向に押し出し、ふちを丸めた立体。
    ベベルのモディファイアは G や C のような輪郭で面が壊れたので、カーブの押し出しでつくる"""
    pts = rounded(dedupe(pts_xz), corner)
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = (y1 - y0) / 2 - bevel
    cu.bevel_depth = bevel
    cu.bevel_resolution = 5
    cu.offset = -bevel  # ふちの丸みのぶん先に縮めておき、外形を輪郭どおりに保つ
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for q, (x, z) in zip(sp.points, pts):
        q.co = (x, z, 0.0, 1.0)
    sp.use_cyclic_u = True
    tmp = link(bpy.data.objects.new(name + "-curve", cu))
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    sharpen_by_angle(me)
    me.materials.clear()
    me.materials.append(material)
    ob = link(bpy.data.objects.new(name, me))
    # カーブの平面(XY)を壁の面(XZ)に立てる
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.location = (0, (y0 + y1) / 2, 0)
    weighted_normals(ob)
    return ob


def sphere(name, center, r, material, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=r)
    ob = obj_from_bm(name, bm, material)
    ob.location = center
    ob.scale = scale
    return ob


def box(name, center, size, material, bevel=0.08, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    ob = obj_from_bm(name, bm, material)
    ob.location = center
    ob.rotation_euler = [math.radians(a) for a in rot]
    # 大きさは頂点に焼き込む(丸めの幅が軸ごとに変わらないように)
    for v in ob.data.vertices:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel:
        soften(ob, bevel, segments=8)
    return ob


def tube(name, pts, r, material):
    """点の列をなめらかにつないだ細い棒(手足)"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1.0)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(pts))
    sp.resolution_u = 12
    cu.materials.append(material)
    return link(bpy.data.objects.new(name, cu))


def eyes(name, centers, r=0.04):
    for i, c in enumerate(centers):
        sphere(f"{name}-eye{i}", c, r, mat(INK, 0.25), scale=(1, 0.55, 1))


def legs(name, x, y, z_floor, length, gap=0.11, foot=0.085):
    m = mat(INK, 0.5)
    r = 0.017
    for s in (-1, 1):
        tube(f"{name}-leg{s}", [(x + s * gap, y, z_floor + length + 0.03), (x + s * gap, y, z_floor + r), (x + s * (gap + 0.005), y, z_floor + r), (x + s * (gap + foot), y, z_floor + r)], r, m)


# ---------------------------------------------------------------- 文字の輪郭(index.html の SVG と同じ。300 × 300、y は下向き)
def arc(cx, cy, r, a0, a1, n=24):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


GLYPH = {
    "F": [(0, 0), (300, 0)] + arc(200, 0, 100, 0, 90) + [(100, 100), (100, 300), (0, 300)],
    "U": [(0, 0), (100, 0), (100, 200), (200, 200), (200, 0), (300, 0), (300, 200)] + arc(200, 200, 100, 0, 90) + [(100, 300)] + arc(100, 200, 100, 90, 180),
    "G": [(100, 0), (200, 0)] + arc(200, 100, 100, -90, 0) + [(100, 100), (100, 200), (300, 200)] + arc(200, 200, 100, 0, 90) + [(100, 300)] + arc(100, 200, 100, 90, 180) + [(0, 100)] + arc(100, 100, 100, 180, 270),
    "C": [(100, 0), (300, 0)] + arc(200, 0, 100, 0, 90) + [(100, 100), (100, 200), (200, 200)] + arc(200, 300, 100, -90, 0) + [(100, 300)] + arc(100, 200, 100, 90, 180) + [(0, 100)] + arc(100, 100, 100, 180, 270),
}


class Tile:
    """タイル 1 枚。col は左から 0〜3、row は上が 0"""

    def __init__(self, col, row, cols=1):
        self.x0 = col * TW
        self.x1 = self.x0 + cols * TW
        self.z1 = H - row * TH
        self.z0 = self.z1 - TH

    def g(self, gx, gy):
        """文字の座標(300 × 300、y 下向き)を、床に置いた文字の XZ にする"""
        return (self.x0 + 0.3 + gx / 100, self.z0 + (300 - gy) / 100)

    def niche(self, color):
        """口の開いた箱"""
        m = mat(color, 0.85, glow=GLOW)
        e = 0.015  # となりの箱の壁と重ならないよう、少しだけ内側に寄せる(すき間は HTML の区切りの線に隠れる)
        x0, x1, z0, z1 = self.x0 + e, self.x1 - e, self.z0 + e, self.z1 - e
        quads = [
            [(x0, DEPTH, z0), (x1, DEPTH, z0), (x1, DEPTH, z1), (x0, DEPTH, z1)],  # 奥
            [(x0, 0, z0), (x1, 0, z0), (x1, DEPTH, z0), (x0, DEPTH, z0)],  # 床
            [(x0, 0, z1), (x1, 0, z1), (x1, DEPTH, z1), (x0, DEPTH, z1)],  # 天井
            [(x0, 0, z0), (x0, DEPTH, z0), (x0, DEPTH, z1), (x0, 0, z1)],  # 左
            [(x1, 0, z0), (x1, DEPTH, z0), (x1, DEPTH, z1), (x1, 0, z1)],  # 右
        ]
        bm = bmesh.new()
        for q in quads:
            bm.faces.new([bm.verts.new(v) for v in q])
        obj_from_bm(f"niche-{color}", bm, m, smooth=False)

    def panel(self, color):
        """口をふさぐ平らな面(文章やメニューを HTML で重ねるところ)"""
        bm = bmesh.new()
        bm.faces.new([bm.verts.new(v) for v in [(self.x0, 0, self.z0), (self.x1, 0, self.z0), (self.x1, 0, self.z1), (self.x0, 0, self.z1)]])
        obj_from_bm(f"panel-{color}", bm, mat(color, 0.85), smooth=False)


def project(p):
    """シーンの点が、壁の画像(1440 × 764)のどこに写るか"""
    s = -CAM.y / (-CAM.y + p[1])
    return (round((CAM.x + (p[0] - CAM.x) * s) * 100, 1), round((H - (CAM.z + (p[2] - CAM.z) * s)) * 100, 1))


# ---------------------------------------------------------------- シーン
def build():
    anchors = {}
    toy = dict(rough=0.38, coat=0.25)

    # --- F:まんなかの腕は、四角いキャラクターが持ち上げているボール
    t = Tile(0, 0)
    t.niche(RED)
    prism("F", [t.g(*p) for p in GLYPH["F"]], Y0, Y1, mat(PAPER, **toy))
    bx, bz = t.g(150, 150)
    sphere("F-ball", (bx, YM, bz), 0.5, mat(YELLOW, **toy))
    cz = t.z0 + 0.24 + 0.28
    box("prog", (bx, YM, cz), (0.56, 0.56, 0.56), mat(BLUE, **toy), bevel=0.1)
    eyes("prog", [(bx - 0.095, YM - 0.28, cz + 0.1), (bx + 0.095, YM - 0.28, cz + 0.1)])
    legs("prog", bx, YM, t.z0, 0.24)
    for s in (-1, 1):
        tube(f"prog-arm{s}", [(bx + s * 0.27, YM, cz + 0.16), (bx + s * 0.4, YM, cz + 0.22), (bx + s * 0.43, YM, cz + 0.42), (bx + s * 0.34, YM, cz + 0.58), (bx + s * 0.27, YM, cz + 0.62)], 0.017, mat(INK, 0.5))
    anchors["F-top-left"] = project((t.x0 + 0.3, Y0, t.z0 + 3.0))

    # --- U:コップの中に丸いキャラクター
    t = Tile(1, 0)
    t.niche(YELLOW)
    prism("U", [t.g(*p) for p in GLYPH["U"]], Y0, Y1, mat(BLUE, **toy))
    sx, sz = t.g(150, 200)
    sz += 0.4
    sphere("sound", (sx, YM, sz), 0.4, mat(RED, **toy))
    ex, ez = 0.1, 0.12
    ey = YM - math.sqrt(0.4**2 - ex**2 - ez**2)
    eyes("sound", [(sx - ex, ey, sz + ez), (sx + ex, ey, sz + ez)])
    anchors["U-head"] = project((sx, YM, sz + 0.4))
    anchors["U-top-left"] = project((t.x0 + 0.3, Y0, t.z0 + 3.0))

    # --- N:斜めの線はすべり台
    t = Tile(2, 0)
    t.niche(PINK)
    prism("N-l", [t.g(0, 0), t.g(100, 0), t.g(100, 300), t.g(0, 300)], Y0, Y1, mat(RED, **toy))
    prism("N-r", [t.g(200, 0), t.g(300, 0), t.g(300, 300), t.g(200, 300)], Y0, Y1, mat(RED, **toy))
    prism("N-slide", [t.g(0, 0), t.g(100, 0), t.g(300, 300), t.g(200, 300)], Y0 - 0.09, Y1 + 0.09, mat(PAPER, **toy))
    a = math.radians(56.31)
    px, py = 152, 78

    def on_slope(lx, ly):
        return t.g(px + lx * math.cos(a) - ly * math.sin(a), py + lx * math.sin(a) + ly * math.cos(a))

    ty0, ty1 = Y0 - 0.2, Y0 + 0.28  # すべり台の手前の面より前に出して、全身が見えるようにする
    prism("art", [on_slope(-25, 0), on_slope(0, -44), on_slope(25, 0)], ty0, ty1, mat(GREEN, **toy), bevel=0.045, corner=0.05)

    def tri(lx, ly):
        x, z = on_slope(lx, ly)
        return (x, ty0, z)

    eyes("art", [tri(-4, -14), tri(8, -14)], r=0.037)
    anchors["N-lines"] = [[project(tri(-37, -7)), project(tri(-52, -7))], [project(tri(-33, -21)), project(tri(-45, -21))], [project(tri(-26, -35)), project(tri(-35, -35))]]

    # --- G:最後のピースをはめるところ
    t = Tile(2, 1)
    t.niche(GREEN)
    prism("G", [t.g(*p) for p in GLYPH["G"]], Y0, Y1, mat(PAPER, **toy))
    gx, gz = t.g(225, 175)
    piece_c = (gx + 0.25, 0.2, gz + 0.5)
    box("piece", piece_c, (1.5, 0.8, 0.5), mat(YELLOW, **toy), bevel=0.07, rot=(7, -9, -13))
    anchors["G-piece"] = project(piece_c)
    anchors["G-slot"] = [project((gx - 0.75, Y0, gz + 0.25)), project((gx + 0.75, Y0, gz - 0.25))]

    # --- C:入口で手を振るキャラクター
    t = Tile(3, 1)
    t.niche(BLUE)
    prism("C", [t.g(*p) for p in GLYPH["C"]], Y0, Y1, mat(PINK, **toy))
    dx, dz = t.g(152, 200)
    r = 0.3
    dy = Y0 + 0.3  # 下の腕の上の、手前寄りに立つ
    dome = [(dx + r * math.cos(math.radians(180 + 180 * i / 32)), dz + 0.18 - r * math.sin(math.radians(180 + 180 * i / 32))) for i in range(33)]
    prism("plan", dome, dy - 0.23, dy + 0.23, mat(YELLOW, **toy), bevel=0.045, corner=0.04)
    eyes("plan", [(dx - 0.05, dy - 0.23, dz + 0.32), (dx + 0.13, dy - 0.23, dz + 0.32)], r=0.037)
    legs("plan", dx, dy, dz, 0.18, gap=0.1, foot=0.08)
    ink = mat(INK, 0.5)
    tube("plan-arm-r", [(dx + 0.27, dy, dz + 0.26), (dx + 0.36, dy, dz + 0.3), (dx + 0.41, dy, dz + 0.4), (dx + 0.4, dy, dz + 0.54)], 0.017, ink)
    tube("plan-arm-l", [(dx - 0.27, dy, dz + 0.26), (dx - 0.35, dy, dz + 0.24), (dx - 0.38, dy, dz + 0.16), (dx - 0.375, dy, dz + 0.1)], 0.017, ink)
    anchors["C-hand"] = project((dx + 0.4, dy, dz + 0.54))
    anchors["C-head"] = project((dx, dy - 0.23, dz + 0.48))

    # --- 文章とメニューの面
    Tile(0, 1, cols=2).panel(PAPER)
    Tile(3, 0).panel(INK)
    return anchors


def setup(res, samples, sun_dir, sun_strength, ambient):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.01
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception as e:  # noqa: BLE001
        print("denoiser:", e)
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 4
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    # 画面の色(CSS の色)と並べて使うので、色を寝かせない Standard で出す
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1

    w = bpy.data.worlds.new("world")
    sc.world = w
    if w.node_tree is None:
        w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(bg.outputs[0], nt.nodes.new("ShaderNodeOutputWorld").inputs["Surface"])
    bg.inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    bg.inputs["Strength"].default_value = ambient

    d = bpy.data.lights.new("sun", "SUN")
    d.energy = sun_strength
    d.angle = math.radians(20)
    sun = link(bpy.data.objects.new("sun", d))
    sun.rotation_euler = Vector(sun_dir).normalized().to_track_quat("-Z", "Y").to_euler()

    cam = bpy.data.cameras.new("cam")
    cam.sensor_fit = "HORIZONTAL"
    cam.sensor_width = 36
    cam.lens = 36 * -CAM.y / W
    cam.shift_x = (W / 2 - CAM.x) / W
    cam.shift_y = (H / 2 - CAM.z) / W
    cam.clip_start, cam.clip_end = 0.5, 100
    ob = link(bpy.data.objects.new("cam", cam))
    ob.location = CAM
    ob.rotation_euler = (math.radians(90), 0, 0)
    sc.camera = ob


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="wall-3d.png")
    ap.add_argument("--res", default="2880x1528")
    ap.add_argument("--samples", type=int, default=160)
    ap.add_argument("--sun", default="0.24,1,-0.32", help="光の向き(X,Y,Z)")
    ap.add_argument("--sun-strength", type=float, default=1.8)
    ap.add_argument("--ambient", type=float, default=0.5)
    ap.add_argument("--save-blend", default=None)
    a = ap.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    anchors = build()
    setup([int(v) for v in a.res.split("x")], a.samples, [float(v) for v in a.sun.split(",")], a.sun_strength, a.ambient)
    import json

    print("anchors", json.dumps(anchors))
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.save_blend)
        return
    import os

    bpy.context.scene.render.filepath = os.path.abspath(a.out)
    bpy.ops.render.render(write_still=True)
    print("書き出しました:", a.out)


if __name__ == "__main__":
    main()
