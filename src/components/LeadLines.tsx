"use client";

import { useEffect, useRef } from "react";
import { delay } from "@/lib/motion";

// ヒーローに引く、細くぼやけた黒い線。どちらも「JOIN US」のボタンのそばを通り、視線をボタンへ運ぶ。
// 目立ち方は、FUNGC の後ろの斜めの細い線と同じくらいにする。出し方もその線と同じで、
// 同じ時間に左から引いていく(globals.css の anim-wipe)。
// 線の位置はボタンの位置から計算するので、画面の幅が変わってもボタンのところで交わる。
// ボタンには data-lead-target、ボタンを含む文章の箱には data-lead-copy を付けておく。

type Line = {
  /** 傾き(度)。0 で右向き、マイナスで右上がり */
  angle: number;
  /** ボタンのどこを通るか(左上が 0,0、右下が 1,1)と、そこからの上下のずれ(px) */
  at: [number, number];
  shiftY: number;
  /** 線の太さ(px)と濃さ */
  width: number;
  opacity: number;
};

const LINES: Line[] = [
  // 右上の写真から、ボタンの中心を抜けて左下へ
  { angle: -36, at: [0.5, 0.5], shiftY: 0, width: 0.5, opacity: 0.5 },
  // 右端から、ボタンのすぐ上をかすめて左端へ
  { angle: 3.8, at: [0.5, 0], shiftY: -6, width: 0.4, opacity: 0.45 },
];

// 線の端がぼやけて見えないよう、枠の外まで少し伸ばす(はみ出した分は枠で切れる)
const OVERRUN = 8;

/** 変形(アニメーション中の移動など)を無視した、root から見た要素の位置 */
function layoutBox(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export function LeadLines() {
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  useEffect(() => {
    const svg = svgRef.current;
    const section = svg?.parentElement;
    const target = section?.querySelector<HTMLElement>("[data-lead-target]");
    const copy = section?.querySelector<HTMLElement>("[data-lead-copy]");
    if (!svg || !section || !target) return;

    const place = () => {
      const width = section.clientWidth;
      const height = section.clientHeight;
      const box = layoutBox(target, section);
      if (!width || !height || !box.w) return;
      LINES.forEach((line, i) => {
        const el = lineRefs.current[i];
        if (!el) return;
        const rad = (line.angle * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const px = box.x + box.w * line.at[0];
        const py = box.y + box.h * line.at[1] + line.shiftY;
        // 点 (px, py) を通る直線が、ヒーローの枠に入るところと出るところ
        const tx = [(0 - px) / dx, (width - px) / dx].sort((a, b) => a - b);
        const ty = dy === 0 ? [-Infinity, Infinity] : [(0 - py) / dy, (height - py) / dy].sort((a, b) => a - b);
        const enter = Math.max(tx[0], ty[0]) - OVERRUN;
        const exit = Math.min(tx[1], ty[1]) + OVERRUN;
        el.setAttribute("x1", String(px + dx * enter));
        el.setAttribute("y1", String(py + dy * enter));
        el.setAttribute("x2", String(px + dx * exit));
        el.setAttribute("y2", String(py + dy * exit));
      });
    };

    // ボタン自体の大きさの変化(カーソルを乗せたときに矢印が伸びるなど)では引き直さない。
    // 引き直すのは、ヒーローや文章の箱の大きさが変わったときと、文字の読み込みが終わったときだけ
    const ro = new ResizeObserver(place);
    ro.observe(section);
    if (copy) ro.observe(copy);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="anim-wipe pointer-events-none absolute inset-0 z-[5] size-full blur-[0.3px]"
      style={delay(0.4)}
    >
      {LINES.map((line, i) => (
        <line
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          stroke="var(--color-ink)"
          strokeWidth={line.width}
          strokeOpacity={line.opacity}
        />
      ))}
    </svg>
  );
}
