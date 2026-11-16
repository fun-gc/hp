"use client";

import { useEffect, useRef } from "react";

/**
 * 夜の建物(NightStage)の明かりをともす。舞台(.night)が 3 割見えたら、明かりが 2、3 度またたいてからともり、
 * 少し遅れて街の明かりと注記が浮かぶ(globals.css の lights)。
 * 消した状態は JS が動いてから付けるので、JS が動かないときは最初から明かりがついている。動きを減らす設定のときは何もしない
 */
export function LightsOn() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const stage = ref.current?.closest<HTMLElement>(".night");
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    stage.dataset.lights = "off";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        stage.dataset.lights = "on";
        io.disconnect();
      },
      { threshold: 0.3 },
    );
    io.observe(stage);
    return () => {
      io.disconnect();
      delete stage.dataset.lights;
    };
  }, []);
  return <span ref={ref} hidden />;
}
