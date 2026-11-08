import type { CSSProperties } from "react";

/** アニメーションを遅らせる秒数を CSS 変数 --d で渡す。globals.css の anim-* がこの値を読む */
export const delay = (seconds: number): CSSProperties => ({ "--d": `${seconds}s` }) as CSSProperties;

/**
 * 最初の描画より前に html へ data-motion="boot" を付け、スクロールで出てくる要素(data-reveal)を隠しておく。
 * 動きを減らす設定の人と、IntersectionObserver のないブラウザでは付けないので、最初からすべて表示される。
 * 出すのは RevealOnScroll(読み込み後に data-motion="on" に切り替える)。
 */
export const motionBootScript = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&"IntersectionObserver"in window)document.documentElement.setAttribute("data-motion","boot")}catch(e){}`;
