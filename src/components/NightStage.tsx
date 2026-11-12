import type { CSSProperties, ReactNode } from "react";
import { Annot, Chevrons, coordinates, FarShore, StackPhoto } from "./Poster";

const at = (x: number, y: number, mx = 0, my = 0) => ({ "--x": x, "--y": y, "--mx": mx, "--my": my }) as CSSProperties;

/**
 * 夜の建物を敷いた 1 枚。ヒーローと同じカメラなので、同じ建物に明かりが入ったように見える。
 * 穴あきパネルの絵が黄色く光り、霧の向こうには函館の街の明かりが並ぶ。中身(children)は右下の空に置く。
 * トップの「Join us」と /join/ の「Contact」で使う。
 * 画面に入ると、蛍光灯がつくときのように明かりが 2、3 度またたいてからともり、少し遅れて街の明かりが浮かぶ(globals.css の lights)
 */
export function NightStage({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <section className="stage night text-white" aria-labelledby={labelledBy} data-reveal="lights" data-reveal-at="0.3">
      <FarShore night className="night-shore pin w-[150cqw] max-w-none lg:w-[62cqw]" style={at(40, 25.5, -22, 58)} />
      <StackPhoto name="stack-night" narrow="stack-night-m" sizes="110vw" className="night-photo" />

      <div className="night-note pin hidden items-center gap-3 text-white/70 lg:flex" style={at(84, 3.5)} aria-hidden="true">
        <Chevrons className="w-3 text-fun-yellow" count={2} />
        <Annot>
          LIGHTS ON — 18:00
          <br />
          {coordinates}
        </Annot>
      </div>

      <div className="night-copy">{children}</div>
    </section>
  );
}
