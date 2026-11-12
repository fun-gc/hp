// 建物の穴あきパネル(横 76 × 縦 28 個の穴)をドット画面にして遊ぶ、ボタン 1 つのランゲームの中身。
// ここでは画面に触れない。時間を進めて(step)、どの穴を開くか(draw。1 = 開いた穴 = 黒い点)を決めるだけで、
// 実際に描くのは src/components/PanelGame.tsx。
//
// 流れ: boot(パネルの「人」の絵がほどけて、小さな走者が降りてくる)→ title(PRESS ANY BUTTON)→ run → over → run …
//       leave() を呼ぶと exit(画面が「人」の絵に戻る)→ done。
// 走者はパネルの「人」の絵を小さくしたもの、障害物は THE STACK の箱。地面の箱は跳び越え、吊られた箱は跳ばずに下を走り抜ける。
// 長さの単位は穴 1 つ、時間は秒。

export const COLS = 76;
export const ROWS = 28;
/** 画面。COLS × ROWS 個の穴を、左上から 1 行ずつ並べたもの(1 = 開く) */
export type Screen = Uint8Array;
export type Phase = "boot" | "title" | "run" | "over" | "exit" | "done";

type Bitmap = readonly string[];

/**
 * パネルにもともと出ている絵。右端の 28 列が「人」(tools/poster-render/pictograms.py の person と同じ形)で、
 * その 4 列左に、アトラスで 1 つ前にあるタイル(縞)の端の 2 列がのぞいている。写真とぴったり同じにしておく
 */
const PERSON: Bitmap = [
  "....................................",
  "....................................",
  "....................................",
  "....................####............",
  "....##.............######...........",
  "....##............########..........",
  "....##............########..........",
  "....##............########..........",
  "..................########..........",
  "...................######...........",
  "....................####............",
  "....................................",
  "....##............########..........",
  "....##............########..........",
  "....##............########..........",
  "....##...........##########.........",
  ".................##########.........",
  "................############........",
  "................############........",
  "...............##############.......",
  "....##.........##############.......",
  "....##.........##############.......",
  "....##........################......",
  "....##........################......",
  ".............##################.....",
  ".............##################.....",
  "....................................",
  "....................................",
];
const PERSON_X = COLS - 36;

/** 地面の線の行(上から数えて) */
const FLOOR = 25;

// ---- 走者: 「人」の絵と同じ、丸い頭と台形の体 ----
const RUNNER_X = 8;
const RUNNER_W = 7;
const RUNNER_H = 10;
const BODY: Bitmap = ["..###..", ".#####.", "..###..", ".......", "..###..", ".#####.", ".#####.", "#######"];
const LEGS: Record<"stand" | "a" | "b" | "jump", Bitmap> = {
  stand: ["..#.#..", "..#.#.."],
  a: ["..#.#..", "..#...."],
  b: ["..#.#..", "....#.."],
  jump: [".#...#.", "......."],
};

const GRAVITY = 235;
/**
 * 踏み切りの速さ。高さ 12.3、滞空 0.65 秒。押している長さでは変えない
 * (軽く押しただけの小さな跳び方だと、箱を 1 つも越えられなかった。どう押しても同じだけ跳ぶ)
 */
const JUMP = 76;
const SPEED_MIN = 34;
const SPEED_MAX = 68;
const ACCEL = 0.85;

// ---- 障害物: 1 辺 4 の箱(THE STACK の箱)を並べたり積んだりしたもの ----
const BOX = 4;
/** 箱の左下の位置(x は障害物の左端から、y は地面からの高さ) */
type Kind = { w: number; boxes: readonly (readonly [number, number])[]; from: number; hung?: boolean };
const KINDS = {
  one: { w: 4, boxes: [[0, 0]], from: 0 },
  two: { w: 8, boxes: [[0, 0], [4, 0]], from: 0 },
  // 上の箱が手前へせり出す。建物と同じ積み方
  stack: { w: 6, boxes: [[2, 0], [0, 4]], from: 38 },
  three: { w: 12, boxes: [[0, 0], [4, 0], [8, 0]], from: 44 },
  // 梁から吊られた箱。走者の頭より上にあるので、跳ばなければ当たらない
  hung: { w: 4, boxes: [[0, 12]], from: 44, hung: true },
  stair: { w: 8, boxes: [[0, 0], [4, 0], [4, 4]], from: 52 },
} satisfies Record<string, Kind>;
type KindName = keyof typeof KINDS;
/** 出やすさ。from(この速さから出る)を満たすものの中から選ぶ */
const POOL: KindName[] = ["one", "one", "two", "stack", "stack", "three", "hung", "hung", "stair"];

// ---- 遠くを流れる函館山。輪郭を 1 つおきの点で描く ----
const RIDGE_W = 56;
const RIDGE_EVERY = 132;
const RIDGE: number[] = (() => {
  // tools/poster-render/backdrop.py の RIDGE と同じ稜線(横 0〜1、高さ 0〜1)
  const pts = [[0, 0.03], [0.22, 0.05], [0.28, 0.12], [0.33, 0.3], [0.38, 0.5], [0.43, 0.62], [0.48, 0.7], [0.53, 0.8], [0.58, 0.93], [0.62, 1], [0.66, 0.97], [0.7, 0.86], [0.74, 0.8], [0.78, 0.72], [0.82, 0.52], [0.86, 0.3], [0.9, 0.12], [0.94, 0.04], [1, 0.02]]; // prettier-ignore
  return Array.from({ length: RIDGE_W }, (_, i) => {
    const x = i / (RIDGE_W - 1);
    const n = pts.findIndex((p) => p[0] >= x);
    const [a, b] = [pts[Math.max(0, n - 1)], pts[n]];
    const y = a === b ? a[1] : a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    return Math.round(y * 7);
  });
})();
/** 山頂のアンテナ(稜線の左端からの位置) */
const MASTS = [33, 35, 37];

// ---- 文字。点数は 3 × 5、ひとことは 5 × 7 ----
type Font = { glyphs: Record<string, string>; w: number; space: number };
const SMALL: Font = {
  w: 3,
  space: 2,
  glyphs: {
    H: "#.#/#.#/###/#.#/#.#",
    I: "###/.#./.#./.#./###",
    "0": "###/#.#/#.#/#.#/###",
    "1": ".#./##./.#./.#./###",
    "2": "###/..#/###/#../###",
    "3": "###/..#/###/..#/###",
    "4": "#.#/#.#/###/..#/..#",
    "5": "###/#../###/..#/###",
    "6": "###/#../###/#.#/###",
    "7": "###/..#/..#/..#/..#",
    "8": "###/#.#/###/#.#/###",
    "9": "###/#.#/###/..#/###",
  },
};
const BIG: Font = {
  w: 5,
  space: 3,
  glyphs: {
    A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
    B: "####./#...#/#...#/####./#...#/#...#/####.",
    E: "#####/#..../#..../####./#..../#..../#####",
    G: ".###./#...#/#..../#.###/#...#/#...#/.###.",
    M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#",
    N: "#...#/##..#/##..#/#.#.#/#..##/#..##/#...#",
    O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
    P: "####./#...#/#...#/####./#..../#..../#....",
    R: "####./#...#/#...#/####./#.#../#..#./#...#",
    S: ".####/#..../#..../.###./....#/....#/####.",
    T: "#####/..#../..#../..#../..#../..#../..#..",
    U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
    V: "#...#/#...#/#...#/#...#/#...#/.#.#./..#..",
    Y: "#...#/#...#/.#.#./..#../..#../..#../..#..",
  },
};
const textWidth = (text: string, font: Font) => [...text].reduce((w, ch) => w + (ch === " " ? font.space : font.w) + 1, -1);

/** 穴ごとに決まった 0〜1 の値。ほどける順番や、地面の小石に使う */
function noise(c: number, r: number) {
  let h = Math.imul(c, 374761393) ^ Math.imul(r, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const on = (s: Screen, c: number, r: number) => {
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) s[r * COLS + c] = 1;
};

function blit(s: Screen, rows: Bitmap, x: number, y: number) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === "#") on(s, x + i, y + j);
  });
}

function clear(s: Screen, x: number, y: number, w: number, h: number) {
  for (let r = Math.max(0, y); r < Math.min(ROWS, y + h); r++) s.fill(0, r * COLS + Math.max(0, x), r * COLS + Math.min(COLS, x + w));
}

function text(s: Screen, str: string, x: number, y: number, font: Font) {
  for (const ch of str) {
    if (ch !== " ") blit(s, (font.glyphs[ch] ?? "").split("/"), x, y);
    x += (ch === " " ? font.space : font.w) + 1;
  }
}

/** 大きな文字のひとこと。走者の右(MSG_X から右端まで)のまん中に置く */
const MSG_X = 18;
const message = (s: Screen, str: string, y: number) => text(s, str, MSG_X + Math.floor((COLS - MSG_X - textWidth(str, BIG)) / 2), y, BIG);
const pad5 = (n: number) => String(Math.min(n, 99999)).padStart(5, "0");
/** 点数の幅と、「HI 00000」の幅 */
const SCORE_W = textWidth("00000", SMALL);
const HI_W = textWidth("HI 00000", SMALL);

export class Runner {
  phase: Phase = "boot";
  score = 0;
  /** これまでの最高点。記録を塗り替えた回は record が立つ */
  hi: number;
  record = false;

  /** いまの場面に入ってからの秒数 */
  private t = 0;
  private dist = 0;
  private speed = SPEED_MIN;
  /** 走者の足もとの高さと、上向きの速さ */
  private y = 0;
  private vy = 0;
  private air = false;
  /** 着地の少し前に押したぶんを、着地してすぐの踏み切りに回す(残り秒数) */
  private buffer = 0;
  private obstacles: { x: number; kind: KindName }[] = [];
  /** 次の障害物を出すまでの距離 */
  private gap = 0;
  /** 100 点ごとに、点数を点滅させる残り秒数 */
  private flash = 0;
  /** exit に入ったときの画面。ここから「人」の絵へ戻す */
  private frozen: Screen | null = null;
  private readonly random: () => number;

  constructor(hi = 0, random: () => number = Math.random) {
    this.hi = hi;
    this.random = random;
  }

  /** ボタンを押した */
  press() {
    if (this.phase === "title" || (this.phase === "over" && this.t > 0.6)) {
      this.start();
      this.jump();
    } else if (this.phase === "run") {
      if (this.air) this.buffer = 0.12;
      else this.jump();
    }
  }

  /** 遊ぶのをやめる。画面を「人」の絵に戻し終えると phase が done になる */
  leave() {
    if (this.phase === "exit" || this.phase === "done") return;
    const now = new Uint8Array(COLS * ROWS);
    this.draw(now);
    this.frozen = now;
    this.phase = "exit";
    this.t = 0;
  }

  private start() {
    this.phase = "run";
    this.t = 0;
    this.dist = 0;
    this.score = 0;
    this.record = false;
    this.speed = SPEED_MIN;
    this.y = 0;
    this.vy = 0;
    this.air = false;
    this.buffer = 0;
    this.flash = 0;
    this.obstacles = [];
    this.gap = 26;
  }

  private jump() {
    this.air = true;
    this.vy = JUMP;
    this.buffer = 0;
  }

  /** dt 秒だけ進める */
  step(dt: number) {
    // 当たり判定をすり抜けないよう、細かく刻む
    for (let left = Math.min(dt, 0.1); left > 1e-6; left -= 1 / 120) this.tick(Math.min(left, 1 / 120));
  }

  private tick(dt: number) {
    this.t += dt;
    if (this.phase === "boot" && this.t >= 1.25) this.enter("title");
    if (this.phase === "exit" && this.t >= 0.6) this.enter("done");
    if (this.phase !== "run") return;

    this.speed = Math.min(SPEED_MAX, SPEED_MIN + ACCEL * this.t);
    const dx = this.speed * dt;
    this.dist += dx;
    const score = Math.floor(this.dist / 4);
    if (Math.floor(score / 100) > Math.floor(this.score / 100)) this.flash = 0.9;
    this.score = score;
    this.flash = Math.max(0, this.flash - dt);

    if (this.air) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      this.buffer = Math.max(0, this.buffer - dt);
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.air = false;
        if (this.buffer > 0) this.jump();
      }
    }

    for (const o of this.obstacles) o.x -= dx;
    this.obstacles = this.obstacles.filter((o) => o.x + KINDS[o.kind].w > -1);
    this.gap -= dx;
    if (this.gap <= 0) this.spawn();

    if (this.hit()) {
      this.record = this.score > this.hi;
      this.hi = Math.max(this.hi, this.score);
      this.enter("over");
    }
  }

  private enter(phase: Phase) {
    this.phase = phase;
    this.t = 0;
  }

  private spawn() {
    const pool = POOL.filter((k) => KINDS[k].from <= this.speed);
    const kind = pool[Math.floor(this.random() * pool.length)];
    this.obstacles.push({ x: COLS + 1, kind });
    // 次までの間。跳んで着地してから、もう一度踏み切れるだけは必ず空ける。速くなるほど、時間で見た間は詰まる
    const ease = (this.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
    this.gap = KINDS[kind].w + this.speed * (0.95 - 0.27 * ease + this.random() * 0.8);
  }

  /** 走者の当たり判定(絵より少し小さい四角)が、どれかの箱に重なっているか */
  private hit() {
    const [x0, x1] = [RUNNER_X + 1, RUNNER_X + RUNNER_W - 1];
    const [y0, y1] = [this.y, this.y + RUNNER_H - 1];
    for (const o of this.obstacles) {
      for (const [bx, by] of KINDS[o.kind].boxes) {
        if (x0 < o.x + bx + BOX && x1 > o.x + bx && y0 < by + BOX && y1 > by) return true;
      }
    }
    return false;
  }

  /** いまの画面を s に描く */
  draw(s: Screen) {
    s.fill(0);
    const t = this.t;
    if (this.phase === "done") return this.person(s, () => true);
    if (this.phase === "exit") {
      // 遊んでいた画面がほどけて消え、「人」の絵が点から組み上がる
      const frozen = this.frozen!;
      for (let i = 0; i < s.length; i++) s[i] = frozen[i] && noise(i % COLS, Math.floor(i / COLS) + 40) >= t / 0.3 ? 1 : 0;
      return this.person(s, (c, r) => noise(c, r) < (t - 0.12) / 0.42);
    }
    if (this.phase === "boot") {
      // 「人」の絵がほどけ、地面の線が左から引かれ、走者が上から降りてくる
      this.person(s, (c, r) => noise(c, r) >= t / 0.6);
      this.ground(s, Math.round(((t - 0.2) / 0.55) * COLS));
      if (t >= 0.65) this.runner(s, Math.max(0, 17 - (GRAVITY / 2) * (t - 0.65) ** 2), t < 1.03 ? "jump" : "stand");
      return;
    }

    this.ridge(s);
    this.ground(s, COLS);
    for (const o of this.obstacles) this.obstacle(s, Math.round(o.x), KINDS[o.kind]);

    if (this.phase === "title") {
      this.runner(s, 0, "stand");
      if (this.hi > 0) text(s, `HI ${pad5(this.hi)}`, COLS - 1 - HI_W, 1, SMALL);
      if (t % 0.9 < 0.58) {
        message(s, "PRESS ANY", 7);
        message(s, "BUTTON", 15);
      }
      return;
    }

    const over = this.phase === "over";
    // 当たった直後は、走者を点滅させる
    if (!over || t > 0.6 || t % 0.2 < 0.1) this.runner(s, this.y, this.air ? "jump" : over ? "stand" : Math.floor(this.dist / 5) % 2 ? "a" : "b");
    if (over && t > 0.35) {
      // 後ろの山や箱を四角く消して、その上に書く
      clear(s, MSG_X + 1, 6, COLS - MSG_X - 3, 11);
      message(s, "GAME OVER", 8);
    }
    // 点数(右上)と、その左に最高点。100 点ごとと、記録を塗り替えたときは点滅させる
    const blink = this.flash > 0 ? this.flash % 0.3 < 0.15 : over && this.record && t % 0.5 < 0.25;
    clear(s, COLS - SCORE_W - 2, 0, SCORE_W + 2, 7);
    if (!blink) text(s, pad5(this.score), COLS - 1 - SCORE_W, 1, SMALL);
    if (this.hi > 0) {
      clear(s, COLS - SCORE_W - HI_W - 6, 0, HI_W + 2, 7);
      text(s, `HI ${pad5(this.hi)}`, COLS - SCORE_W - HI_W - 5, 1, SMALL);
    }
  }

  private person(s: Screen, show: (c: number, r: number) => boolean) {
    PERSON.forEach((row, r) => {
      for (let i = 0; i < row.length; i++) if (row[i] === "#" && show(PERSON_X + i, r)) on(s, PERSON_X + i, r);
    });
  }

  /** 地面の線と、その下を流れる小石。左から upto 列まで */
  private ground(s: Screen, upto: number) {
    const scroll = Math.floor(this.dist);
    for (let c = 0; c < Math.min(COLS, upto); c++) {
      on(s, c, FLOOR);
      if (noise(c + scroll, 1) < 0.1) on(s, c, FLOOR + 1);
      if (noise(c + scroll, 2) < 0.07) on(s, c, FLOOR + 2);
    }
  }

  /** 遠くの函館山。地面よりずっとゆっくり流れる */
  private ridge(s: Screen) {
    // 走り始めは、山が画面の右のほうに見えている
    const scroll = Math.floor(this.dist * 0.07) + RIDGE_EVERY - 52;
    for (let c = 0; c < COLS; c++) {
      const x = (c + scroll) % RIDGE_EVERY;
      if (x >= RIDGE_W || RIDGE[x] < 1) continue;
      if (x % 2 === 0) on(s, c, FLOOR - 1 - RIDGE[x]);
      if (MASTS.includes(x)) on(s, c, FLOOR - 3 - RIDGE[x]);
    }
  }

  private runner(s: Screen, y: number, legs: keyof typeof LEGS) {
    const top = FLOOR - RUNNER_H - Math.round(y);
    blit(s, BODY, RUNNER_X, top);
    blit(s, LEGS[legs], RUNNER_X, top + BODY.length);
  }

  private obstacle(s: Screen, x: number, kind: Kind) {
    for (const [bx, by] of kind.boxes) {
      const top = FLOOR - by - BOX;
      // 箱のまわりの点を消してから描く(後ろの山と混ざらないように)
      clear(s, x + bx, top, BOX, BOX);
      for (let i = 0; i < BOX; i++) {
        on(s, x + bx + i, top);
        on(s, x + bx + i, top + BOX - 1);
        on(s, x + bx, top + i);
        on(s, x + bx + BOX - 1, top + i);
      }
      // 吊っている金具: 短いワイヤーと、その上の梁
      if (kind.hung) {
        on(s, x + bx + 1, top - 1);
        on(s, x + bx + 2, top - 1);
        for (let i = -1; i <= BOX; i++) on(s, x + bx + i, top - 2);
      }
    }
  }
}
