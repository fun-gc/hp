"""FUNGC poster: a cantilevered tower of cube modules with perforated metal skins.

Builds the whole scene from code (geometry, procedural materials, sky, sun, camera) and renders it with Cycles.
Run with the bpy wheel (Blender 5.0, Python 3.11) -- see README.md:
  python scene.py --shot hero --res 1800x1800 --samples 128 --out hero.png
  python scene.py --shot night --res 1920x1080 --samples 96 --rim 800 --exposure 0 --out night.png
  python scene.py --shot hero --save-blend fungc-poster.blend   # open and tweak it in Blender
"""

import argparse
import math
import random
import sys

import bpy  # noqa: I001 (bpy has to come first: it sets up bmesh / mathutils)
import bmesh
from mathutils import Matrix, Vector

S = 3.0  # module size (m)
SUN = [65.0, -20.0]  # sun: tilt from zenith, rotation around Z (deg)
SKY = [0.05]  # sky strength (day)
RIM = [2500.0]  # cold area light for the night shot (W)
GAP = 0.10  # gap between modules
FRAME = 0.07  # frame beam thickness


# ---------------------------------------------------------------- utilities


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_material(name):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt


def node(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def link(nt, a, b):
    nt.links.new(a, b)


def math_node(nt, op, a=None, b=None, c=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def attr(nt, name):
    n = nt.nodes.new("ShaderNodeAttribute")
    n.attribute_type = "GEOMETRY"
    n.attribute_name = name
    return n.outputs["Fac"]


# ---------------------------------------------------------------- materials


def perforated_material(night=False):
    """Painted aluminium panels with a dot perforation driven by per-face attributes.

    rmin / rmax: hole radius at the bottom / top of the face (0 = solid)
    dens: holes per face edge
    seed: per-module random value for tone variation
    """
    m, nt = new_material("perforated")
    out = node(nt, "ShaderNodeOutputMaterial")
    bsdf = node(nt, "ShaderNodeBsdfPrincipled")
    link(nt, bsdf.outputs[0], out.inputs["Surface"])

    uv = node(nt, "ShaderNodeUVMap").outputs[0]
    sep = node(nt, "ShaderNodeSeparateXYZ")
    link(nt, uv, sep.inputs[0])
    v = sep.outputs["Y"]

    dens = attr(nt, "dens")
    scaled = node(nt, "ShaderNodeVectorMath", operation="SCALE")
    link(nt, uv, scaled.inputs[0])
    link(nt, dens, scaled.inputs["Scale"])

    vor = node(nt, "ShaderNodeTexVoronoi", voronoi_dimensions="2D", feature="F1", distance="EUCLIDEAN")
    vor.inputs["Scale"].default_value = 1.0
    vor.inputs["Randomness"].default_value = 0.0
    link(nt, scaled.outputs[0], vor.inputs["Vector"])
    dist = vor.outputs["Distance"]

    rmin = attr(nt, "rmin")
    rmax = attr(nt, "rmax")
    span = math_node(nt, "SUBTRACT", rmax, rmin)
    r = math_node(nt, "MULTIPLY_ADD", span, v, rmin)

    lo = math_node(nt, "SUBTRACT", r, 0.035)
    hi = math_node(nt, "ADD", r, 0.035)
    mr = node(nt, "ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
    link(nt, dist, mr.inputs["Value"])
    link(nt, lo, mr.inputs["From Min"])
    link(nt, hi, mr.inputs["From Max"])
    solid = math_node(nt, "LESS_THAN", r, 0.01)
    alpha = math_node(nt, "MAXIMUM", mr.outputs["Result"], solid)
    link(nt, alpha, bsdf.inputs["Alpha"])

    # tone: per-module seed + large-scale weathering noise
    seed = attr(nt, "seed")
    tc = node(nt, "ShaderNodeTexCoord")
    noise = node(nt, "ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.35
    noise.inputs["Detail"].default_value = 6.0
    link(nt, tc.outputs["Object"], noise.inputs["Vector"])
    base = math_node(nt, "MULTIPLY_ADD", seed, 0.42, 0.38)
    weather = math_node(nt, "MULTIPLY_ADD", noise.outputs["Fac"], 0.22, 0.89)
    tone = math_node(nt, "MULTIPLY", base, weather)
    if night:
        tone = math_node(nt, "MULTIPLY", tone, 0.22)
    col = node(nt, "ShaderNodeCombineColor")
    link(nt, tone, col.inputs[0])
    link(nt, math_node(nt, "MULTIPLY", tone, 1.01), col.inputs[1])
    link(nt, math_node(nt, "MULTIPLY", tone, 1.035), col.inputs[2])
    link(nt, col.outputs[0], bsdf.inputs["Base Color"])

    # fine streaks for roughness
    streak = node(nt, "ShaderNodeTexNoise")
    streak.inputs["Scale"].default_value = 9.0
    streak.inputs["Detail"].default_value = 3.0
    link(nt, tc.outputs["Object"], streak.inputs["Vector"])
    rough = math_node(nt, "MULTIPLY_ADD", streak.outputs["Fac"], 0.25, 0.26)
    link(nt, rough, bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = 0.25
    bsdf.inputs["Coat Weight"].default_value = 0.15
    bsdf.inputs["Coat Roughness"].default_value = 0.2

    # panel seams: each face is clad with 3 vertical panels; slight inward bevel at the hole edges
    sep_x = sep.outputs["X"]
    seam_u = math_node(nt, "PINGPONG", math_node(nt, "MULTIPLY", sep_x, 3.0), 0.5)
    seam = math_node(nt, "GREATER_THAN", seam_u, 0.012)
    height = math_node(nt, "MULTIPLY", seam, mr.outputs["Result"])
    bump = node(nt, "ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.45
    bump.inputs["Distance"].default_value = 0.01
    link(nt, height, bump.inputs["Height"])
    link(nt, bump.outputs[0], bsdf.inputs["Normal"])
    return m


def inner_material(night=False):
    """The wall behind the perforated skin: glazing with mullions, or plain concrete.

    glass: 1 = glazing, 0 = concrete
    lit: interior light (night shot)
    """
    m, nt = new_material("inner")
    out = node(nt, "ShaderNodeOutputMaterial")
    glass_bsdf = node(nt, "ShaderNodeBsdfPrincipled")
    conc_bsdf = node(nt, "ShaderNodeBsdfPrincipled")
    mix = node(nt, "ShaderNodeMixShader")
    link(nt, attr(nt, "glass"), mix.inputs[0])
    link(nt, conc_bsdf.outputs[0], mix.inputs[1])
    link(nt, glass_bsdf.outputs[0], mix.inputs[2])

    uv = node(nt, "ShaderNodeUVMap").outputs[0]
    brick = node(nt, "ShaderNodeTexBrick")
    brick.offset = 0.0
    brick.squash = 1.0
    brick.inputs["Scale"].default_value = 3.0
    brick.inputs["Mortar Size"].default_value = 0.035
    brick.inputs["Mortar Smooth"].default_value = 0.1
    brick.inputs["Brick Width"].default_value = 1.0
    brick.inputs["Row Height"].default_value = 0.5
    link(nt, uv, brick.inputs["Vector"])
    mullion = math_node(nt, "SUBTRACT", 1.0, brick.outputs["Fac"])  # 1 on glass, 0 on mullion

    # glass: dark, glossy; mullions lighter aluminium
    gcol = node(nt, "ShaderNodeMix", data_type="RGBA")
    gcol.inputs["A"].default_value = (0.42, 0.43, 0.44, 1)
    gcol.inputs["B"].default_value = (0.015, 0.017, 0.02, 1)
    link(nt, mullion, gcol.inputs["Factor"])
    link(nt, gcol.outputs["Result"], glass_bsdf.inputs["Base Color"])
    grough = math_node(nt, "MULTIPLY_ADD", mullion, -0.4, 0.45)
    link(nt, grough, glass_bsdf.inputs["Roughness"])
    glass_bsdf.inputs["Specular IOR Level"].default_value = 0.7

    if night:
        lit = attr(nt, "lit")
        e = math_node(nt, "MULTIPLY", lit, mullion)
        e = math_node(nt, "MULTIPLY", e, 14.0)
        link(nt, e, glass_bsdf.inputs["Emission Strength"])
        glass_bsdf.inputs["Emission Color"].default_value = (1.0, 0.82, 0.12, 1)
        e2 = math_node(nt, "MULTIPLY", lit, 7.0)
        link(nt, e2, conc_bsdf.inputs["Emission Strength"])
        conc_bsdf.inputs["Emission Color"].default_value = (1.0, 0.82, 0.15, 1)

    tc = node(nt, "ShaderNodeTexCoord")
    noise = node(nt, "ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.5
    noise.inputs["Detail"].default_value = 8.0
    link(nt, tc.outputs["Object"], noise.inputs["Vector"])
    cc = math_node(nt, "MULTIPLY_ADD", noise.outputs["Fac"], 0.12, 0.2)
    ccol = node(nt, "ShaderNodeCombineColor")
    for i in range(3):
        link(nt, cc, ccol.inputs[i])
    link(nt, ccol.outputs[0], conc_bsdf.inputs["Base Color"])
    conc_bsdf.inputs["Roughness"].default_value = 0.85
    link(nt, mix.outputs[0], out.inputs["Surface"])
    return m


def frame_material(night=False):
    m, nt = new_material("frame")
    out = node(nt, "ShaderNodeOutputMaterial")
    bsdf = node(nt, "ShaderNodeBsdfPrincipled")
    link(nt, bsdf.outputs[0], out.inputs["Surface"])
    tc = node(nt, "ShaderNodeTexCoord")
    noise = node(nt, "ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.5
    noise.inputs["Detail"].default_value = 10.0
    link(nt, tc.outputs["Object"], noise.inputs["Vector"])
    t = math_node(nt, "MULTIPLY_ADD", noise.outputs["Fac"], 0.18, 0.66)
    if night:
        t = math_node(nt, "MULTIPLY", t, 0.3)
    col = node(nt, "ShaderNodeCombineColor")
    for i in range(3):
        link(nt, t, col.inputs[i])
    link(nt, col.outputs[0], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Metallic"].default_value = 0.2
    return m


def ground_material():
    m, nt = new_material("ground")
    out = node(nt, "ShaderNodeOutputMaterial")
    bsdf = node(nt, "ShaderNodeBsdfPrincipled")
    link(nt, bsdf.outputs[0], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (0.12, 0.125, 0.13, 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    return m


# ---------------------------------------------------------------- geometry


def layout(seed=7, n=7):
    """Grid positions (i, j, k) of the modules: a stepped ridge with cantilevers and voids."""
    rnd = random.Random(seed)
    mods = set()
    for i in range(n):
        for j in range(n):
            ridge = 9.5 - abs(i - j) * 2.1 - (i + j) * 0.35
            h = int(round(ridge + rnd.uniform(-1.2, 1.2)))
            for k in range(max(0, h)):
                if k > 1 and rnd.random() < 0.09:
                    continue  # voids / loggias
                mods.add((i, j, k))
    # cantilevers: push some upper modules outward with nothing below
    for (i, j, k) in sorted(mods):
        if k >= 3 and rnd.random() < 0.12:
            di, dj = rnd.choice([(1, 0), (0, 1), (-1, 0), (0, -1)])
            cand = (i + di, j + dj, k)
            if cand not in mods:
                mods.add(cand)
    return sorted(mods)


def box_faces(c, h):
    """6 faces of an axis-aligned box centred at c with half size h; v runs upwards on side faces."""
    x, y, z = c
    p = {
        (sx, sy, sz): Vector((x + sx * h, y + sy * h, z + sz * h))
        for sx in (-1, 1)
        for sy in (-1, 1)
        for sz in (-1, 1)
    }
    return [
        # +X
        [p[(1, -1, -1)], p[(1, 1, -1)], p[(1, 1, 1)], p[(1, -1, 1)]],
        # -X
        [p[(-1, 1, -1)], p[(-1, -1, -1)], p[(-1, -1, 1)], p[(-1, 1, 1)]],
        # +Y
        [p[(1, 1, -1)], p[(-1, 1, -1)], p[(-1, 1, 1)], p[(1, 1, 1)]],
        # -Y
        [p[(-1, -1, -1)], p[(1, -1, -1)], p[(1, -1, 1)], p[(-1, -1, 1)]],
        # +Z
        [p[(-1, -1, 1)], p[(1, -1, 1)], p[(1, 1, 1)], p[(-1, 1, 1)]],
        # -Z
        [p[(-1, 1, -1)], p[(1, 1, -1)], p[(1, -1, -1)], p[(-1, -1, -1)]],
    ]


def build_mesh(name, faces_with_attrs, mat):
    """faces_with_attrs: list of (verts[4], {attr: value})."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    names = sorted({k for _, a in faces_with_attrs for k in a})
    layers = {k: bm.faces.layers.float.new(k) for k in names}
    uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for verts, a in faces_with_attrs:
        vs = [bm.verts.new(v) for v in verts]
        f = bm.faces.new(vs)
        for loop, uvc in zip(f.loops, uvs):
            loop[uv_layer].uv = uvc
        for k in names:
            f[layers[k]] = a.get(k, 0.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def beam_faces(a, b, t):
    """Box faces for a beam from a to b (axis aligned) with thickness t."""
    lo = Vector((min(a.x, b.x), min(a.y, b.y), min(a.z, b.z))) - Vector((t, t, t)) / 2
    hi = Vector((max(a.x, b.x), max(a.y, b.y), max(a.z, b.z))) + Vector((t, t, t)) / 2
    c = (lo + hi) / 2
    hx, hy, hz = (hi - lo) / 2
    out = []
    for f in box_faces((0, 0, 0), 1):
        out.append([Vector((c.x + v.x * hx, c.y + v.y * hy, c.z + v.z * hz)) for v in f])
    return out


def build_tower(seed, night):
    rnd = random.Random(seed * 31 + 1)
    mods = layout(seed)
    shell, inner, frames = [], [], []
    half = (S - GAP) / 2
    for (i, j, k) in mods:
        c = Vector((i * S, j * S, k * S + S / 2))
        mseed = rnd.random()
        kind = rnd.random()
        lit = 1.0 if (night and rnd.random() < 0.3) else 0.0
        for fi, f in enumerate(box_faces(c, half)):
            if kind < 0.18:
                a = {"rmin": 0.0, "rmax": 0.0}  # solid white-ish panel
                tone = 0.95 + 0.05 * mseed
            elif kind < 0.55:
                r = rnd.choice([0.22, 0.28, 0.32])
                a = {"rmin": r, "rmax": r}
                tone = mseed
            else:
                lo, hi = rnd.choice([(0.04, 0.42), (0.42, 0.04), (0.0, 0.36)])
                a = {"rmin": lo, "rmax": hi}
                tone = mseed
            a["dens"] = rnd.choice([22.0, 30.0, 38.0])
            a["seed"] = tone
            if fi >= 4:  # top/bottom: no gradient, sparser
                a["rmin"] = a["rmax"] = 0.0 if fi == 5 else min(a["rmax"], 0.25)
            shell.append((f, a))
        ih = half - 0.12
        glass = 1.0 if rnd.random() < 0.6 else 0.0
        for f in box_faces(c, ih):
            inner.append((f, {"glass": glass, "lit": lit}))
        # frame along the 12 edges of the module
        e = half + FRAME / 2
        corners = [Vector((c.x + sx * e, c.y + sy * e, c.z + sz * e)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        for a_i in range(8):
            for b_i in range(a_i + 1, 8):
                d = corners[b_i] - corners[a_i]
                if sum(1 for comp in d if abs(comp) > 1e-6) == 1:
                    for bf in beam_faces(corners[a_i], corners[b_i], FRAME):
                        frames.append((bf, {}))
    build_mesh("shell", shell, perforated_material(night))
    build_mesh("inner", inner, inner_material(night))
    build_mesh("frame", frames, frame_material(night))
    # ground slab
    g = 200
    build_mesh("ground", [([Vector((-g, -g, 0)), Vector((g, -g, 0)), Vector((g, g, 0)), Vector((-g, g, 0))], {})], ground_material())
    return mods


# ---------------------------------------------------------------- world, light, camera


def setup_world(night):
    w = bpy.data.worlds.new("world")
    bpy.context.scene.world = w
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, "ShaderNodeOutputWorld")
    bg = node(nt, "ShaderNodeBackground")
    sky = node(nt, "ShaderNodeTexSky", sky_type="MULTIPLE_SCATTERING")
    sky.sun_disc = False
    sky.sun_elevation = math.radians(8 if night else 38)
    sky.sun_rotation = math.radians(200)
    hs = node(nt, "ShaderNodeHueSaturation")
    hs.inputs["Saturation"].default_value = 0.25 if not night else 0.6
    link(nt, sky.outputs[0], hs.inputs["Color"])
    link(nt, hs.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = SKY[0] if not night else 0.012
    link(nt, bg.outputs[0], out.inputs["Surface"])


def add_sun(night):
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = 3.2 if not night else 0.0
    d.angle = math.radians(1.2)
    ob = bpy.data.objects.new("sun", d)
    ob.rotation_euler = (math.radians(SUN[0]), 0.0, math.radians(SUN[1]))
    bpy.context.scene.collection.objects.link(ob)


def add_camera(loc, target, lens, roll_deg):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.sensor_width = 36
    ob = bpy.data.objects.new("cam", cam)
    bpy.context.scene.collection.objects.link(ob)
    # aim at the target, then roll around the view axis for a diagonal, poster-like composition
    q = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y")
    ob.matrix_world = Matrix.Translation(Vector(loc)) @ q.to_matrix().to_4x4() @ Matrix.Rotation(math.radians(roll_deg), 4, "Z")
    bpy.context.scene.camera = ob
    return ob


SHOTS = {
    # name: (camera location, target, lens, roll)
    "hero": ((30, -20, 8), (10, 8, 20), 62, -40),
    "band": ((44, -34, 8), (9, 9, 18), 60, -45),
    "detail": ((28, -18, 6), (8, 9, 16), 90, -42),
    "detail2": ((20, -20, 4), (7, 7, 20), 70, -30),
    "night": ((34, -26, 4), (9, 9, 22), 45, -35),
}


def main():
    argv = sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot", default="hero")
    ap.add_argument("--res", default="960x600")
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="out.png")
    ap.add_argument("--exposure", type=float, default=0.3)
    ap.add_argument("--sun", default=None, help="tilt,azimuth")
    ap.add_argument("--sky", type=float, default=None)
    ap.add_argument("--rim", type=float, default=None)
    ap.add_argument("--save-blend", default=None, help="save the scene as a .blend file and skip rendering")
    ap.add_argument("--cam", default=None, help="override: x,y,z,tx,ty,tz,lens,roll")
    a = ap.parse_args(argv)

    night = a.shot == "night"
    if a.sun:
        SUN[:] = [float(v) for v in a.sun.split(",")]
    if a.sky is not None:
        SKY[0] = a.sky
    if a.rim is not None:
        RIM[0] = a.rim
    reset()
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = a.samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.015
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception as e:  # noqa: BLE001
        print("denoiser:", e)
    sc.cycles.max_bounces = 8
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 4
    sc.cycles.transparent_max_bounces = 24
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    w, h = (int(x) for x in a.res.split("x"))
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception as e:  # noqa: BLE001
        print("color management:", e)
    sc.view_settings.exposure = a.exposure
    sc.render.image_settings.file_format = "PNG"

    build_tower(a.seed, night)
    setup_world(night)
    add_sun(night)
    if a.cam:
        x, y, z, tx, ty, tz, lens, roll = (float(v) for v in a.cam.split(","))
        add_camera((x, y, z), (tx, ty, tz), lens, roll)
    else:
        loc, tgt, lens, roll = SHOTS[a.shot]
        add_camera(loc, tgt, lens, roll)
    if night:
        # a cold rim from the city and a warm street glow
        d = bpy.data.lights.new("rim", "AREA")
        d.energy = RIM[0]
        d.size = 30
        d.color = (0.55, 0.65, 0.9)
        ob = bpy.data.objects.new("rim", d)
        ob.location = (-30, 40, 60)
        ob.rotation_euler = (math.radians(-40), math.radians(-30), 0)
        sc.collection.objects.link(ob)
    sc.render.filepath = a.out
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=a.save_blend)
        return
    bpy.ops.render.render(write_still=True)
    print("view_transform", sc.view_settings.view_transform, "look", sc.view_settings.look, "denoiser", sc.cycles.denoiser)


main()
