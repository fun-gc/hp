"use client";

import { useEffect, useRef } from "react";

/**
 * ポスターの舞台(.stage)に奥行きを付ける。カーソルの位置を --px / --py(-1〜1)、スクロールの進みを --s(0〜1)として
 * 舞台に入れ、中の層(data-depth の付いた要素)が、それぞれ違う量だけ動く(globals.css)。
 * 舞台が画面に見えている間だけ動かす。動きを減らす設定のときは何もしない
 */
export function StageMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = ref.current?.closest<HTMLElement>(".stage");
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let raf = 0;
    let visible = false;
    // 目標の値と、いまの値。いまの値を目標へ少しずつ寄せて、動きをなめらかにする
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0, s: -1 };

    const frame = () => {
      raf = 0;
      const rect = stage.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      now.x += (target.x - now.x) * 0.07;
      now.y += (target.y - now.y) * 0.07;
      const moving = Math.abs(target.x - now.x) > 0.002 || Math.abs(target.y - now.y) > 0.002;
      stage.style.setProperty("--px", now.x.toFixed(4));
      stage.style.setProperty("--py", now.y.toFixed(4));
      if (s !== now.s) {
        now.s = s;
        stage.style.setProperty("--s", s.toFixed(4));
      }
      if (moving && visible) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = stage.getBoundingClientRect();
      target.x = Math.min(1, Math.max(-1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
      target.y = Math.min(1, Math.max(-1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(stage);
    window.addEventListener("scroll", kick, { passive: true });
    if (hover) {
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerleave", onLeave);
    }
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", kick);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      for (const k of ["--px", "--py", "--s"]) stage.style.removeProperty(k);
    };
  }, []);
  return <span ref={ref} hidden />;
}
