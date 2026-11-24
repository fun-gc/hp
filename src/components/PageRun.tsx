"use client";

import { useEffect, useRef, useState } from "react";
import { BODY, LEGS } from "@/lib/runner";
import { type Ledge, type LedgeKind, PageRun as Game, type Start } from "@/lib/pagerun";

// パネルから飛び出した走者が、ページの上を走る(PAGE RUN)。中身は src/lib/pagerun.ts。
// PanelGame が、パネルのランゲームで走者が飛び出したところ(start)を渡して出す。
//
// 足場は、ページの中で data-ledge の付いた要素。値で種類を分ける(なし: ただの足場、card: 作品カード、goal: ゴール、
// bounce: 要素の下の端をトランポリンにする)。足場は要素の上の端で、上からだけ乗れる。
// 走者と、ゴールの目印は、画面いっぱいの canvas に描く。走者がいつも画面の少し上に来るように、ページを送る。
// 遊んでいるあいだは、画面に触れると跳ぶ(ページのリンクは押せない)。クリアすると、ゴールのボタンを押せるようにする。

const BEST_KEY = "fungc:page-run:best";
const WIDE = "(min-width: 64rem)";
/** 走者を、画面の上からこの割合のところに置く */
const CAMERA = 0.42;

const INK = "#15202a";
const YELLOW = "#fff200";

type Dust = { x: number; y: number; vx: number; vy: number; age: number };
type Result = { time: number; cards: number; total: number; best: number; record: boolean };

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(best: number) {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // 保存できない設定のときは、そのページにいるあいだだけ覚えている
  }
}

/** 00:23.45 */
const clock = (t: number) => {
  const cs = Math.floor(t * 100);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(cs / 6000))}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
};

const KINDS: LedgeKind[] = ["card", "goal", "bounce"];

/** ページの中の足場を集める。要素の位置はページの左上から測る */
function collect(): { ledges: Ledge[]; elements: Map<number, HTMLElement> } {
  const elements = new Map<number, HTMLElement>();
  const ledges: Ledge[] = [];
  document.querySelectorAll<HTMLElement>("[data-ledge]").forEach((el, id) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    // data-ledge だけのとき、React は値を "true" にする
    const kind: LedgeKind = KINDS.find((k) => k === el.dataset.ledge) ?? "ledge";
    const top = (kind === "bounce" ? r.bottom - 2 : r.top) + window.scrollY;
    ledges.push({ id, kind, x: r.left, y: top, w: r.width, h: r.height });
    elements.set(id, el);
  });
  return { ledges, elements };
}

const bounds = () => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight });

export function PageRun({ start, onEnd }: { start: Start; onEnd: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const api = useRef<{ retry(): void; pressAt(x: number, y: number): void } | null>(null);
  const [hud, setHud] = useState({ time: 0, cards: 0, total: 0 });
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dot = window.matchMedia(WIDE).matches ? 5 : 4;

    // 2 回目からは、作品の段の少し上から落ちてくる
    const from: Start =
      attempt === 0
        ? start
        : (() => {
            const first = collect().ledges.sort((a, b) => a.y - b.y)[0];
            const y = (first?.y ?? 400) - 160;
            window.scrollTo({ top: Math.max(0, y - window.innerHeight * CAMERA), behavior: "instant" });
            return { x: bounds().w * 0.3, y, vx: 0, vy: 0, scale: dot * 3 };
          })();
    const game = new Game(from, dot, bounds());
    let { ledges, elements } = collect();
    game.setLedges(ledges, bounds());
    let dust: Dust[] = [];
    let cleared = false;

    game.onLand = (ledge) => {
      const target = elements.get(ledge.id);
      if (target) {
        // 乗った足場を一瞬光らせる。作品カードは、集めた印を残す
        target.dataset.runStep = "";
        window.setTimeout(() => delete target.dataset.runStep, 260);
        if (ledge.kind === "card") target.dataset.runGot = "";
      }
      for (let i = 0; i < 5; i++) dust.push({ x: game.x, y: game.y, vx: (i - 2) * 30 * dot * 0.3, vy: -(20 + (i % 2) * 18) * dot * 0.3, age: 0 });
    };

    // 足場の位置は、画像の読み込みや画面の幅で変わるので、ときどき測り直す
    const remeasure = () => {
      ({ ledges, elements } = collect());
      game.setLedges(ledges, bounds());
    };
    const timer = window.setInterval(remeasure, 500);

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.round(window.innerWidth * ratio);
      el.height = Math.round(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      remeasure();
    };
    resize();
    window.addEventListener("resize", resize);

    /** 走者を、パネルの穴と同じ丸い点で描く */
    const drawRunner = (color: string) => {
      const s = game.scale;
      const left = game.x - (7 * s) / 2;
      const top = game.y - window.scrollY - 10 * s;
      const rows = [...BODY, ...LEGS[game.legs]];
      ctx.fillStyle = color;
      ctx.beginPath();
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const c = game.dir < 0 ? row.length - 1 - i : i;
          if (row[c] !== "#") continue;
          ctx.moveTo(left + (i + 0.5) * s + s * 0.42, top + (j + 0.5) * s);
          ctx.arc(left + (i + 0.5) * s, top + (j + 0.5) * s, s * 0.42, 0, Math.PI * 2);
        }
      });
      ctx.fill();
    };

    /** ゴールの上に、点滅する ▼ を出す。ゴールが画面の外なら、画面の端に出す */
    const drawGoal = (time: number) => {
      const goal = ledges.find((l) => l.kind === "goal");
      if (!goal || time % 0.8 > 0.55) return;
      const x = goal.x + goal.w / 2;
      const y = Math.min(window.innerHeight - 24, Math.max(80, goal.y - window.scrollY - 18 - (time % 0.8) * 8));
      ctx.fillStyle = YELLOW;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 12);
      ctx.lineTo(x + 9, y - 12);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // 夜の建物の上では、走者を黄色で描く
    const nightColor = () => {
      const night = document.querySelector(".night")?.getBoundingClientRect();
      const y = game.y - window.scrollY - game.height / 2;
      return night && y > night.top && y < night.bottom ? YELLOW : INK;
    };

    let raf = 0;
    let shown = -1;
    const loop = (now: number, last = now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      if (!document.hidden) game.step(dt);

      // 走者が画面の少し上に来るように、ページを送る
      const view = window.innerHeight;
      const want = Math.min(Math.max(0, game.y - game.height / 2 - view * CAMERA), document.documentElement.scrollHeight - view);
      const next = reduce ? want : window.scrollY + (want - window.scrollY) * (1 - Math.exp(-dt * 6));
      if (Math.abs(next - window.scrollY) > 0.5) window.scrollTo({ top: next, behavior: "instant" });

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!cleared) drawGoal(now / 1000);
      dust = dust.filter((d) => (d.age += dt) < 0.35);
      const color = nightColor();
      ctx.fillStyle = color;
      for (const d of dust) {
        ctx.globalAlpha = 1 - d.age / 0.35;
        ctx.fillRect(d.x + d.vx * d.age - 1.5, d.y + d.vy * d.age + 300 * d.age * d.age - window.scrollY - 3, 3, 3);
      }
      ctx.globalAlpha = 1;
      drawRunner(color);

      const tenth = Math.floor(game.time * 10);
      if (tenth !== shown) {
        shown = tenth;
        setHud({ time: game.time, cards: game.cards.size, total: game.cardCount });
      }
      if (game.phase === "clear" && !cleared) {
        cleared = true;
        const best = readBest();
        const record = !best || game.time < best;
        if (record) saveBest(game.time);
        setHud({ time: game.time, cards: game.cards.size, total: game.cardCount });
        setResult({ time: game.time, cards: game.cards.size, total: game.cardCount, best: record ? game.time : best, record });
      }
      raf = requestAnimationFrame((t) => loop(t, now));
    };
    raf = requestAnimationFrame((t) => loop(t));

    // ---- 操作 ----
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEnd();
        return;
      }
      if (cleared || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("button")) return;
      const key = e.key;
      if (key === "ArrowLeft" || key === "a" || key === "A") game.turn(-1);
      else if (key === "ArrowRight" || key === "d" || key === "D") game.turn(1);
      else if (key === "ArrowDown" || key === "s" || key === "S") game.drop();
      else if (key.length === 1 || key === "Enter" || key === "ArrowUp") {
        if (!e.repeat) game.jump();
      } else return;
      e.preventDefault();
    };
    // 遊んでいるあいだは、ホイールでページが動かないようにする(ページは走者に合わせて送る)
    const onWheel = (e: WheelEvent) => {
      if (!cleared) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });

    api.current = {
      retry: () => setAttempt((n) => n + 1),
      // 画面に触れたとき。走者の足もとより下なら、足場を下りる。それより上なら跳ぶ(走者より左右に離れたところなら、その向きに)
      pressAt: (x, y) => {
        const feet = game.y - window.scrollY;
        if (y > feet + game.height) return game.drop();
        const away = x - game.x;
        game.jump(Math.abs(away) > game.width ? (away < 0 ? -1 : 1) : undefined);
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      document.querySelectorAll("[data-run-got]").forEach((li) => li.removeAttribute("data-run-got"));
      api.current = null;
      setResult(null);
    };
  }, [start, onEnd, attempt]);

  useEffect(() => {
    if (result) exit.current?.focus({ preventScroll: true });
  }, [result]);

  const press = (e: React.PointerEvent) => {
    if (e.button === 0) api.current?.pressAt(e.clientX, e.clientY);
  };

  return (
    <>
      <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-45 size-full" aria-hidden="true" />
      {!result && (
        <div
          role="application"
          aria-label="PAGE RUN。ページの上を走って、下の HOW TO JOIN のボタンに着地するとクリアです。スペースキーで跳び、左右の矢印キーで向きを変え、下の矢印キーで足場を下ります。Esc キーで終わります"
          tabIndex={-1}
          onPointerDown={press}
          className="fixed inset-0 z-46 cursor-pointer touch-none select-none outline-none"
        />
      )}

      {/* ---- 下の帯。時間と、集めた作品の数。クリアしたら結果 ---- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-47 flex justify-center px-3 pb-3 sm:pb-4">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 bg-ink py-2 pl-2 pr-2 font-mono text-[11px] tracking-wide text-white shadow-[5px_5px_0_var(--color-fun-yellow)] sm:text-xs">
          <span className="hl px-1.5 py-0.5 font-medium">PAGE RUN</span>
          <span className="tabular-nums" role="timer" aria-label="経過時間">
            TIME {clock(hud.time)}
          </span>
          <span className="tabular-nums">
            WORKS {hud.cards}/{hud.total}
          </span>
          {result ? (
            <span role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-medium text-fun-yellow">CLEAR!</span>
              <span className="text-white/80">{result.record ? "NEW RECORD!" : `BEST ${clock(result.best)}`}</span>
              <button type="button" onClick={() => api.current?.retry()} className="border border-white/60 px-2 py-1 tracking-[0.15em] hover:bg-white hover:text-ink">
                RETRY
              </button>
            </span>
          ) : (
            <span className="text-white/60">
              <span className="lg:hidden">tap: jump / tap below: drop</span>
              <span className="hidden lg:inline">space: jump / ←→: turn / ↓: drop</span>
            </span>
          )}
          <button
            ref={exit}
            type="button"
            onClick={onEnd}
            className="flex items-center gap-2 border border-white/60 px-2 py-1 tracking-[0.15em] hover:bg-fun-yellow hover:text-ink"
          >
            <span className="hidden opacity-60 lg:inline" aria-hidden="true">
              [ESC]
            </span>
            {result ? "CLOSE" : "EXIT"} <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
    </>
  );
}
