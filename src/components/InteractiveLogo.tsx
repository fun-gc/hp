"use client";

import { useRef, useState } from "react";
import { LogoLetters } from "./Logo";

type Face = "top" | "left" | "right";

// トップページのロゴ。マウスに合わせて少し傾き、立方体の面を押すと飛び出す。
const faces: { id: Face; points: string; color: string; push: string; label: string }[] = [
  { id: "top", points: "610,160 1062,402 610,646 158,402", color: "var(--color-fun-red)", push: "translate(0px,-60px)", label: "赤い面" },
  { id: "left", points: "158,402 610,646 610,1140 158,898", color: "var(--color-fun-green)", push: "translate(-52px,30px)", label: "緑の面" },
  { id: "right", points: "610,646 1062,402 1062,898 610,1140", color: "var(--color-fun-yellow)", push: "translate(52px,30px)", label: "黄色の面" },
];

export function InteractiveLogo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [popped, setPopped] = useState<Face | null>(null);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * 14, y: px * 18 });
  }

  function toggle(face: Face) {
    setPopped((current) => (current === face ? null : face));
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{ perspective: "900px" }}
      onPointerMove={handleMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <svg
        viewBox="0 0 1210 1280"
        role="img"
        aria-label="FUNGC のロゴ"
        className="h-full w-full overflow-visible transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <g stroke="var(--color-paper)" strokeWidth={22} strokeLinejoin="round">
          {faces.map((f) => (
            <polygon
              key={f.id}
              points={f.points}
              fill={f.color}
              role="button"
              tabIndex={0}
              aria-label={`${f.label}を動かす`}
              aria-pressed={popped === f.id}
              className="cursor-pointer outline-none transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] focus-visible:opacity-80 motion-reduce:transition-none"
              style={{ transform: popped === f.id ? f.push : "none" }}
              onClick={() => toggle(f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(f.id);
                }
              }}
            />
          ))}
        </g>
        <g className="pointer-events-none">
          <LogoLetters />
        </g>
      </svg>
    </div>
  );
}
