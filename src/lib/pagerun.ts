// パネルから飛び出した走者が、ページの上を走るゲームの中身(PAGE RUN)。
// パネルのランゲーム(src/lib/runner.ts)で BREAK_AT 点まで走ると、走者がパネルの右端から跳んで外へ出る。
// その続きを、ページの見出しや作品カード、お知らせの行を足場にして走り、下の「HOW TO JOIN」のボタンに着地すればクリア。
// ここでは画面に触れない。時間を進めて(step)、走者がどこにいるかを決めるだけで、描くのは src/components/PageRun.tsx。
//
// 長さの単位は CSS の px で、ページの左上が原点(下向きが +y)。時間は秒。
// 走者はいつも走っていて、画面の左右の端で向きを変える。ボタンで跳び、↓ で足場をすり抜けて下りる。
// 足場は上からだけ乗れる(下からは突き抜けて跳び上がれる)。
// 夜の建物の下の端(bounce)はトランポリンで、乗るとゴールより少し上まで跳ね上がる。ゴールを跳び越して下まで落ちても戻れる。
// (src/lib/pagerun.test.mjs から Node でそのまま読むので、このファイルはほかのファイルを import しない。
//  コンストラクタ引数の private などの TypeScript だけの書き方は Node で読めない)

export type Rect = { x: number; y: number; w: number; h: number };
/** ledge: ただの足場、card: 作品カード(乗ると集めたことになる)、goal: ゴール、bounce: 下の端で跳ね返す */
export type LedgeKind = "ledge" | "card" | "goal" | "bounce";
export type Ledge = Rect & { id: number; kind: LedgeKind };
export type Legs = "stand" | "a" | "b" | "jump";
export type PagePhase = "fly" | "run" | "clear";

/** 走者の絵の大きさ(穴の数)。runner.ts の RUNNER_W と RUNNER_H と同じ */
const W = 7;
const H = 10;

/** 動きの速さ。ドット 1 つの大きさ(dot px)を単位にする */
const GRAVITY = 520;
/** 高さ 26 ドット、滞空 0.63 秒 */
const JUMP = 165;
const SPEED = 46;
/** 飛び出したときの勢いを、ふだんの速さまで落とす速さ */
const SETTLE = 3;
/** 着地の少し前に押したぶんは、着地してすぐの踏み切りに回す(秒) */
const BUFFER = 0.12;
/** 足場から走り出たあとも、少しのあいだは跳べる(秒) */
const COYOTE = 0.08;
/** パネルの大きさから、ページの大きさまで縮む時間 */
const SHRINK = 0.5;

export type Start = {
  /** 走者の足もとのまん中 */
  x: number;
  y: number;
  /** 速さ(px/秒。vy は下向きが +) */
  vx: number;
  vy: number;
  /** 飛び出した瞬間のドット 1 つの大きさ(パネルの穴の間隔) */
  scale: number;
};

export class PageRun {
  phase: PagePhase = "fly";
  /** 走者の足もとのまん中 */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 右向きなら 1 */
  dir: 1 | -1;
  air = true;
  /** いま描くドット 1 つの大きさ。飛び出した直後はパネルの大きさで、だんだん dot に縮む */
  scale: number;
  /** 始めてからの秒数(クリアしたところで止まる) */
  time = 0;
  /** 乗った作品カード(Ledge の id) */
  readonly cards = new Set<number>();
  /** 足場に乗ったときに呼ぶ(乗った足場を光らせたり、カードを集めたりするのに使う) */
  onLand?: (ledge: Ledge) => void;

  private ledges: Ledge[] = [];
  /** いま乗っている足場 */
  private on: Ledge | null = null;
  /** すり抜けて下りている足場 */
  private through: Ledge | null = null;
  private buffer = 0;
  private coyote = 0;
  private run = 0;
  private age = 0;
  private readonly startScale: number;
  /** ドット 1 つの大きさ(px) */
  readonly dot: number;
  /** 走れる範囲。幅は画面の幅、高さはページの高さ */
  private bounds: { w: number; h: number };

  constructor(start: Start, dot: number, bounds: { w: number; h: number }) {
    this.dot = dot;
    this.bounds = bounds;
    this.x = start.x;
    this.y = start.y;
    this.vx = start.vx;
    this.vy = start.vy;
    this.dir = start.vx < 0 ? -1 : 1;
    this.scale = this.startScale = start.scale;
  }

  get width() {
    return W * this.dot;
  }
  get height() {
    return H * this.dot;
  }
  /** いまの足の形 */
  get legs(): Legs {
    if (this.air) return "jump";
    if (this.phase === "clear") return "stand";
    return Math.floor(this.run / (5 * this.dot)) % 2 ? "a" : "b";
  }
  /** カードの数(集める対象の数) */
  get cardCount() {
    return this.ledges.filter((l) => l.kind === "card").length;
  }

  /** 足場を入れ替える(ページの組み方が変わったとき)。乗っている足場は、同じ id のものに乗り替える */
  setLedges(ledges: Ledge[], bounds = this.bounds) {
    this.ledges = ledges.filter((l) => l.w > 0);
    this.bounds = bounds;
    if (this.on) {
      const same = this.ledges.find((l) => l.id === this.on!.id);
      this.on = same ?? null;
      if (same) this.y = same.y;
      else this.air = true;
    }
    if (this.through) this.through = this.ledges.find((l) => l.id === this.through!.id) ?? null;
  }

  /** 跳ぶ。dir を渡すと、その向きに向き直ってから跳ぶ */
  jump(dir?: 1 | -1) {
    if (this.phase === "clear") return;
    if (dir) this.turn(dir);
    if (this.air && this.coyote <= 0) {
      this.buffer = BUFFER;
      return;
    }
    this.leap();
  }

  /** 向きを変える */
  turn(dir: 1 | -1) {
    if (this.phase === "clear") return;
    this.dir = dir;
    if (this.phase === "run") this.vx = dir * Math.abs(this.vx || SPEED * this.dot);
  }

  /** 乗っている足場をすり抜けて下りる(ゴールとトランポリンは抜けない) */
  drop() {
    if (this.phase === "clear" || this.air || !this.on || this.on.kind === "goal" || this.on.kind === "bounce") return;
    this.through = this.on;
    this.on = null;
    this.air = true;
    this.vy = Math.max(this.vy, 0);
  }

  /** dt 秒だけ進める */
  step(dt: number) {
    for (let left = Math.min(dt, 0.1); left > 1e-6; left -= 1 / 120) this.tick(Math.min(left, 1 / 120));
  }

  private leap() {
    this.air = true;
    this.on = null;
    this.coyote = 0;
    this.buffer = 0;
    this.vy = -JUMP * this.dot;
  }

  private tick(dt: number) {
    this.age += dt;
    this.scale = this.dot + (this.startScale - this.dot) * Math.max(0, 1 - this.age / SHRINK) ** 2;
    if (this.phase === "clear") {
      // ゴールの上で、小さく跳ねて喜ぶ
      if (this.air) this.fall(dt);
      return;
    }
    this.time += dt;
    if (this.phase === "fly" && this.age > SHRINK) this.phase = "run";

    // 横の速さは、飛び出したときの勢いからふだんの速さへ近づける
    const target = this.dir * SPEED * this.dot;
    this.vx += (target - this.vx) * Math.min(1, SETTLE * dt);
    this.x += this.vx * dt;
    if (!this.air) this.run += Math.abs(this.vx * dt);

    // 画面の左右の端で向きを変える
    const half = this.width / 2;
    if (this.x < half) {
      this.x = half;
      this.dir = 1;
      this.vx = Math.abs(this.vx);
    } else if (this.x > this.bounds.w - half) {
      this.x = this.bounds.w - half;
      this.dir = -1;
      this.vx = -Math.abs(this.vx);
    }

    if (!this.air) {
      // 足場の端から走り出たら落ちる
      if (!this.on || !this.over(this.on)) {
        this.on = null;
        this.air = true;
        this.vy = 0;
        this.coyote = COYOTE;
      }
    }
    if (this.air) this.fall(dt);
  }

  private fall(dt: number) {
    const before = this.y;
    this.vy += GRAVITY * this.dot * dt;
    this.y += this.vy * dt;
    this.coyote = Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);
    if (this.y - this.height < 0) {
      // ページの上の端より上には行かない
      this.y = this.height;
      this.vy = Math.max(0, this.vy);
    }
    if (this.through && before > this.through.y + 1) this.through = null;
    if (this.vy < 0) return;

    // 上から足場を踏んだか。いくつも越えたときは、いちばん上のもの
    let hit: Ledge | null = null;
    for (const l of this.ledges) {
      if (l === this.through || l.y < before - 0.01 || l.y > this.y || !this.over(l)) continue;
      if (!hit || l.y < hit.y) hit = l;
    }
    // ページの下の端も足場にする(念のため。ふだんはトランポリンで跳ね返る)
    if (!hit && this.y >= this.bounds.h) hit = { id: -1, kind: "bounce", x: 0, y: this.bounds.h, w: this.bounds.w, h: 0 };
    if (hit) this.land(hit);
  }

  private land(l: Ledge) {
    this.y = l.y;
    if (l.kind === "bounce") {
      // ゴールより、走者の背の高さ 3 つぶん上まで跳ね上がる
      const goal = this.ledges.find((g) => g.kind === "goal");
      const rise = Math.max(goal ? l.y - goal.y + this.height * 3 : 0, JUMP * this.dot * 0.3);
      this.vy = -Math.sqrt(2 * GRAVITY * this.dot * rise);
      this.air = true;
      this.on = null;
      this.onLand?.(l);
      return;
    }
    this.vy = 0;
    this.air = false;
    this.on = l;
    this.onLand?.(l);
    if (this.phase === "clear") return;
    if (l.kind === "card") this.cards.add(l.id);
    if (l.kind === "goal") {
      this.phase = "clear";
      this.vx = 0;
      // 1 回だけ小さく跳ねる
      this.air = true;
      this.vy = -JUMP * this.dot * 0.6;
      return;
    }
    if (this.buffer > 0) this.leap();
  }

  /** 走者の足が、足場の上にかかっているか(足の幅は絵より少し狭く取る) */
  private over(l: Rect) {
    const half = (this.width - 2 * this.dot) / 2;
    return this.x + half > l.x && this.x - half < l.x + l.w;
  }
}
