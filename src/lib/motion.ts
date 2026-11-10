// 動きの順番を CSS 変数で渡すための小さな道具(見た目は globals.css の「動き」)。
import type { CSSProperties } from "react";

export type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** 登場の動き(a-*)が始まるまでのミリ秒 */
export const delay = (ms: number): Vars => ({ "--d": ms });

/** スクロールで出てくる要素(data-reveal)を、i 番目として少しずつ遅らせる。長い一覧でも待たせすぎないよう、max で頭打ちにする */
export const stagger = (i: number, max = 8): Vars => ({ "--i": Math.min(i, max) });
