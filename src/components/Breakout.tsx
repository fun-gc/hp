"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cube } from "./Cube";

// ロゴの 3 面を全部押すと始まるブロック崩し(隠し要素)。
// 盤面は 400×560 の論理座標で計算し、表示の大きさに合わせて拡大する。
const W = 400;
const H = 560;
const COLS = 8;
const ROWS = 6;
const PAD = 16;
const GAP = 6;
const BRICK_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
const BRICK_H = 18;
const BRICK_TOP = 56;
const PADDLE_W = 76;
const PADDLE_H = 12;
const PADDLE_Y = H - 40;
const PADDLE_SPEED = 520;
const BALL_R = 7;
const BALL_SPEED = 340;
const BALL_SPEED_MAX = 540;
const LIVES = 3;

// 段ごとの色。テンプレートの赤・黄・緑を上から 2 段ずつ。
const rowColors = ["--color-fun-red", "--color-fun-red", "--color-fun-yellow", "--color-fun-yellow", "--color-fun-green", "--color-fun-green"];
const rowPoints = [30, 30, 20, 20, 10, 10];

type Status = "ready" | "playing" | "over" | "clear";
type Brick = { x: number; y: number; row: number; alive: boolean };

function makeBricks(): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({ x: PAD + col * (BRICK_W + GAP), y: BRICK_TOP + row * (BRICK_H + GAP), row, alive: true });
    }
  }
  return bricks;
}

function newGame() {
  return {
    bricks: makeBricks(),
    paddleX: (W - PADDLE_W) / 2,
    ball: { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0, speed: BALL_SPEED },
    score: 0,
    lives: LIVES,
    status: "ready" as Status,
  };
}

export function Breakout({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef(newGame());
  const keys = useRef({ left: false, right: false });
  const [hud, setHud] = useState({ score: 0, lives: LIVES, status: "ready" as Status });

  const launch = useCallback(() => {
    const g = game.current;
    if (g.status !== "ready") return;
    const angle = (Math.random() - 0.5) * (Math.PI / 3);
    g.ball.vx = g.ball.speed * Math.sin(angle);
    g.ball.vy = -g.ball.speed * Math.cos(angle);
    g.status = "playing";
    setHud((h) => ({ ...h, status: "playing" }));
  }, []);

  const restart = useCallback(() => {
    game.current = newGame();
    setHud({ score: 0, lives: LIVES, status: "ready" });
    canvasRef.current?.focus();
  }, []);

  // 開いている間はページのスクロールを止め、閉じたら元の場所へフォーカスを戻す
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    canvasRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      if (e.key === "Escape" && down) {
        onClose();
        return;
      }
      // ボタンにフォーカスがあるときは、スペースキーをボタンの操作に任せる
      if (e.target instanceof HTMLButtonElement) return;
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = down;
      else if (e.key === "ArrowRight" || e.key === "d") keys.current.right = down;
      else if (e.key === " " && down) launch();
      else return;
      e.preventDefault();
    }
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [launch, onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const ink = color("--color-ink");
    const paper = color("--color-paper");
    const brickColors = rowColors.map(color);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    function update(dt: number) {
      const g = game.current;
      const dir = Number(keys.current.right) - Number(keys.current.left);
      g.paddleX = Math.min(W - PADDLE_W, Math.max(0, g.paddleX + dir * PADDLE_SPEED * dt));

      const b = g.ball;
      if (g.status === "ready") {
        b.x = g.paddleX + PADDLE_W / 2;
        b.y = PADDLE_Y - BALL_R;
        return;
      }
      if (g.status !== "playing") return;

      // 速い球がブロックをすり抜けないよう、1 回に 4px 以下ずつ進める
      const steps = Math.ceil((b.speed * dt) / 4);
      for (let i = 0; i < steps; i++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;

        if (b.x < BALL_R) {
          b.x = BALL_R;
          b.vx = Math.abs(b.vx);
        } else if (b.x > W - BALL_R) {
          b.x = W - BALL_R;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < BALL_R) {
          b.y = BALL_R;
          b.vy = Math.abs(b.vy);
        }

        // パドルの当たった位置で跳ね返る角度を変える(端ほど横向き、最大 60 度)
        if (
          b.vy > 0 &&
          b.y + BALL_R >= PADDLE_Y &&
          b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
          b.x >= g.paddleX - BALL_R &&
          b.x <= g.paddleX + PADDLE_W + BALL_R
        ) {
          const hit = Math.max(-1, Math.min(1, (b.x - (g.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)));
          const angle = hit * (Math.PI / 3);
          b.vx = b.speed * Math.sin(angle);
          b.vy = -b.speed * Math.cos(angle);
          b.y = PADDLE_Y - BALL_R;
        }

        for (const brick of g.bricks) {
          if (!brick.alive) continue;
          const nx = Math.max(brick.x, Math.min(b.x, brick.x + BRICK_W));
          const ny = Math.max(brick.y, Math.min(b.y, brick.y + BRICK_H));
          if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > BALL_R ** 2) continue;

          brick.alive = false;
          // めり込みの浅い向きに跳ね返す
          const overlapX = Math.min(b.x + BALL_R - brick.x, brick.x + BRICK_W - (b.x - BALL_R));
          const overlapY = Math.min(b.y + BALL_R - brick.y, brick.y + BRICK_H - (b.y - BALL_R));
          if (overlapX < overlapY) b.vx = -b.vx;
          else b.vy = -b.vy;

          b.speed = Math.min(BALL_SPEED_MAX, b.speed + 4);
          const scale = b.speed / Math.hypot(b.vx, b.vy);
          b.vx *= scale;
          b.vy *= scale;
          g.score += rowPoints[brick.row];
          if (g.bricks.every((x) => !x.alive)) g.status = "clear";
          setHud({ score: g.score, lives: g.lives, status: g.status });
          break;
        }
        if (g.status === "clear") return;

        if (b.y - BALL_R > H) {
          g.lives -= 1;
          g.status = g.lives > 0 ? "ready" : "over";
          b.speed = BALL_SPEED;
          setHud({ score: g.score, lives: g.lives, status: g.status });
          return;
        }
      }
    }

    function draw() {
      const g = game.current;
      ctx!.fillStyle = ink;
      ctx!.fillRect(0, 0, W, H);
      for (const brick of g.bricks) {
        if (!brick.alive) continue;
        ctx!.fillStyle = brickColors[brick.row];
        ctx!.fillRect(brick.x, brick.y, BRICK_W, BRICK_H);
      }
      ctx!.fillStyle = paper;
      ctx!.fillRect(g.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
      if (g.status === "ready" || g.status === "playing") {
        ctx!.beginPath();
        ctx!.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    let frame = 0;
    let last = performance.now();
    function loop(now: number) {
      // タブを離れていた後などに球が飛ばないよう、1 フレームの時間に上限を付ける
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  function handlePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    game.current.paddleX = Math.min(W - PADDLE_W, Math.max(0, x - PADDLE_W / 2));
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ブロック崩し"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
    >
      {/* 縦に収まる幅に絞り、盤面の縦横比を保つ */}
      <div className="flex w-full max-w-[min(400px,calc((100dvh-9rem)*5/7))] flex-col gap-3 text-white">
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-lg font-bold tracking-widest">SCORE {hud.score}</p>
          <div className="flex items-center gap-1" aria-label={`残り ${hud.lives}`}>
            {Array.from({ length: LIVES }, (_, i) => (
              <span key={i} className={i < hud.lives ? "" : "opacity-25"}>
                <Cube color="red" className="size-5" />
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-white px-3 py-1 text-sm font-bold transition hover:bg-white hover:text-ink"
          >
            閉じる
          </button>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="ゲーム画面。左右キーかマウスでパドルを動かします"
            className="block aspect-[400/560] w-full touch-none bg-ink outline-none ring-white/40 focus-visible:ring-2"
            onPointerMove={handlePointer}
            onPointerDown={(e) => {
              handlePointer(e);
              launch();
            }}
          />
          {hud.status !== "playing" && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4 text-center">
              {hud.status === "ready" ? (
                <p className="bg-ink/70 px-3 py-2 text-sm font-bold">
                  クリック・タップ・スペースキーで発射
                </p>
              ) : (
                <>
                  <p className="font-display text-3xl font-black tracking-widest">
                    {hud.status === "clear" ? "CLEAR!" : "GAME OVER"}
                  </p>
                  <button
                    type="button"
                    onClick={restart}
                    className="pointer-events-auto bg-fun-yellow px-6 py-2 font-bold text-ink transition hover:bg-white"
                  >
                    もう一度遊ぶ
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/70">
          ← → キーかマウス・指でパドルを動かします。Esc で閉じます。
        </p>
      </div>
    </div>,
    document.body,
  );
}
