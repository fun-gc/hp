"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { delay as d, type Vars } from "@/lib/motion";
import { COLS, type Phase, ROWS, Runner } from "@/lib/runner";

// トップのヒーローで遊べるミニゲーム。細い英字の「Playable」が Play ボタンになっていて、押すと
//   1. ポスターの文字や線が引き、
//   2. カメラが建物の黄色いパネル(H05)の正面へ回り込み(あらかじめレンダーした 36 コマの連番を、1 秒に 24 コマで送る)、
//   3. パネルの穴がドット画面になって、ボタン 1 つのランゲーム(src/lib/runner.ts)が始まる。
// Esc か EXIT で、同じコマを逆に送ってポスターへ戻る。
//
// 絵はどれも tools/poster-render/ で作る(README.md の「ミニゲームの絵」)。
//   play/d-00〜35.webp      回り込むカメラの連番(狭い画面は m-*。ヒーローの写真と同じく、絵の横 28%〜74% を切り出したもの)
//   play/still-*.webp       回り込んだあとの静止画。連番より大きいので、動きが止まったらこれに替える
//   play/panel-on / off     パネルの穴がすべて開いた絵と、閉じた絵。穴 1 つぶんずつ切り貼りして、ドット画面にする
// 連番の 0 コマ目はヒーローの写真と同じカメラなので、写真と入れ替えても位置はずれない。ただ、連番は写真より粗いので、
// ぱっと替えずに、重ねてから切り替える(globals.css)。
// 黄色いフィルムは、どの絵にも焼き込んである(CSS の乗算のフィルムは、遊んでいるあいだ外す)。
//
// 舞台(.stage)の data-play が、いまの段階を表す(見た目は globals.css の「パネルのミニゲーム」)。
//   in: ポスターの文字が引く → on: 写真の代わりに、この部品の絵を出す → out: ポスターへ戻る

const DIR = "/poster/play";
const FRAMES = 36;
const FPS = 24;
/** 先に何コマぶんを画像に戻しておくか。全部を戻すとメモリを食うので、送りながら少しずつ戻す */
const AHEAD = 4;
const WIDE = "(min-width: 64rem)";
const HI_KEY = "fungc:panel-run:hi";

type Size = "d" | "m";
type Mode = "idle" | "load" | "in" | "play" | "out";

// ---- 置き方。数字は、正面のカット(scene.py の SHOTS.play)の絵の幅と高さを 1 としたもの ----
/** ドット画面になるパネル(穴の並ぶ範囲) */
const PANEL = { x: 0.29, y: 0.36105, w: 0.44, h: 0.2779 };
/** 狭い画面で使う範囲(render-all.sh の MOBILE) */
const NARROW = { x: 0.28, w: 0.46 };
/** 広い画面用の静止画が写している範囲(render-all.sh の PLAY_WIDE) */
const STILL = { x: 0.19, y: 0.2, w: 0.64, h: 0.63 };
/** 広い画面での写真の置き方(globals.css の .play-layer。舞台の幅を 100 とした単位) */
const PHOTO = { x: -12, y: -6, w: 110 };
// 広い画面では、カメラが回り込むのに合わせて写真ごと拡大し、パネルを舞台のまん中に幅 72 で置く。狭い画面は、切り出した範囲にちょうど収まる
const TARGET = { x: 14, y: 13.5, w: 72 };
const ZOOM = TARGET.w / (PANEL.w * PHOTO.w);
const SHIFT = { x: TARGET.x - PHOTO.x - PANEL.x * PHOTO.w * ZOOM, y: TARGET.y - PHOTO.y - PANEL.y * PHOTO.w * (7 / 12) * ZOOM };

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const LAYOUT: Vars = {
  "--dots-x": pct(PANEL.x),
  "--dots-mx": pct((PANEL.x - NARROW.x) / NARROW.w),
  "--dots-y": pct(PANEL.y),
  "--dots-w": pct(PANEL.w),
  "--dots-mw": pct(PANEL.w / NARROW.w),
  "--dots-h": pct(PANEL.h),
  "--still-x": pct(STILL.x),
  "--still-y": pct(STILL.y),
  "--still-w": pct(STILL.w),
  "--still-h": pct(STILL.h),
};
const STILLS: Record<Size, { srcSet: string; sizes: string; src: string }> = {
  d: { srcSet: `${DIR}/still-d-1920.webp 1920w, ${DIR}/still-d-3072.webp 3072w`, sizes: "105vw", src: `${DIR}/still-d-1920.webp` },
  m: { srcSet: `${DIR}/still-m-750.webp 750w, ${DIR}/still-m-1104.webp 1104w`, sizes: "100vw", src: `${DIR}/still-m-750.webp` },
};

/** 位置を CSS 変数で渡す(globals.css の .pin)。x, y は広い画面、mx, my は狭い画面 */
const at = (x: number, y: number, mx: number, my: number, more: Vars = {}): Vars => ({ "--x": x, "--y": y, "--mx": mx, "--my": my, ...more });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---- 絵の読み込み。一度読んだものは、ページを移るまで持っておく ----
type Assets = { frames: Blob[]; on: HTMLImageElement; off: HTMLImageElement };
type Load = { promise: Promise<Assets>; done: number; listen?: (ratio: number) => void };
const loads: Partial<Record<Size, Load>> = {};
const PARTS = FRAMES + 2;

function image(src: string) {
  const im = new Image();
  im.decoding = "async";
  im.src = src;
  return im.decode().then(() => im);
}

function load(size: Size): Load {
  const have = loads[size];
  if (have) return have;
  const entry = { done: 0 } as Load;
  const tick = <T,>(value: T) => {
    entry.done++;
    entry.listen?.(entry.done / PARTS);
    return value;
  };
  const frame = async (i: number) => {
    const res = await fetch(`${DIR}/${size}-${String(i).padStart(2, "0")}.webp`);
    if (!res.ok) throw new Error(`frame ${i}: ${res.status}`);
    return tick(await res.blob());
  };
  entry.promise = Promise.all([
    Promise.all(Array.from({ length: FRAMES }, (_, i) => frame(i))),
    image(`${DIR}/panel-on-1520.webp`).then(tick),
    image(`${DIR}/panel-off-1520.webp`).then(tick),
  ]).then(([frames, on, off]) => ({ frames, on, off }));
  // 失敗したら、次に押したときに読み直せるようにする
  entry.promise.catch(() => delete loads[size]);
  loads[size] = entry;
  return entry;
}

type Picture = { source: CanvasImageSource; width: number; height: number; close(): void };

/** 1 コマを画像に戻す */
async function decode(blob: Blob): Promise<Picture> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  try {
    const im = await image(url);
    return { source: im, width: im.naturalWidth, height: im.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readHi() {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHi(hi: number) {
  try {
    localStorage.setItem(HI_KEY, String(hi));
  } catch {
    // 保存できない設定のときは、そのページにいるあいだだけ覚えている
  }
}

type Api = { warm(): void; start(): void; leave(): void; press(): void };

/** front: 手前の箱だけの写真。「Playable」の文字のすぐ上に重ねる(HomeHero の重ね順) */
export function PanelGame({ front }: { front: ReactNode }) {
  const layer = useRef<HTMLDivElement>(null);
  const seq = useRef<HTMLCanvasElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const dots = useRef<HTMLCanvasElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const api = useRef<Api | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("boot");

  useEffect(() => {
    const stage = layer.current?.closest<HTMLElement>(".stage");
    if (!stage || !layer.current || !seq.current || !still.current || !dots.current) return;
    const [layerEl, seqEl, stillEl, dotsEl] = [layer.current, seq.current, still.current, dots.current];
    const wideQuery = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let now: Mode = "idle";
    // やり直しや中断のたびに 1 増やす。待っているあいだに変わっていたら、その続きはやめる
    let run = 0;
    let wide = wideQuery.matches;
    let assets: Assets | null = null;
    let game: Runner | null = null;
    let raf = 0;
    let inView = true;
    let seen: Phase = "boot";
    const screen = new Uint8Array(COLS * ROWS);
    const shown = new Uint8Array(COLS * ROWS);

    const go = (mode: Mode) => {
      now = mode;
      setMode(mode);
    };

    /** 回り込みの進み(0 = ポスターの構図、1 = 正面)に合わせて、写真ごと拡大する。狭い画面では動かさない */
    const pose = (e: number) => {
      layerEl.style.transform = wide && e > 0 ? `translate(${(SHIFT.x * e).toFixed(3)}cqw, ${(SHIFT.y * e).toFixed(3)}cqw) scale(${(ZOOM ** e).toFixed(4)})` : "";
    };

    /** 連番を送る。dir が 1 ならポスターから正面へ、-1 なら逆。first は、最初の 1 コマを描いた直後に呼ぶ */
    const move = (dir: 1 | -1, first?: () => void) =>
      new Promise<void>((resolve) => {
        const mine = run;
        const ctx = seqEl.getContext("2d")!;
        const frames = assets!.frames;
        /** 順番 k のコマ番号 */
        const frameOf = (k: number) => (dir > 0 ? k : FRAMES - 1 - k);
        const ready: (Picture | null)[] = Array.from({ length: FRAMES }, () => null);
        const asked = new Set<number>();
        let drawn = -1;
        let began = 0;

        const ask = (k: number) => {
          if (k >= FRAMES || k <= drawn || asked.has(k)) return;
          asked.add(k);
          decode(frames[frameOf(k)]).then(
            (picture) => {
              if (k <= drawn || mine !== run) picture.close();
              else ready[k] = picture;
            },
            () => asked.delete(k),
          );
        };
        const show = (k: number) => {
          const picture = ready[k]!;
          if (seqEl.width !== picture.width || seqEl.height !== picture.height) {
            seqEl.width = picture.width;
            seqEl.height = picture.height;
          }
          ctx.clearRect(0, 0, seqEl.width, seqEl.height);
          ctx.drawImage(picture.source, 0, 0);
          for (let j = 0; j <= k; j++) {
            ready[j]?.close();
            ready[j] = null;
          }
          const t = frameOf(k) / (FRAMES - 1);
          // カメラと同じ加減速(scene.py の animate_camera)
          pose(t * t * (3 - 2 * t));
          if (drawn < 0) first?.();
          drawn = k;
        };
        const done = () => {
          ready.forEach((picture) => picture?.close());
          resolve();
        };

        // 動きを減らす設定のときは、行き先の 1 コマだけを出す
        const from = reduce ? FRAMES - 1 : 0;
        for (let k = from; k < from + AHEAD; k++) ask(k);
        const tick = (time: number) => {
          if (mine !== run) return done();
          if (!ready[from] && drawn < 0) return void requestAnimationFrame(tick);
          if (!began) began = time;
          const want = reduce ? FRAMES - 1 : Math.min(FRAMES - 1, Math.floor(((time - began) / 1000) * FPS));
          // 戻すのが間に合っていないコマは飛ばして、時間どおりに進める
          let k = want;
          while (k > drawn && !ready[k]) k--;
          if (k > drawn) show(k);
          if (drawn >= FRAMES - 1) return done();
          for (let j = Math.max(drawn + 1, want); j <= want + AHEAD; j++) ask(j);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    /** ドット画面を描く。変わった穴だけを、開いた絵か閉じた絵から切り貼りする */
    const paint = (all = false) => {
      const { on, off } = assets!;
      const ctx = dotsEl.getContext("2d")!;
      const [cw, ch] = [dotsEl.width / COLS, dotsEl.height / ROWS];
      if (all) ctx.drawImage(off, 0, 0, dotsEl.width, dotsEl.height);
      for (let i = 0; i < screen.length; i++) {
        if (all ? !screen[i] : screen[i] === shown[i]) {
          shown[i] = screen[i];
          continue;
        }
        const [x, y] = [(i % COLS) * cw, Math.floor(i / COLS) * ch];
        ctx.drawImage(screen[i] ? on : off, x, y, cw, ch, x, y, cw, ch);
        shown[i] = screen[i];
      }
    };

    const loop = (time: number, last = time) => {
      if (!game) return;
      // 画面の外にあるときや、ほかのタブを見ているときは止めておく
      if (inView && !document.hidden) game.step((time - last) / 1000);
      game.draw(screen);
      paint();
      if (game.phase !== seen) {
        seen = game.phase;
        setPhase(seen);
        if (seen === "over") saveHi(game.hi);
        if (seen === "done") return void back();
      }
      raf = requestAnimationFrame((next) => loop(next, time));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (now !== "play" || !game) return;
      if (e.key === "Escape") {
        e.preventDefault();
        game.leave();
        return;
      }
      // press any button: 文字のキー、スペース、Enter、↑ のどれでも跳ぶ。ほかのボタンやリンクを操作しているときと、
      // 画面がスクロールで外れているときは手を出さない
      if (e.ctrlKey || e.metaKey || e.altKey || !inView) return;
      if (!(e.key.length === 1 || e.key === "Enter" || e.key === "ArrowUp")) return;
      if (e.target instanceof Element && e.target.closest("a, button, input, textarea, select, summary, [contenteditable]")) return;
      e.preventDefault();
      if (!e.repeat) game.press();
    };
    const watcher = new IntersectionObserver(([entry]) => (inView = entry.intersectionRatio > 0.3), { threshold: [0, 0.3, 1] });

    const listen = (on: boolean) => {
      if (on) {
        window.addEventListener("keydown", onKeyDown);
        watcher.observe(dotsEl);
      } else {
        window.removeEventListener("keydown", onKeyDown);
        watcher.disconnect();
        inView = true;
      }
    };

    /** 絵を読み始める。Play にカーソルを乗せたときにも呼び、押してから待つ時間を減らす */
    const warm = () => {
      if (now !== "idle") return;
      const size: Size = wideQuery.matches ? "d" : "m";
      load(size).promise.catch(() => {});
      if (stillEl.dataset.size !== size) {
        stillEl.dataset.size = size;
        stillEl.sizes = STILLS[size].sizes;
        stillEl.srcset = STILLS[size].srcSet;
        stillEl.src = STILLS[size].src;
      }
    };

    const start = async () => {
      if (now !== "idle") return;
      const mine = ++run;
      wide = wideQuery.matches;
      warm();
      go("load");
      setFailed(false);
      const entry = load(wide ? "d" : "m");
      entry.listen = (ratio) => mine === run && setLoaded(ratio);
      setLoaded(entry.done / PARTS);
      try {
        [assets] = await Promise.all([entry.promise, stillEl.decode()]);
      } catch {
        if (mine !== run) return;
        setFailed(true);
        return go("idle");
      } finally {
        entry.listen = undefined;
      }
      if (mine !== run) return;

      // ドット画面の最初の絵は、パネルにもともと出ている「人」の絵。静止画と同じ見た目から始まる
      game = new Runner(readHi());
      seen = game.phase;
      setPhase(seen);
      dotsEl.width = assets.on.naturalWidth;
      dotsEl.height = assets.on.naturalHeight;
      game.draw(screen);
      paint(true);

      // 1. ポスターの文字を引かせ、ヒーローの頭が画面の上に来るように送る
      go("in");
      stage.dataset.play = "in";
      const top = stage.getBoundingClientRect().top;
      if (Math.abs(top) > 4) window.scrollTo({ top: window.scrollY + top, behavior: reduce ? "auto" : "smooth" });
      await wait(380);
      if (mine !== run) return;
      // 2. 写真を連番の 0 コマ目に替えて、正面へ回り込む
      await move(1, () => (stage.dataset.play = "on"));
      if (mine !== run) return;
      // 3. 止まったら大きな静止画とドット画面に替えて、ゲームを始める
      layerEl.dataset.end = "";
      go("play");
      listen(true);
      raf = requestAnimationFrame((time) => loop(time));
    };

    /** ゲームの画面が「人」の絵に戻ったあと、逆に回り込んでポスターへ戻る */
    const back = async () => {
      const mine = run;
      listen(false);
      game = null;
      go("out");
      delete layerEl.dataset.end;
      await wait(240);
      if (mine !== run) return;
      await move(-1);
      if (mine !== run) return;
      // 写真を下に出して最後のコマを消し(0.3 秒)、そのあと文字と、カーソルに合わせた奥行きの動きが戻る
      stage.dataset.play = "out";
      pose(0);
      await wait(700);
      if (mine !== run) return;
      delete stage.dataset.play;
      go("idle");
      playButton.current?.focus({ preventScroll: true });
    };

    /** 途中でも、すぐにポスターへ戻す(画面の幅が変わって写真の切り出し方が変わったときと、ページを離れるとき) */
    const reset = () => {
      run++;
      cancelAnimationFrame(raf);
      listen(false);
      game = null;
      delete stage.dataset.play;
      delete layerEl.dataset.end;
      pose(0);
      now = "idle";
    };
    const onResize = () => {
      if (now === "idle") return;
      reset();
      setMode("idle");
    };
    wideQuery.addEventListener("change", onResize);

    api.current = { warm, start, leave: () => game?.leave(), press: () => game?.press() };
    return () => {
      wideQuery.removeEventListener("change", onResize);
      reset();
      api.current = null;
    };
  }, []);

  // 遊び始めたら、キーを受ける場所へフォーカスを移す
  useEffect(() => {
    if (mode === "play") pad.current?.focus({ preventScroll: true });
  }, [mode]);

  const busy = mode === "load";
  const hint = phase === "run" ? null : phase === "over" ? "press any button to retry" : "press any button";

  return (
    <>
      {/* ---- 正面へ回り込む連番、止まったあとの静止画、ドット画面。建物の写真と同じ場所に重ねる ---- */}
      <div ref={layer} className="play-layer fade-m" style={LAYOUT} aria-hidden="true">
        <canvas ref={seq} className="absolute inset-0 size-full" />
        {/* eslint-disable-next-line @next/next/no-img-element -- 遊ぶときにだけ読み込む(src は warm で入れる) */}
        <img ref={still} alt="" decoding="async" draggable={false} className="play-still" />
        <canvas ref={dots} className="play-dots" />
      </div>

      {/* ---- 2 枚の写真のあいだに挟む文字。左下の箱(H03)の角が、P の肩に少しだけ掛かる。Play ボタンを兼ねる ---- */}
      <button
        ref={playButton}
        type="button"
        aria-label="Play: 建物のパネルでミニゲームを遊ぶ"
        aria-busy={busy}
        onClick={() => api.current?.start()}
        onPointerEnter={() => api.current?.warm()}
        onFocus={() => api.current?.warm()}
        className="play-word play-out poster-word pin depth a-wipe whitespace-nowrap text-[17cqw] text-ink [animation-duration:1.3s] lg:text-[8.2cqw]"
        style={at(16.4, 45.2, 4, 101, { "--depth": 1.3, "--drift": -2.6, ...d(650) })}
      >
        <span>Play</span>able
      </button>

      {front}

      {/* 斜体のひとこと。押しても始まる(Play ボタンと同じ働きなので、読み上げとタブ移動からは外す) */}
      <p
        aria-hidden="true"
        onClick={() => api.current?.start()}
        onPointerEnter={() => api.current?.warm()}
        className="play-out pin a-fade cursor-pointer whitespace-nowrap font-poster text-[3.7cqw] font-light italic text-ink lg:text-[1.35cqw]"
        style={at(51.5, 52, 66, 111.2, d(2100))}
      >
        <span className="blink">|</span> {busy ? `loading ${Math.round(loaded * 100)}%` : failed ? "try again" : "press any button"}
      </p>

      {mode === "play" && (
        <>
          {/* 押すと跳ぶ場所。広い画面は舞台の全体、狭い画面は写真のところ */}
          <div
            ref={pad}
            tabIndex={-1}
            role="application"
            aria-label="ミニゲーム。スペースキーを押すか、画面をタップすると跳びます。Esc キーで終わります"
            onPointerDown={(e) => {
              if (e.button === 0) api.current?.press();
            }}
            className="absolute inset-x-0 top-0 z-2 h-[100cqw] cursor-pointer touch-manipulation select-none outline-none lg:h-full"
          />

          <div className="pin a-wipe pointer-events-none z-3 flex items-center gap-2 bg-ink py-1.5 pl-1.5 pr-3 font-mono text-[10px] tracking-wide text-white sm:text-[11px]" style={at(2.2, 6.4, 4, 19)} aria-hidden="true">
            <span className="hl px-1">H05</span>
            <span>
              PLAYABLE PANEL <span className="opacity-60">/ 76 × 28 DOTS</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => api.current?.leave()}
            className="sweep a-fade absolute right-[4cqw] top-[19cqw] z-3 flex items-center gap-2 border border-ink px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.18em] text-ink [--sweep-from:var(--color-paper)] [--sweep-to:var(--color-ink)] hover:text-white lg:right-[2.2cqw] lg:top-[6.4cqw]"
          >
            <span className="hidden opacity-60 lg:inline" aria-hidden="true">
              [ESC]
            </span>
            EXIT <span aria-hidden="true">✕</span>
          </button>

          {/* パネルの下のひとこと */}
          <p className="pin a-fade pointer-events-none z-3 whitespace-nowrap font-poster text-[3.7cqw] font-light italic text-ink lg:text-[1.35cqw]" style={at(32, 45.4, 27, 85.5, d(900))} aria-hidden="true">
            <span className="blink">|</span>{" "}
            {hint ?? (
              <>
                <span className="lg:hidden">tap to jump</span>
                <span className="hidden lg:inline">space / click to jump</span>
              </>
            )}
          </p>
        </>
      )}
    </>
  );
}
