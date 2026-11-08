"use client";

import { useEffect, useRef } from "react";

// ヒーローに引く、ぼやけた黒い線。どちらも「JOIN US」のボタンのそばを通り、写真の側(右)から順に引いて、
// 視線をボタンへ運ぶ。線の位置はボタンの位置から計算するので、画面の幅が変わってもボタンのところで交わる。
// ボタンには data-lead-target、ボタンを含む文章の箱には data-lead-copy を付けておく。

type Line = {
  /** 傾き(度)。0 で右向き、マイナスで右上がり */
  angle: number;
  /** ボタンのどこを通るか(左上が 0,0、右下が 1,1)と、そこからの上下のずれ(px) */
  at: [number, number];
  shiftY: number;
};

const LINES: Line[] = [
  // 右上の写真から、ボタンの中心を抜けて左下へ
  { angle: -36, at: [0.5, 0.5], shiftY: 0 },
  // 右端から、ボタンのすぐ上をかすめて左端へ
  { angle: 3.8, at: [0.5, 0], shiftY: -6 },
];

// 線の端がぼやけて見えないよう、枠の外まで少し伸ばす(はみ出した分は枠で切れる)
const OVERRUN = 40;

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
  const layerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const layer = layerRef.current;
    const section = layer?.parentElement;
    const target = section?.querySelector<HTMLElement>("[data-lead-target]");
    const copy = section?.querySelector<HTMLElement>("[data-lead-copy]");
    if (!layer || !section || !target) return;

    const place = () => {
      const width = layer.clientWidth;
      const height = layer.clientHeight;
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
        // 右側の端から左へ向けて引く
        el.style.left = `${px + dx * exit}px`;
        el.style.top = `${py + dy * exit}px`;
        el.style.width = `${exit - enter}px`;
        el.style.transform = `rotate(${line.angle + 180}deg)`;
        el.setAttribute("data-on", "");
      });
    };

    const ro = new ResizeObserver(place);
    ro.observe(layer);
    ro.observe(target);
    if (copy) ro.observe(copy);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={layerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {LINES.map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          className={`lead-line ${i === 0 ? "lead-line-a" : "lead-line-b"}`}
        />
      ))}
    </div>
  );
}
