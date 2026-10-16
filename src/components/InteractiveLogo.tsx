"use client";

import { useEffect, useRef, useState } from "react";
import { FX_DURATION, FX_MARGIN, LogoFx, type FxKind } from "./logoEffects";
import { LogoLetters } from "./Logo";

type Face = "top" | "left" | "right";

// トップページのロゴ。マウスに合わせて少し傾き、立方体の面を押すと飛び出して演出が出る。
// 赤い面は隙間から炎、緑の面は草木、黄色の面は電気。
const faces: { id: Face; points: string; color: string; push: string; label: string; fx: FxKind }[] = [
  { id: "top", points: "610,160 1062,402 610,646 158,402", color: "var(--color-fun-red)", push: "translate(0px,-60px)", label: "赤い面", fx: "fire" },
  { id: "left", points: "158,402 610,646 610,1140 158,898", color: "var(--color-fun-green)", push: "translate(-52px,30px)", label: "緑の面", fx: "plant" },
  { id: "right", points: "610,646 1062,402 1062,898 610,1140", color: "var(--color-fun-yellow)", push: "translate(52px,30px)", label: "黄色の面", fx: "electric" },
];

export function InteractiveLogo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<LogoFx | null>(null);
  const timers = useRef(new Map<Face, number>());
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [popped, setPopped] = useState<Set<Face>>(new Set());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fx = new LogoFx(canvas);
    fxRef.current = fx;
    const pending = timers.current;
    return () => {
      fx.dispose();
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * 14, y: px * 18 });
  }

  function press(face: (typeof faces)[number]) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) fxRef.current?.play(face.fx);
    setPopped((s) => new Set(s).add(face.id));
    window.clearTimeout(timers.current.get(face.id));
    timers.current.set(
      face.id,
      window.setTimeout(() => {
        setPopped((s) => {
          const next = new Set(s);
          next.delete(face.id);
          return next;
        });
      }, FX_DURATION * 1000),
    );
  }

  const outside = `${-FX_MARGIN * 100}%`;
  const size = `${(1 + FX_MARGIN * 2) * 100}%`;

  return (
    <div
      ref={ref}
      className={className}
      style={{ perspective: "900px" }}
      onPointerMove={handleMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div
        className="relative size-full transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <svg viewBox="0 0 1210 1280" role="img" aria-label="FUN GC のロゴ" className="h-full w-full overflow-visible">
          <g stroke="var(--color-paper)" strokeWidth={22} strokeLinejoin="round">
            {faces.map((f) => (
              <polygon
                key={f.id}
                points={f.points}
                fill={f.color}
                role="button"
                tabIndex={0}
                aria-label={`${f.label}を押す`}
                className="cursor-pointer outline-none transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] focus-visible:opacity-80 motion-reduce:transition-none"
                style={{ transform: popped.has(f.id) ? f.push : "none" }}
                onClick={() => press(f)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    press(f);
                  }
                }}
              />
            ))}
          </g>
          <g className="pointer-events-none">
            <LogoLetters />
          </g>
        </svg>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: outside, top: outside, width: size, height: size }}
        />
      </div>
    </div>
  );
}
