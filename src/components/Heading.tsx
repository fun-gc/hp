import Link from "next/link";
import type { ReactNode } from "react";
import { navItems } from "@/lib/site";
import { Annot, ArrowLine, coordinates, Crosshair, DotGrid, StackPhoto, Tri, type PhotoName } from "./Poster";

const pad2 = (n: number) => String(n).padStart(2, "0");
/** "WORKS" → "Works"、"JOIN US" → "Join us" */
const sentence = (en: string) => en.charAt(0) + en.slice(1).toLowerCase();

type Pt = [number, number];

/**
 * ページと、建物「THE STACK」の箱の対応。いちばん外側の列の箱が、上から順にメニューの並びになっている
 * (tools/poster-render/scene.py の SPRITE_AT)。code は建物の軒裏に書いてある箱の番号、sign は穴あきパネルの絵。
 * film は、そのページの寄りの写真(zoom-*、幅 100 × 高さ 62.5)の中での穴あきパネルの四隅で、黄色いフィルムを貼る位置
 * (scene.py の --zoom に --data を付けて書き出した値)。
 */
export const moduleOf: Record<string, { code: string; sign: string; film: Pt[] }> = {
  ABOUT: { code: "H08", sign: "CUBE", film: [[14.51, 25.63], [33.57, 29.68], [41.03, 12.49], [22.66, 9.44]] },
  COURSE: { code: "H07", sign: "STAIRS", film: [[6.12, 23.93], [32.94, 30.64], [41.14, 11.92], [14.75, 7.0]] },
  WORKS: { code: "H06", sign: "PLAY", film: [[17.19, 26.13], [32.07, 30.55], [40.2, 12.17], [25.12, 9.12]] },
  MEMBERS: { code: "H05", sign: "PLAYER", film: [[-0.78, 18.1], [31.77, 31.3], [40.24, 12.2], [6.66, 2.2]] },
  NEWS: { code: "H04", sign: "MESSAGE", film: [[21.35, 24.6], [31.34, 30.01], [38.69, 13.52], [28.14, 9.31]] },
  JOIN: { code: "H03", sign: "PLUS", film: [[13.78, 18.01], [31.24, 30.2], [38.49, 13.96], [19.86, 3.84]] },
};

/** セクションの見出し。「▲ [番号] 英字 ———」の細い行の下に、細い英字を大きく置く */
export function SectionHead({
  index,
  en,
  href,
  linkLabel,
  invert = false,
  id,
}: {
  index: number;
  en: string;
  href?: string;
  linkLabel?: string;
  invert?: boolean;
  id?: string;
}) {
  return (
    <div className="mb-9">
      <div className={`flex items-center gap-3 ${invert ? "text-white/70" : "text-muted"}`} aria-hidden="true">
        <Tri className={`size-3 ${invert ? "text-fun-yellow" : "text-ink"}`} />
        <span className="font-mono text-[11px]">[{pad2(index)}]</span>
        <span className="font-mono text-xs font-medium tracking-[0.25em]">{en}</span>
        <span className="h-px min-w-8 flex-1 bg-current opacity-50" />
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h2 id={id} className={`poster-word text-6xl sm:text-8xl ${invert ? "text-white" : "text-ink"}`}>
          {sentence(en)}
        </h2>
        {href && (
          <Link
            href={href}
            className={`flex items-center gap-3 px-1 font-mono text-xs font-medium tracking-[0.2em] transition-colors ${
              invert ? "hover:bg-fun-yellow hover:text-ink" : "hover:bg-fun-yellow"
            }`}
          >
            {linkLabel}
            <ArrowLine length="2.5rem" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** ページの中の小見出し。細い英字と、等幅の短い注記 */
export function SubHead({ children, note, id }: { children: ReactNode; note?: string; id?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-ink pb-3">
      <h2 id={id} className="poster-word text-4xl sm:text-5xl">
        {children}
      </h2>
      {note && <Annot className="pb-1 text-muted">{note}</Annot>}
    </div>
  );
}

/**
 * 各ページのいちばん上の見出し。トップのヒーローと同じ組み方の、背の低い 1 枚。
 * そのページの箱に寄った写真を左上に置き、箱の穴あきパネルに黄色いフィルムを貼って「いまここ」を示す。
 */
export function PageHeading({ en, lead }: { en: string; lead?: ReactNode }) {
  const nav = navItems.findIndex((n) => n.en === en);
  const no = pad2(nav + 1);
  const mod = moduleOf[en];
  const photo = `zoom-${en.toLowerCase()}` as PhotoName;

  return (
    <header className="stage page-head -mt-16 bg-linear-to-b from-sky via-sky to-paper">
      <StackPhoto name={photo} sizes="(min-width: 1024px) 72vw, 125vw" eager className="page-photo" />
      <svg className="page-photo tint pointer-events-none" viewBox="0 0 100 62.5" aria-hidden="true">
        <polygon points={mod.film.map((p) => p.join(",")).join(" ")} fill="var(--color-fun-yellow)" />
      </svg>

      <h1 className="poster-word page-word text-ink">{sentence(en)}</h1>

      {/* 箱の番号から引き出した注記 */}
      <div className="page-note flex items-start gap-2 text-ink lg:max-xl:hidden" aria-hidden="true">
        <Crosshair className="mt-0.5 size-3.5 shrink-0" />
        <Annot>
          <span className="hl px-1">{mod.code}</span> FIG.{no} — {mod.sign}
          <br />
          <span className="text-muted">1 DOT = 1 PIXEL</span>
        </Annot>
      </div>

      <div className="page-copy">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-hidden="true">
          <span className="hl whitespace-nowrap px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.2em]">
            No.{no} / {pad2(navItems.length)}
          </span>
          <ArrowLine length="2rem" />
          <Annot className="text-muted">FUNGC /{en.toLowerCase()}/</Annot>
        </div>
        {lead && <p className="mt-4 max-w-md border-l border-ink pl-4 leading-relaxed text-ink-2 lg:text-[clamp(0.95rem,1.2cqw,1.125rem)]">{lead}</p>}
      </div>

      {/* 右下の飾り(十分に広い画面だけ。狭いとページ名に重なる) */}
      <div className="pointer-events-none absolute bottom-[2.2cqw] right-[3cqw] hidden items-center gap-4 text-ink xl:flex" aria-hidden="true">
        <DotGrid cols={7} rows={3} gap={7} className="opacity-70" />
        <Annot className="text-muted">{coordinates}</Annot>
      </div>
    </header>
  );
}
