"use client";

import { useEffect, useRef } from "react";
import { delay } from "@/lib/motion";
import { Annot, coordinates } from "./Poster";

// ヒーローの斜めに崩した FUNGC。マウスを近づけると逃げ、つかんで投げられ、離すとばねで元の並びに戻る。
// 軽く押す(タップ)と一回転する。左下の注記「structural completeness」は、文字の崩れ具合を 0〜100 で出す。
// 動きを減らす設定の人には、文字を動かさない(つかむこともできない)。

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
};

type Grab = { i: number; ox: number; oy: number; sx: number; sy: number; t0: number; moved: boolean; samples: { x: number; y: number; t: number }[] };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeOutBack = (p: number) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;

/** 文字を動かす仕組み。React の再描画を通さず、毎フレーム transform を書き換える */
function startEngine(layer: HTMLElement, els: HTMLElement[], meter: HTMLElement | null, bar: HTMLElement | null) {
  const bodies: Body[] = els.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, rot: 0, scale: 1, held: false, free: 0, spinAt: null, restX: 0, restY: 0, w: 0, h: 0 }));
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
    });
  };
  measure();

  // マウスの位置と速さ(layer の左上が原点)。タッチではつかむだけにする
  const cursor = { x: 0, y: 0, vx: 0, vy: 0, inside: false, t: 0 };
  const grabs = new Map<number, Grab>();
  let raf = 0;
  let last = 0;
  let lastScore = 100;

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

  const tick = (now: number) => {
    const dt = Math.min(2.5, (now - last) / 16.667);
    last = now;
    let active = cursor.inside || grabs.size > 0;
    let broken = 0;

    bodies.forEach((b, i) => {
      if (b.held) {
        // つかんでいる間は指に合わせて動かし、傾きだけ少しずつ戻す
        b.vx *= 0.7 ** dt;
        b.vy *= 0.7 ** dt;
      } else {
        const t = b.free / FREE_FRAMES;
        const k = SPRING + (FREE_SPRING - SPRING) * t;
        b.vx -= k * b.x * dt;
        b.vy -= k * b.y * dt;

        if (cursor.inside) {
          const dx = b.restX + b.x + b.w / 2 - cursor.x;
          const dy = b.restY + b.y + b.h / 2 - cursor.y;
          const reach = Math.max(b.w, b.h) * 0.9 + 30;
          const d = Math.hypot(dx, dy);
          if (d < reach && d > 0.01) {
            const near = 1 - d / reach;
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

      // 横に動く速さに合わせて傾け、つかんでいる間は少し大きくする
      b.rot += (clamp(b.vx * 1.6, -35, 35) - b.rot) * Math.min(1, 0.18 * dt);
      b.scale += ((b.held ? 1.08 : 1) - b.scale) * Math.min(1, 0.25 * dt);
      let spin = 0;
      if (b.spinAt !== null) {
        const p = (now - b.spinAt) / SPIN_MS;
        if (p >= 1) b.spinAt = null;
        else spin = 360 * easeOutBack(p);
      }

      const moving =
        b.held ||
        b.spinAt !== null ||
        Math.abs(b.x) > 0.2 ||
        Math.abs(b.y) > 0.2 ||
        Math.abs(b.vx) > 0.02 ||
        Math.abs(b.vy) > 0.02 ||
        Math.abs(b.rot) > 0.05 ||
        Math.abs(b.scale - 1) > 0.001;
      if (moving) active = true;
      const el = els[i];
      el.classList.toggle("is-loose", moving);
      el.style.transform = moving ? `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${(b.rot + spin).toFixed(2)}deg) scale(${b.scale.toFixed(3)})` : "";

      // 崩れ具合: 元の位置からのずれと傾きを、文字の大きさの 1.5 倍で 1 とする
      const off = Math.hypot(b.x, b.y) + Math.abs(b.rot) * 2;
      broken += Math.min(1, off / (Math.max(b.w, b.h) * 1.5));
    });

    cursor.vx *= 0.5 ** dt;
    cursor.vy *= 0.5 ** dt;
    showScore(Math.round(100 * (1 - broken / bodies.length)));

    if (active) raf = requestAnimationFrame(tick);
    else {
      raf = 0;
      bodies.forEach((b) => Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0, rot: 0, scale: 1 }));
      showScore(100);
    }
  };

  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

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
    if (!g.moved && ev.timeStamp - g.t0 < TAP_MS) {
      // 軽く押しただけなら一回転
      b.spinAt = performance.now();
      b.vx = b.vy = 0;
    } else {
      // 離す直前 0.1 秒の動きから、投げる速さを出す
      const s = g.samples;
      const z = s[s.length - 1];
      const a = s.find((q) => z.t - q.t <= 100) ?? s[0];
      const frames = Math.max(1, (z.t - a.t) / 16.667);
      const still = ev.timeStamp - z.t > 80;
      b.vx = still ? 0 : clamp((z.x - a.x) / frames, -MAX_SPEED, MAX_SPEED);
      b.vy = still ? 0 : clamp((z.y - a.y) / frames, -MAX_SPEED, MAX_SPEED);
      b.free = FREE_FRAMES * Math.min(1, Math.hypot(b.vx, b.vy) / 25);
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
  els.forEach((el) => {
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onDrag);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("lostpointercapture", onUp);
  });

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerout", onOut);
    window.removeEventListener("scroll", onScroll);
    els.forEach((el) => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onDrag);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("lostpointercapture", onUp);
      el.style.transform = "";
      el.classList.remove("is-held", "is-loose");
    });
  };
}

export function HeroLetters() {
  const layerRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const meterRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const els = letterRefs.current.filter((el): el is HTMLSpanElement => el !== null);
    if (!layer || els.length === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return startEngine(layer, els, meterRef.current, barRef.current);
  }, []);

  return (
    <>
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

      {/* 注記。文字を崩すと数字とバーが減り、元の並びに戻ると 100 に戻る */}
      <div className="anim-fade pointer-events-none absolute bottom-[5%] left-[5%] hidden text-ink sm:block" style={delay(1.1)}>
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
