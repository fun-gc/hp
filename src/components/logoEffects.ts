// トップのロゴを押したときの演出(炎・草木・電気)を canvas に描く。
// 座標はロゴの SVG(viewBox 0 0 1210 1280)と同じ単位で扱い、描画時に canvas のピクセルへ変換する。

export type FxKind = "fire" | "plant" | "electric";

type Vec = { x: number; y: number };

// 立方体の頂点
const P = {
  l: { x: 158, y: 402 },
  c: { x: 610, y: 646 },
  r: { x: 1062, y: 402 },
  bl: { x: 158, y: 898 },
  b: { x: 610, y: 1140 },
  br: { x: 1062, y: 898 },
};

// 面が飛び出したときのずれ(InteractiveLogo の push と同じ値)
export const FACE_OFFSET: Record<FxKind, Vec> = {
  fire: { x: 0, y: -60 },
  plant: { x: -52, y: 30 },
  electric: { x: 52, y: 30 },
};

export const FX_DURATION = 2.6; // 秒

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

interface Effect {
  kind: FxKind;
  // f は 60fps を 1 とした経過フレーム数、sec は経過秒。描くものが残っていれば true
  update(f: number, sec: number): boolean;
  draw(ctx: CanvasRenderingContext2D): void;
}

/* ---------- 炎: 赤い面と側面の隙間から噴き出す ---------- */

type Flame = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; seed: number; ember: boolean };

function flameColor(t: number): [number, number, number, number] {
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);
  let rgb: number[];
  if (t < 0.15) rgb = mix([255, 236, 140], [255, 196, 40], t / 0.15);
  else if (t < 0.45) rgb = mix([255, 196, 40], [255, 110, 20], (t - 0.15) / 0.3);
  else if (t < 0.75) rgb = mix([255, 120, 20], [237, 28, 36], (t - 0.45) / 0.3);
  else rgb = mix([237, 28, 36], [70, 62, 62], (t - 0.75) / 0.25);
  const alpha = t < 0.75 ? 0.95 * (1 - t * 0.35) : 0.5 * (1 - t);
  return [rgb[0], rgb[1], rgb[2], alpha];
}

class Fire implements Effect {
  kind = "fire" as const;
  age = 0;
  parts: Flame[] = [];
  spawnAcc = 0;

  update(f: number, sec: number) {
    this.age += sec;
    if (this.age < FX_DURATION - 0.4) {
      // 立ち上がりと終わりは少し弱める
      const strength = Math.min(1, this.age / 0.25) * Math.min(1, (FX_DURATION - 0.4 - this.age) / 0.5);
      this.spawnAcc += 14 * strength * f;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        this.spawn();
      }
    }
    for (const p of this.parts) {
      p.life += f;
      p.vy -= (p.ember ? 0.02 : 0.05) * f;
      p.x += (p.vx + Math.sin(p.life * 0.22 + p.seed) * (p.ember ? 1.2 : 0.7)) * f;
      p.y += p.vy * f;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    return this.age < FX_DURATION || this.parts.length > 0;
  }

  spawn() {
    // 赤い面が持ち上がってできた 2 本の隙間のどこか
    const [a, b] = Math.random() < 0.5 ? [P.l, P.c] : [P.c, P.r];
    const base = lerp(a, b, rand(0.04, 0.96));
    const ember = Math.random() < 0.12;
    this.parts.push({
      x: base.x + rand(-6, 6),
      y: base.y - rand(0, 55),
      vx: rand(-0.7, 0.7),
      vy: ember ? rand(-7, -4) : rand(-5.2, -2),
      life: 0,
      max: ember ? rand(70, 110) : rand(40, 70),
      size: ember ? rand(5, 9) : rand(30, 58),
      seed: rand(0, Math.PI * 2),
      ember,
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const t = p.life / p.max;
      if (p.ember) {
        const flicker = 0.5 + 0.5 * Math.sin(p.life * 0.9 + p.seed);
        ctx.fillStyle = `rgba(255, ${Math.round(200 - t * 120)}, 40, ${(1 - t) * (0.5 + flicker * 0.5)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const [r, g, b, a] = flameColor(t);
      const radius = p.size * (t < 0.75 ? 1 - t * 0.55 : 0.6 + (t - 0.75) * 1.6);
      // 縦に伸ばした炎の舌にする
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 1.7);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`);
      grad.addColorStop(0.55, `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a * 0.6})`);
      grad.addColorStop(1, `rgba(${r | 0}, ${g | 0}, ${b | 0}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ---------- 草木: 緑の面のまわりから生えて、しばらくすると引っ込む ---------- */

type Blade = { base: Vec; angle: number; len: number; width: number; delay: number; color: string; seed: number };
type Branch = { a: Vec; b: Vec; level: number; width: number };
type Leaf = { p: Vec; r: number; color: string; level: number };
type Tree = { branches: Branch[]; leaves: Leaf[]; depth: number; delay: number };
type FallingLeaf = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; max: number; color: string };

const greens = ["#22b14c", "#178a3a", "#5fcf6f", "#0f6b2c", "#8bdc72"];

function buildTree(base: Vec, angle: number, len: number, depth: number, delay: number): Tree {
  const branches: Branch[] = [];
  const leaves: Leaf[] = [];
  const grow = (p: Vec, ang: number, l: number, level: number) => {
    const q = { x: p.x + Math.cos(ang) * l, y: p.y + Math.sin(ang) * l };
    branches.push({ a: p, b: q, level, width: Math.max(3, 16 * Math.pow(0.68, level)) });
    if (level === depth) {
      for (let i = 0; i < 3; i++) {
        leaves.push({ p: { x: q.x + rand(-14, 14), y: q.y + rand(-14, 10) }, r: rand(12, 22), color: pick(greens), level });
      }
      return;
    }
    const n = Math.random() < 0.3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const spread = n === 2 ? (i === 0 ? -1 : 1) * rand(0.28, 0.55) : (i - 1) * rand(0.35, 0.6);
      grow(q, ang + spread, l * rand(0.66, 0.8), level + 1);
    }
  };
  grow(base, angle, len, 0);
  return { branches, leaves, depth, delay };
}

class Plant implements Effect {
  kind = "plant" as const;
  age = 0;
  blades: Blade[] = [];
  trees: Tree[] = [];
  falling: FallingLeaf[] = [];
  time = 0;

  constructor() {
    const off = FACE_OFFSET.plant;
    // 赤い面との隙間から上へ
    for (let i = 0; i < 34; i++) {
      this.blades.push({
        base: add(lerp(P.l, P.c, rand(0.03, 0.97)), off),
        angle: -Math.PI / 2 + rand(-0.4, 0.4),
        len: rand(36, 96),
        width: rand(7, 12),
        delay: rand(0, 0.45),
        color: pick(greens),
        seed: rand(0, Math.PI * 2),
      });
    }
    // 左の辺から外へ
    for (let i = 0; i < 16; i++) {
      this.blades.push({
        base: add(lerp(P.l, P.bl, rand(0.05, 0.95)), off),
        angle: Math.PI + rand(-0.75, -0.25),
        len: rand(36, 90),
        width: rand(7, 11),
        delay: rand(0.1, 0.55),
        color: pick(greens),
        seed: rand(0, Math.PI * 2),
      });
    }
    this.trees.push(buildTree(add(lerp(P.l, P.c, 0.3), off), -Math.PI / 2 + rand(-0.1, 0.05), rand(95, 115), 5, 0.1));
    this.trees.push(buildTree(add(lerp(P.l, P.c, 0.72), off), -Math.PI / 2 + rand(-0.05, 0.1), rand(80, 100), 5, 0.25));
    this.trees.push(buildTree(add(lerp(P.l, P.bl, 0.55), off), Math.PI + rand(-0.6, -0.45), rand(75, 90), 4, 0.35));
  }

  // 0 → 1 で伸びきり、最後の 0.6 秒で引っ込む
  growth(delay: number, speed = 1.1) {
    const up = clamp01((this.age - delay) / speed);
    const down = clamp01((FX_DURATION - this.age) / 0.6);
    const eased = 1 - Math.pow(1 - up, 3);
    return Math.min(eased, down);
  }

  update(f: number, sec: number) {
    this.age += sec;
    this.time += f;
    if (this.age > 1.1 && this.age < FX_DURATION - 0.5 && Math.random() < 0.18 * f) {
      const tree = pick(this.trees);
      const leaf = pick(tree.leaves);
      this.falling.push({
        x: leaf.p.x,
        y: leaf.p.y,
        vx: rand(-1.2, 0.4),
        vy: rand(0.4, 1.2),
        rot: rand(0, Math.PI),
        vr: rand(-0.1, 0.1),
        life: 0,
        max: rand(60, 100),
        color: leaf.color,
      });
    }
    for (const l of this.falling) {
      l.life += f;
      l.x += (l.vx + Math.sin(l.life * 0.08) * 0.8) * f;
      l.y += l.vy * f;
      l.rot += l.vr * f;
    }
    this.falling = this.falling.filter((l) => l.life < l.max);
    return this.age < FX_DURATION || this.falling.length > 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const bl of this.blades) {
      const g = this.growth(bl.delay, 0.7);
      if (g <= 0) continue;
      const sway = Math.sin(this.time * 0.05 + bl.seed) * 0.12;
      const ang = bl.angle + sway;
      const len = bl.len * g;
      const tip = { x: bl.base.x + Math.cos(ang) * len, y: bl.base.y + Math.sin(ang) * len };
      const nx = -Math.sin(bl.angle) * (bl.width / 2);
      const ny = Math.cos(bl.angle) * (bl.width / 2);
      const bend = { x: (bl.base.x + tip.x) / 2 + Math.cos(ang + 0.6) * len * 0.15, y: (bl.base.y + tip.y) / 2 + Math.sin(ang + 0.6) * len * 0.15 };
      ctx.fillStyle = bl.color;
      ctx.beginPath();
      ctx.moveTo(bl.base.x + nx, bl.base.y + ny);
      ctx.quadraticCurveTo(bend.x, bend.y, tip.x, tip.y);
      ctx.quadraticCurveTo(bend.x, bend.y, bl.base.x - nx, bl.base.y - ny);
      ctx.closePath();
      ctx.fill();
    }

    for (const tree of this.trees) {
      const g = this.growth(tree.delay, 1.2) * (tree.depth + 1.4);
      ctx.strokeStyle = "#5a3b22";
      ctx.lineCap = "round";
      for (const br of tree.branches) {
        const k = clamp01(g - br.level);
        if (k <= 0) continue;
        ctx.lineWidth = br.width;
        ctx.beginPath();
        ctx.moveTo(br.a.x, br.a.y);
        ctx.lineTo(br.a.x + (br.b.x - br.a.x) * k, br.a.y + (br.b.y - br.a.y) * k);
        ctx.stroke();
      }
      const leafK = clamp01(g - tree.depth - 0.4);
      if (leafK > 0) {
        for (const lf of tree.leaves) {
          ctx.fillStyle = lf.color;
          ctx.beginPath();
          ctx.arc(lf.p.x, lf.p.y, lf.r * leafK, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const l of this.falling) {
      ctx.save();
      ctx.globalAlpha = 1 - l.life / l.max;
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ---------- 電気: 黄色い面の辺を稲妻が走り、火花が散る ---------- */

type Bolt = { pts: Vec[]; life: number; max: number; width: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number };

function jagged(a: Vec, b: Vec, roughness: number, depth = 5): Vec[] {
  if (depth === 0) return [a, b];
  const mid = lerp(a, b, rand(0.4, 0.6));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const d = rand(-1, 1) * roughness;
  mid.x += (-dy / len) * d;
  mid.y += (dx / len) * d;
  const left = jagged(a, mid, roughness / 2, depth - 1);
  const right = jagged(mid, b, roughness / 2, depth - 1);
  return [...left, ...right.slice(1)];
}

class Electric implements Effect {
  kind = "electric" as const;
  age = 0;
  bolts: Bolt[] = [];
  sparks: Spark[] = [];
  flash = 0;
  boltAcc = 0;
  off = FACE_OFFSET.electric;
  corners = [P.c, P.r, P.br, P.b].map((p) => add(p, FACE_OFFSET.electric));
  center = add({ x: 836, y: 771 }, FACE_OFFSET.electric);

  update(f: number, sec: number) {
    this.age += sec;
    if (this.age < FX_DURATION - 0.3) {
      this.boltAcc += f;
      if (this.boltAcc >= 2.5) {
        this.boltAcc = 0;
        const n = Math.random() < 0.5 ? 2 : 3;
        for (let i = 0; i < n; i++) this.spawnBolt();
        if (Math.random() < 0.35) this.flash = 1;
      }
    }
    for (const b of this.bolts) b.life += f;
    this.bolts = this.bolts.filter((b) => b.life < b.max);
    for (const s of this.sparks) {
      s.life += f;
      s.vy += 0.28 * f;
      s.x += s.vx * f;
      s.y += s.vy * f;
    }
    this.sparks = this.sparks.filter((s) => s.life < s.max);
    this.flash = Math.max(0, this.flash - 0.18 * f);
    return this.age < FX_DURATION || this.bolts.length > 0 || this.sparks.length > 0;
  }

  edgePoint(): Vec {
    const i = Math.floor(Math.random() * 4);
    return lerp(this.corners[i], this.corners[(i + 1) % 4], Math.random());
  }

  spawnBolt() {
    const kind = Math.random();
    let a: Vec;
    let b: Vec;
    if (kind < 0.45) {
      // 辺に沿って走る
      const i = Math.floor(Math.random() * 4);
      const t0 = rand(0, 0.5);
      a = lerp(this.corners[i], this.corners[(i + 1) % 4], t0);
      b = lerp(this.corners[i], this.corners[(i + 1) % 4], Math.min(1, t0 + rand(0.35, 0.6)));
    } else if (kind < 0.75) {
      // 面の外へ飛び出す
      a = this.edgePoint();
      const ang = Math.atan2(a.y - this.center.y, a.x - this.center.x) + rand(-0.6, 0.6);
      const len = rand(110, 260);
      b = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    } else {
      // 面を横切る
      a = this.edgePoint();
      b = this.edgePoint();
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    this.bolts.push({ pts: jagged(a, b, Math.max(30, length * 0.22)), life: 0, max: rand(8, 13), width: rand(0.9, 1.4) });
    for (let i = 0; i < 4; i++) {
      const ang = rand(0, Math.PI * 2);
      const sp = rand(2.5, 7);
      this.sparks.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, life: 0, max: rand(18, 34) });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flash * 0.45})`;
      ctx.beginPath();
      this.corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
    }

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const b of this.bolts) {
      const alpha = 1 - b.life / b.max;
      const trace = () => {
        ctx.beginPath();
        b.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      };
      // 黄色い面の上でも見えるよう、細い墨色のふちを付ける
      trace();
      ctx.strokeStyle = `rgba(23, 24, 28, ${0.85 * alpha})`;
      ctx.lineWidth = 22 * b.width;
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = "rgba(255, 242, 0, 0.9)";
      ctx.shadowBlur = 24;
      trace();
      ctx.strokeStyle = `rgba(255, 242, 0, ${alpha})`;
      ctx.lineWidth = 14 * b.width;
      ctx.stroke();
      ctx.restore();
      trace();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 5 * b.width;
      ctx.stroke();
    }

    ctx.lineWidth = 6;
    for (const s of this.sparks) {
      const t = s.life / s.max;
      ctx.strokeStyle = t < 0.4 ? `rgba(255, 255, 255, ${1 - t})` : `rgba(255, 210, 0, ${1 - t})`;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 2, s.y - s.vy * 2);
      ctx.stroke();
    }
  }
}

/* ---------- まとめて動かす ---------- */

// canvas はロゴより MARGIN ぶん外側まで広げて、はみ出した演出も描けるようにしている
export const FX_MARGIN = 0.25;

export class LogoFx {
  private effects: Effect[] = [];
  private raf = 0;
  private last = 0;

  constructor(private canvas: HTMLCanvasElement) {}

  play(kind: FxKind) {
    this.effects = this.effects.filter((e) => e.kind !== kind);
    this.effects.push(kind === "fire" ? new Fire() : kind === "plant" ? new Plant() : new Electric());
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.effects = [];
  }

  private tick = (now: number) => {
    const sec = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const f = sec * 60;
    this.effects = this.effects.filter((e) => e.update(f, sec));

    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ロゴ本体の大きさ(canvas は上下左右に MARGIN ずつ広い)
    const logoW = w / (1 + FX_MARGIN * 2);
    const logoH = h / (1 + FX_MARGIN * 2);
    const scale = (logoW / 1210) * dpr;
    ctx.setTransform(scale, 0, 0, scale, logoW * FX_MARGIN * dpr, logoH * FX_MARGIN * dpr);
    // 炎を最後に描くと草木や電気の上に重なって見やすい
    for (const kind of ["plant", "electric", "fire"] as const) {
      for (const e of this.effects) if (e.kind === kind) e.draw(ctx);
    }

    this.raf = this.effects.length > 0 ? requestAnimationFrame(this.tick) : 0;
    if (!this.raf) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}
