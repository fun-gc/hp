"use client";

import { useEffect, useRef } from "react";
import { delay } from "@/lib/motion";
import { Annot, coordinates } from "./Poster";

// ヒーローの斜めに崩した FUNGC。マウスを近づけると逃げ、つかんで投げられ、離すとばねで元の並びに戻る。
// 軽く押す(タップ)と一回転する。左下の注記「structural completeness」は、文字の崩れ具合を 0〜100 で出す。
// 組み上がってから 8 秒たつと、文字が揺れてから崩れ落ちる(ヒーローが見えている間だけ数え、触っていても数え直さない)。
// 崩れた文字は、つかんで元の場所(背景と同じ色の文字)の近くで離すとはまる。はめた文字は、しばらくカーソルから逃げない。
// 全部はめると組み上がり、また 8 秒たつと崩れる。
// 文字どうしはぶつかって押し合い、崩れた文字は積み重なる。
// 動きを減らす設定の人には、文字を動かさない(つかむことも、崩れることもない)。

const LETTERS = "FUNGC".split("");

// 力の強さは 1 フレーム(1/60 秒)あたり
const SPRING = 0.03; // 元の位置へ戻るばね
const DAMPING = 0.9; // 1 フレームごとに残る速さ
const FREE_SPRING = 0.002; // 投げた直後はばねを弱くして、遠くまで飛ばす
const FREE_DAMPING = 0.985;
const FREE_FRAMES = 50;
const PUSH = 1.3; // カーソルから逃げる強さ
const KNOCK = 0.08; // 速く通り抜けたカーソルに弾かれる強さ
const BOUNCE = 0.55; // 写真の端で跳ね返ったときに残る速さ
const MAX_SPEED = 70;
const SPIN_MS = 800;
const TAP_MS = 350;

// 崩れ落ちる仕掛け
const COLLAPSE_MS = 8000; // 組み上がってから、ヒーローが見えている時間がこれだけたつと崩れる。触っていても数え直さない
const WOBBLE_MS = 650; // 崩れる前に揺れる時間
const FALL_GAP_MS = 140; // 下の文字から順に、この間隔で崩れる
const GRAVITY = 0.9;
const AIR = 0.995;
const FLOOR_BOUNCE = 0.3;
const FLOOR_FRICTION = 0.82;
const SNAP = 0.5; // 文字の大きさのこの割合まで元の場所に近づけて離すと、はまる
const CALM_MS = 3000; // はめた文字は、この間カーソルから逃げない
const CALM_FADE_MS = 800; // 逃げない間が終わったら、この時間をかけて少しずつ逃げるようにする

// 文字どうしのぶつかり
const HIT_SHRINK = 0.9; // 当たり判定の箱は、文字の箱より少し小さくする(字形の余白のぶん)
const HIT_BOUNCE = 0.25; // 速くぶつかったときに跳ね返る強さ
const HIT_ITERATIONS = 6; // 1 フレームに押し分けをくり返す回数(積み重なりや、並んだ文字をまとめて押すときを安定させる)
const HOME_WEIGHT = 0.35; // 元の場所にばねでつながった文字の動きやすさ(落ちている文字を 1 とする)
const STILL_FRAMES = 60; // 乗った文字がほとんど動かないまま、これだけたったら止める
const DEEP = 3; // これより深くめり込まれたら、落ち着いた文字も動かして押し分ける
const SIDE_STEP = 3; // 床に乗った文字を、手で上から押しつけたときに横へ押し出す速さ(1 回の押し分けあたり)

type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  scale: number;
  held: boolean;
  free: number;
  spinAt: number | null;
  restX: number;
  restY: number;
  w: number;
  h: number;
  /** 崩れて、重力で落ちている(床で止まっている)とき true */
  down: boolean;
  /** 落ちている間の回る速さ(度 / フレーム) */
  rotV: number;
  /** 床かほかの文字の上で落ち着いて、動かさなくてよいとき true */
  settled: boolean;
  /** このフレームで床かほかの文字に乗っているとき true */
  ground: boolean;
  /** このフレームで、手で押している文字(またはそれに押された文字)に押されたとき true */
  shoved: boolean;
  /** 床かほかの文字の上で、ほとんど動かずにいる長さ(フレーム)。長く続いたら、細かく震えていても止める */
  still: number;
  /** 崩れる前に揺れ始める時刻と、揺れによるずれ(見た目だけ) */
  wobbleAt: number | null;
  jx: number;
  jr: number;
  /** 組み上がったときに、ぽんと膨らむ時刻 */
  popAt: number | null;
  /** この時刻まではカーソルから逃げない(はめた直後) */
  calmUntil: number;
};

/** 当たり判定の箱。中心、回した向きの 2 本の軸、軸ごとの半分の長さ */
type Box = { cx: number; cy: number; ux: number; uy: number; ex: number; ey: number };
/** 重なった 2 つの箱を押し分ける向き(A から B へ)と深さ */
type Push = { nx: number; ny: number; depth: number };

type Grab = { i: number; ox: number; oy: number; sx: number; sy: number; t0: number; moved: boolean; samples: { x: number; y: number; t: number }[] };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeOutBack = (p: number) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;
/** 角度を -180〜180 度にそろえる */
const wrapDeg = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** 回した 2 つの箱の重なり(分離軸の判定)。重なっていれば、A から B へいちばん浅く押し出す向きと深さ、横向きでいちばん浅いもの(side)を返す */
function overlap(a: Box, b: Box) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  // 箱を軸 (x, y) に映したときの半分の長さ
  const reach = (k: Box, x: number, y: number) => k.ex * Math.abs(k.ux * x + k.uy * y) + k.ey * Math.abs(-k.uy * x + k.ux * y);
  let best: Push | null = null;
  // 横向きの押し出しのうち、いちばん浅いもの(床へ押し込めないときに使う)
  let side: Push | null = null;
  for (const [x, y] of [
    [a.ux, a.uy],
    [-a.uy, a.ux],
    [b.ux, b.uy],
    [-b.uy, b.ux],
  ]) {
    const dist = dx * x + dy * y;
    const depth = reach(a, x, y) + reach(b, x, y) - Math.abs(dist);
    if (depth <= 0) return null;
    const sign = dist < 0 ? -1 : 1;
    const push = { nx: x * sign, ny: y * sign, depth };
    if (!best || depth < best.depth) best = push;
    if (Math.abs(push.ny) <= 0.5 && (!side || depth < side.depth)) side = push;
  }
  return best && { ...best, side };
}

/** 文字を動かす仕組み。React の再描画を通さず、毎フレーム transform を書き換える */
function startEngine(layer: HTMLElement, els: HTMLElement[], slots: HTMLElement[], meter: HTMLElement | null, bar: HTMLElement | null) {
  const bodies: Body[] = els.map(() => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    scale: 1,
    held: false,
    free: 0,
    spinAt: null,
    restX: 0,
    restY: 0,
    w: 0,
    h: 0,
    down: false,
    rotV: 0,
    settled: false,
    ground: false,
    shoved: false,
    still: 0,
    wobbleAt: null,
    jx: 0,
    jr: 0,
    popAt: null,
    calmUntil: 0,
  }));

  /** 当たり判定の箱 */
  const box = (b: Body): Box => {
    const rad = (b.rot * Math.PI) / 180;
    return {
      cx: b.restX + b.x + b.w / 2,
      cy: b.restY + b.y + b.h / 2,
      ux: Math.cos(rad),
      uy: Math.sin(rad),
      ex: (b.w * HIT_SHRINK) / 2,
      ey: (b.h * HIT_SHRINK) / 2,
    };
  };

  let width = 0;
  let height = 0;
  const measure = () => {
    width = layer.clientWidth;
    height = layer.clientHeight;
    els.forEach((el, i) => {
      const b = bodies[i];
      b.restX = el.offsetLeft;
      b.restY = el.offsetTop;
      b.w = el.offsetWidth;
      b.h = el.offsetHeight;
      // 大きさが変わったら、崩れた文字は新しい床まで落とし直す
      b.settled = false;
    });
  };
  measure();

  // 押し合わせない組み合わせのときに重なった組(画面が狭いと元の並びでも隣どうしが重なる)や、はめた・つかんだ瞬間に
  // 重なっていた組は、いったん離れるまですり抜けさせる。重なったまま押し合わせると、弾け飛んでしまう
  const ghost = new Set<number>();

  // マウスの位置と速さ(layer の左上が原点)。タッチではつかむだけにする
  const cursor = { x: 0, y: 0, vx: 0, vy: 0, inside: false, t: 0 };
  const grabs = new Map<number, Grab>();
  let raf = 0;
  let last = 0;
  let lastScore = 100;
  // "normal": ふだん(投げても元に戻る)。"collapsed": 崩れていて、手で元の場所へ戻す
  let mode: "normal" | "collapsed" = "normal";

  const local = (ev: PointerEvent) => {
    const r = layer.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, w: r.width, h: r.height };
  };

  const showScore = (score: number) => {
    if (score === lastScore) return;
    lastScore = score;
    if (meter?.firstChild) {
      // 文字の節点だけを書き換える(textContent だと節点が入れ替わり、RevealOnScroll の MutationObserver が毎フレーム動く)
      meter.firstChild.nodeValue = String(score).padStart(3, "0");
      meter.classList.toggle("bg-fun-yellow", score < 100);
    }
    if (bar) bar.style.transform = `scaleX(${score / 100})`;
  };

  /** 元の場所からのずれが、はまる範囲に入っているか */
  const nearHome = (b: Body) => Math.hypot(b.x, b.y) < Math.max(b.w, b.h) * SNAP;

  /** 回した文字が占める範囲(中心と、中心からの半分の幅と高さ)。床と写真の枠に使う */
  const extent = (b: Body) => {
    const rad = (b.rot * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    return { cx: b.restX + b.x + b.w / 2, cy: b.restY + b.y + b.h / 2, hx: (b.w * c + b.h * s) / 2, hy: (b.w * s + b.h * c) / 2 };
  };

  const startFall = (b: Body) => {
    b.down = true;
    b.settled = false;
    b.free = 0;
    b.vx = (Math.random() - 0.5) * 3;
    b.vy = -1.5 - Math.random() * 2;
    b.rotV = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3.5);
  };

  /** 崩れた文字を写真の枠の中に戻す。端で跳ね返り、床では止まる */
  const keepInside = (b: Body) => {
    const { cx, cy, hx, hy } = extent(b);
    let pressed = 0;
    if (cx - hx < 0) {
      pressed = hx - cx;
      [b.x, b.vx] = [b.x + pressed, Math.abs(b.vx) * BOUNCE];
    } else if (cx + hx > width) {
      pressed = cx + hx - width;
      [b.x, b.vx] = [b.x - pressed, -Math.abs(b.vx) * BOUNCE];
    }
    // 手で端へ押しつけられた文字は、押された分だけ端をよじ登る(はさまれて、ほかの文字と重ならないように)
    if (b.shoved && pressed > 0.5) b.y -= pressed;
    if (cy - hy < 0) [b.y, b.vy] = [b.y + hy - cy, Math.abs(b.vy) * BOUNCE];
    if (cy + hy >= height) {
      b.y -= cy + hy - height;
      b.vy = b.vy > 3 ? -b.vy * FLOOR_BOUNCE : Math.min(b.vy, 0);
      b.ground = true;
    }
  };

  /** 重力で落とし、写真の枠と床で止める */
  const fall = (b: Body, dt: number) => {
    b.vy += GRAVITY * dt;
    b.vx = clamp(b.vx * AIR ** dt, -MAX_SPEED, MAX_SPEED);
    b.vy = clamp(b.vy * AIR ** dt, -MAX_SPEED, MAX_SPEED);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.rotV * dt;
    keepInside(b);
  };

  /** 崩れた文字が床に乗っているか */
  const onFloor = (b: Body) => {
    if (!b.down || b.held) return false;
    const { cy, hy } = extent(b);
    return cy + hy >= height - 0.5;
  };

  // 文字の状態。H: つかんでいる、D: 崩れて落ちている、F: 投げて飛んでいる、S: ばねで元の場所へ戻る
  const kind = (b: Body) => (b.held ? "H" : b.down ? "D" : b.free > 0 ? "F" : "S");

  /** 押し分けるときの動きやすさ。つかんでいる文字は動かない(手で押す) */
  const weight = (b: Body, other: Body, depth: number) => {
    if (b.held) return 0;
    if (b.down && b.settled) {
      // 落ち着いた文字は、手で(または手で押された文字で)押されるか、勢いよくぶつかられるか、深くめり込まれたときだけ動き出す
      if (!other.held && !other.shoved && other.free === 0 && Math.hypot(other.vx, other.vy) < 6 && depth <= DEEP) return 0;
      b.settled = false;
    }
    if (b.down || b.free > 0) return 1;
    // 元の場所の文字は、手で押されたり投げた文字が当たったりすると少し動く。崩れた文字は動かずに受け止める
    return other.down && !other.held ? 0 : HOME_WEIGHT;
  };

  const pairKey = (i: number, j: number) => Math.min(i, j) * bodies.length + Math.max(i, j);

  /** 文字どうしがぶつかったら押し分け、近づく速さを打ち消す。下の文字に乗った文字は「乗っている」とする */
  const collide = () => {
    let hit = false;
    for (let iter = 0; iter < HIT_ITERATIONS; iter++) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const [A, B] = [bodies[i], bodies[j]];
          const key = pairKey(i, j);
          const o = overlap(box(A), box(B));
          if (!o) {
            ghost.delete(key);
            continue;
          }
          // ばねで戻る文字どうし(元の並びに戻る途中で重なってよい)、つかんだ文字どうしは押し合わせない
          const pair = kind(A) + kind(B);
          if (pair === "SS" || pair === "HH") ghost.add(key);
          if (ghost.has(key)) continue;
          // 床に乗った文字は、上から押されても沈まない(床と押し合って、いつまでも落ち着かなくなるので)
          let p: Push = o;
          let wa = p.ny < -0.5 && onFloor(A) ? 0 : weight(A, B, p.depth);
          let wb = p.ny > 0.5 && onFloor(B) ? 0 : weight(B, A, p.depth);
          let most = Infinity;
          if (wa + wb === 0 && (A.held || B.held) && p.depth > DEEP && o.side) {
            // 手で上から深く押しつけられた文字は、横へ少しずつ押し出す
            p = o.side;
            wa = weight(A, B, p.depth);
            wb = weight(B, A, p.depth);
            most = SIDE_STEP;
          }
          if (wa + wb === 0) continue;
          hit = true;
          const k = Math.min(p.depth, most) / (wa + wb);
          A.x -= p.nx * k * wa;
          A.y -= p.ny * k * wa;
          B.x += p.nx * k * wb;
          B.y += p.ny * k * wb;
          // 手で押している文字に押された文字は、その先の文字も押し動かす
          if (wb > 0 && (A.held || A.shoved)) B.shoved = true;
          if (wa > 0 && (B.held || B.shoved)) A.shoved = true;
          const vn = (B.vx - A.vx) * p.nx + (B.vy - A.vy) * p.ny;
          if (vn < 0) {
            const e = vn < -2 ? HIT_BOUNCE : 0;
            const impulse = (-(1 + e) * vn) / (wa + wb);
            A.vx -= impulse * wa * p.nx;
            A.vy -= impulse * wa * p.ny;
            B.vx += impulse * wb * p.nx;
            B.vy += impulse * wb * p.ny;
            // ぶつかった勢いで少し回す
            if (A.down) A.rotV += clamp(impulse * p.nx * 0.15, -2, 2) * wa;
            if (B.down) B.rotV -= clamp(impulse * p.nx * 0.15, -2, 2) * wb;
          }
          if (p.ny < -0.5) B.ground = true;
          else if (p.ny > 0.5) A.ground = true;
        }
      }
      // 押し分けた文字が、写真の枠の外へ出ないようにする
      for (const b of bodies) if (b.down && !b.held) keepInside(b);
    }
    return hit;
  };

  /** 落ち着いた文字の下に、床かほかの文字があるか。なくなったら(下の文字を動かしたら)また落とす */
  const supported = (b: Body) => {
    const { cy, hy } = extent(b);
    if (cy + hy >= height - 1) return true;
    const probe = box(b);
    probe.cy += 2;
    const i = bodies.indexOf(b);
    return bodies.some((o, j) => j !== i && !ghost.has(pairKey(i, j)) && overlap(probe, box(o)) !== null);
  };

  const tick = (now: number) => {
    const dt = Math.min(2.5, (now - last) / 16.667);
    last = now;
    let active = cursor.inside || grabs.size > 0;

    // 1. それぞれの文字を動かす
    bodies.forEach((b, i) => {
      b.ground = b.shoved = false;
      b.jx = b.jr = 0;
      // 崩れる前の揺れ。終わったら落ち始める(つかまれていたら落とさない)
      if (b.wobbleAt !== null && now >= b.wobbleAt) {
        const p = (now - b.wobbleAt) / WOBBLE_MS;
        if (p >= 1) {
          b.wobbleAt = null;
          if (!b.held) startFall(b);
        } else {
          b.jx = Math.sin(now * 0.09 + i) * 2.5 * p;
          b.jr = Math.sin(now * 0.07 + i * 2) * 4 * p;
        }
      }

      if (b.held) {
        // つかんでいる間は指に合わせて動かし、傾きだけ少しずつ戻す
        b.vx *= 0.7 ** dt;
        b.vy *= 0.7 ** dt;
      } else if (b.down) {
        if (!b.settled) fall(b, dt);
      } else {
        const t = b.free / FREE_FRAMES;
        const k = SPRING + (FREE_SPRING - SPRING) * t;
        b.vx -= k * b.x * dt;
        b.vy -= k * b.y * dt;

        // カーソルから逃げる。はめた直後はしばらく逃げず、そのあと少しずつ逃げるようにする
        const wary = clamp((now - b.calmUntil) / CALM_FADE_MS, 0, 1);
        if (cursor.inside && wary > 0) {
          const dx = b.restX + b.x + b.w / 2 - cursor.x;
          const dy = b.restY + b.y + b.h / 2 - cursor.y;
          const reach = Math.max(b.w, b.h) * 0.9 + 30;
          const d = Math.hypot(dx, dy);
          if (d < reach && d > 0.01) {
            const near = (1 - d / reach) * wary;
            b.vx += ((dx / d) * PUSH + cursor.vx * KNOCK) * near * dt;
            b.vy += ((dy / d) * PUSH + cursor.vy * KNOCK) * near * dt;
          }
        }

        const damp = (DAMPING + (FREE_DAMPING - DAMPING) * t) ** dt;
        b.vx = clamp(b.vx * damp, -MAX_SPEED, MAX_SPEED);
        b.vy = clamp(b.vy * damp, -MAX_SPEED, MAX_SPEED);
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // 写真の枠で跳ね返る
        const minX = -b.restX;
        const maxX = width - b.restX - b.w;
        const minY = -b.restY;
        const maxY = height - b.restY - b.h;
        if (b.x < minX) [b.x, b.vx] = [minX, Math.abs(b.vx) * BOUNCE];
        else if (b.x > maxX) [b.x, b.vx] = [maxX, -Math.abs(b.vx) * BOUNCE];
        if (b.y < minY) [b.y, b.vy] = [minY, Math.abs(b.vy) * BOUNCE];
        else if (b.y > maxY) [b.y, b.vy] = [maxY, -Math.abs(b.vy) * BOUNCE];

        if (b.free > 0) b.free = Math.max(0, b.free - dt);
      }
    });

    // 2. 文字どうしのぶつかり
    if (collide()) active = true;

    // 3. 床かほかの文字に乗った文字は、すべりを止め、寝かせるか立てるかの近い向きに倒して落ち着かせる
    bodies.forEach((b) => {
      if (!b.down || b.held) return;
      if (b.settled) {
        if (!supported(b)) b.settled = false;
        return;
      }
      if (!b.ground) {
        b.still = 0;
        return;
      }
      b.vx *= FLOOR_FRICTION ** dt;
      b.rotV *= 0.6 ** dt;
      const target = Math.round(b.rot / 90) * 90;
      b.rot += (target - b.rot) * Math.min(1, 0.25 * dt);
      b.still = Math.abs(b.vx) < 0.5 && Math.abs(b.vy) < 1.5 && Math.abs(b.rotV) < 0.3 ? b.still + dt : 0;
      const resting = Math.abs(b.vy) < 0.3 && Math.abs(b.vx) < 0.05 && Math.abs(b.rotV) < 0.05 && Math.abs(target - b.rot) < 0.2;
      if (resting || b.still > STILL_FRAMES) {
        Object.assign(b, { vx: 0, vy: 0, rotV: 0, rot: target, settled: true, still: 0 });
      }
    });

    // 4. 描く
    let broken = 0;
    bodies.forEach((b, i) => {
      // 横に動く速さに合わせて傾け、つかんでいる間は少し大きくする(崩れて落ちている間は、回る速さで回す)
      if (b.held || !b.down) b.rot += (clamp(b.vx * 1.6, -35, 35) - b.rot) * Math.min(1, 0.18 * dt);
      if (b.popAt !== null && now >= b.popAt) [b.scale, b.popAt] = [1.14, null];
      b.scale += ((b.held ? 1.08 : 1) - b.scale) * Math.min(1, 0.25 * dt);
      let spin = 0;
      if (b.spinAt !== null) {
        const p = (now - b.spinAt) / SPIN_MS;
        if (p >= 1) b.spinAt = null;
        else spin = 360 * easeOutBack(p);
      }

      // つかんで元の場所に近づけたら、戻り先の文字を光らせる
      slots[i]?.classList.toggle("is-near", mode === "collapsed" && b.held && nearHome(b));

      const animating =
        b.held ||
        b.spinAt !== null ||
        b.wobbleAt !== null ||
        b.popAt !== null ||
        Math.abs(b.scale - 1) > 0.001 ||
        (b.down
          ? !b.settled
          : Math.abs(b.x) > 0.2 || Math.abs(b.y) > 0.2 || Math.abs(b.vx) > 0.02 || Math.abs(b.vy) > 0.02 || Math.abs(b.rot) > 0.05);
      if (animating) active = true;
      const moving = animating || b.down;
      const el = els[i];
      el.classList.toggle("is-loose", moving);
      el.classList.toggle("is-down", b.down);
      el.style.transform = moving
        ? `translate3d(${(b.x + b.jx).toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${(b.rot + b.jr + spin).toFixed(2)}deg) scale(${b.scale.toFixed(3)})`
        : "";

      // 崩れ具合: 元の位置からのずれと傾きを、文字の大きさの 1.5 倍で 1 とする
      const off = Math.hypot(b.x, b.y) + Math.abs(wrapDeg(b.rot)) * 2;
      broken += Math.min(1, off / (Math.max(b.w, b.h) * 1.5));
    });

    cursor.vx *= 0.5 ** dt;
    cursor.vy *= 0.5 ** dt;
    showScore(Math.round(100 * (1 - broken / bodies.length)));

    if (active) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      bodies.forEach((b) => {
        if (!b.down) Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0, rot: 0, scale: 1 });
      });
      if (bodies.every((b) => !b.down)) showScore(100);
    }
  };

  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  // ---- 組み上がってから COLLAPSE_MS たつと崩れる ----
  // ヒーローが半分以上見えていて、タブが表に出ている間だけ数える(見えなくなったら止め、戻ったら続きから)。
  // 触っていても数え直さないので、文字で遊んでいる途中でも崩れる
  let shownMs = 0; // 組み上がってから、ヒーローが見えていた時間
  let shownSince: number | null = null; // 数えている間は、数え始めた時刻
  let collapseTimer = 0;
  let visible = false;
  const schedule = () => {
    window.clearTimeout(collapseTimer);
    collapseTimer = 0;
    const now = performance.now();
    if (shownSince !== null) shownMs += now - shownSince;
    shownSince = null;
    if (mode !== "normal" || !visible || document.hidden) return;
    shownSince = now;
    collapseTimer = window.setTimeout(collapse, Math.max(0, COLLAPSE_MS - shownMs));
  };
  /** 下の文字から順に揺らして、崩す。つかんでいる文字は手に残り、離すと落ちる */
  const collapse = () => {
    collapseTimer = 0;
    shownSince = null;
    if (mode !== "normal") return;
    mode = "collapsed";
    const now = performance.now();
    bodies.forEach((b, i) => {
      b.wobbleAt = now + (bodies.length - 1 - i) * FALL_GAP_MS;
    });
    wake();
  };
  /** 全部はめ終えたら、ぽんと組み上げて、また数え始める */
  const checkRebuilt = () => {
    if (mode !== "collapsed" || bodies.some((b) => b.down || b.wobbleAt !== null)) return;
    mode = "normal";
    shownMs = 0;
    const now = performance.now();
    bodies.forEach((b, i) => {
      b.popAt = now + 250 + i * 70;
      b.calmUntil = now + CALM_MS;
    });
    schedule();
  };
  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      schedule();
    },
    { threshold: [0, 0.5, 1] },
  );
  io.observe(layer);

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType !== "mouse") return;
    const p = local(ev);
    const pad = 80;
    const inside = p.x > -pad && p.y > -pad && p.x < p.w + pad && p.y < p.h + pad;
    if (inside && cursor.inside) {
      const frames = Math.max(1, (ev.timeStamp - cursor.t) / 16.667);
      cursor.vx = clamp((p.x - cursor.x) / frames, -60, 60);
      cursor.vy = clamp((p.y - cursor.y) / frames, -60, 60);
    } else {
      cursor.vx = cursor.vy = 0;
    }
    Object.assign(cursor, { x: p.x, y: p.y, t: ev.timeStamp, inside });
    if (inside) wake();
  };
  const onOut = (ev: PointerEvent) => {
    if (!ev.relatedTarget) cursor.inside = false;
  };
  const onScroll = () => {
    cursor.inside = false;
  };

  const onDown = (ev: PointerEvent) => {
    const i = els.indexOf(ev.currentTarget as HTMLElement);
    if (i < 0 || ev.button !== 0) return;
    ev.preventDefault();
    els[i].setPointerCapture(ev.pointerId);
    const p = local(ev);
    const b = bodies[i];
    b.held = true;
    b.free = 0;
    b.settled = false;
    b.wobbleAt = null;
    // 寝ている文字を持ち上げたら、近い向きから起こす
    b.rot = wrapDeg(b.rot);
    b.rotV = 0;
    // つかんだ時点で深く重なっている文字は、はじき飛ばさず、離れるまですり抜けさせる
    bodies.forEach((o, j) => {
      const hit = j !== i && overlap(box(b), box(o));
      if (hit && hit.depth > DEEP) ghost.add(pairKey(i, j));
    });
    grabs.set(ev.pointerId, { i, ox: p.x - b.x, oy: p.y - b.y, sx: ev.clientX, sy: ev.clientY, t0: ev.timeStamp, moved: false, samples: [{ x: p.x, y: p.y, t: ev.timeStamp }] });
    els[i].classList.add("is-held");
    wake();
  };
  const onDrag = (ev: PointerEvent) => {
    const g = grabs.get(ev.pointerId);
    if (!g) return;
    const p = local(ev);
    if (Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) > 6) g.moved = true;
    const b = bodies[g.i];
    const prev = g.samples[g.samples.length - 1];
    const frames = Math.max(1, (ev.timeStamp - prev.t) / 16.667);
    const nx = p.x - g.ox;
    const ny = p.y - g.oy;
    b.vx = (nx - b.x) / frames;
    b.vy = (ny - b.y) / frames;
    b.x = nx;
    b.y = ny;
    g.samples.push({ x: p.x, y: p.y, t: ev.timeStamp });
    while (g.samples.length > 2 && ev.timeStamp - g.samples[0].t > 120) g.samples.shift();
  };
  const onUp = (ev: PointerEvent) => {
    const g = grabs.get(ev.pointerId);
    if (!g) return;
    grabs.delete(ev.pointerId);
    const b = bodies[g.i];
    b.held = false;
    els[g.i].classList.remove("is-held");
    slots[g.i]?.classList.remove("is-near");
    if (!g.moved && ev.timeStamp - g.t0 < TAP_MS) {
      // 軽く押しただけなら一回転(崩れている文字は、その場に落ちる)
      b.spinAt = performance.now();
      b.vx = b.vy = 0;
      if (b.down) b.settled = false;
    } else {
      // 離す直前 0.1 秒の動きから、投げる速さを出す
      const s = g.samples;
      const z = s[s.length - 1];
      const a = s.find((q) => z.t - q.t <= 100) ?? s[0];
      const frames = Math.max(1, (z.t - a.t) / 16.667);
      const still = ev.timeStamp - z.t > 80;
      b.vx = still ? 0 : clamp((z.x - a.x) / frames, -MAX_SPEED, MAX_SPEED);
      b.vy = still ? 0 : clamp((z.y - a.y) / frames, -MAX_SPEED, MAX_SPEED);
      if (mode === "collapsed") {
        if (nearHome(b)) {
          // 元の場所の近くで離したら、はめる。はめた直後は、カーソルが近くにあっても逃げない
          Object.assign(b, { down: false, settled: false, free: 0, vx: b.vx * 0.2, vy: b.vy * 0.2, scale: 1.14, calmUntil: performance.now() + CALM_MS });
          // はめた時点で重なっている文字は、はじき飛ばさず、離れるまですり抜けさせる
          bodies.forEach((o, j) => {
            if (j !== g.i && overlap(box(b), box(o))) ghost.add(pairKey(g.i, j));
          });
          checkRebuilt();
        } else {
          // それ以外は、投げた勢いのまま落ちる
          Object.assign(b, { down: true, settled: false, free: 0, rotV: clamp(b.vx * 0.5, -10, 10) });
        }
      } else {
        b.free = FREE_FRAMES * Math.min(1, Math.hypot(b.vx, b.vy) / 25);
      }
    }
    wake();
  };

  const ro = new ResizeObserver(() => {
    measure();
    wake();
  });
  ro.observe(layer);
  els.forEach((el) => ro.observe(el));
  document.fonts?.ready.then(measure);

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerout", onOut);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", schedule);
  els.forEach((el) => {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onDrag);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("lostpointercapture", onUp);
  });

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(collapseTimer);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerout", onOut);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", schedule);
    els.forEach((el) => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onDrag);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("lostpointercapture", onUp);
      el.style.transform = "";
      el.classList.remove("is-held", "is-loose", "is-down");
    });
    slots.forEach((el) => el.classList.remove("is-near"));
  };
}

export function HeroLetters() {
  const layerRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const meterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const els = letterRefs.current.filter((el): el is HTMLSpanElement => el !== null);
    const slots = slotRefs.current.filter((el): el is HTMLSpanElement => el !== null);
    if (!layer || els.length === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return startEngine(layer, els, slots, meterRef.current, barRef.current);
  }, []);

  return (
    <>
      {/* 元の文字の場所。背景と同じ色の FUNGC を置いておき、崩れた文字の戻り先にする */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className="letter-slot poster-letter absolute select-none text-[clamp(5rem,13vw,11rem)]"
            style={{ left: `${10 + i * 16}%`, top: `${2 + i * 17}%` }}
          >
            {ch}
          </span>
        ))}
      </div>

      <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            className="hero-letter absolute touch-none select-none text-[clamp(5rem,13vw,11rem)] motion-safe:pointer-events-auto motion-safe:cursor-grab"
            style={{ left: `${10 + i * 16}%`, top: `${2 + i * 17}%` }}
          >
            {/* 読み込み時に落ちてくる動きと、ふだんのゆっくりした揺れは、それぞれ別の箱に付ける */}
            <span className="letter-in block" style={delay(0.55 + i * 0.09)}>
              <span className="letter-float poster-letter block" style={{ animationDelay: `${-i * 1.7}s` }}>
                {ch}
              </span>
            </span>
          </span>
        ))}
      </div>

      {/* 注記。文字を崩すと数字とバーが減り、元の並びに戻ると 100 に戻る。崩れた文字に隠れないよう、文字より上に出す */}
      <div className="anim-fade pointer-events-none absolute bottom-[5%] left-[5%] z-[21] hidden text-ink sm:block" style={delay(1.1)}>
        <Annot className="flex w-fit items-center gap-2 bg-paper/80 px-1">
          <span>[0–100]</span>
          <span className="relative h-[3px] w-14 bg-ink/15">
            <span ref={barRef} className="absolute inset-0 origin-left bg-ink transition-transform duration-150" />
          </span>
          <span ref={meterRef} className="px-0.5 tabular-nums">
            100
          </span>
        </Annot>
        <Annot className="mt-1 block w-fit bg-paper/80 px-1">structural completeness</Annot>
        <Annot className="mt-3 block w-fit bg-paper/80 px-1">
          Coordinates:
          <br />
          {coordinates}
        </Annot>
      </div>
    </>
  );
}
