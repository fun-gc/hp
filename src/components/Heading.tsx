import Link from "next/link";
import type { ReactNode } from "react";
import { delay as d, stagger, type Vars } from "@/lib/motion";
import { navItems } from "@/lib/site";
import { StageMotion } from "./Motion";
import { Annot, ArrowLine, coordinates, Crosshair, DotGrid, StackPhoto, Tri, type PhotoName } from "./Poster";

const pad2 = (n: number) => String(n).padStart(2, "0");
// 奥行き(globals.css の .depth)。写真と、その手前に浮かせる英字
const BUILDING: Vars = { "--depth": 0.35, "--drift": 1.5 };
const WORD: Vars = { "--depth": 0.9, "--drift": -1.5 };
/** "WORKS" → "Works"、"JOIN US" → "Join us" */
const sentence = (en: string) => en.charAt(0) + en.slice(1).toLowerCase();

type Pt = [number, number];

/**
 * ページと、建物「THE STACK」の箱の対応。いちばん外側の列の箱が、上から順にメニューの並びになっている
 * (tools/poster-render/scene.py の SPRITE_AT)。code は建物の軒裏に書いてある箱の番号、sign は穴あきパネルの絵。
 * film は、そのページの寄りの写真(zoom-*、幅 100 × 高さ 62.5)の中での穴あきパネルの四隅で、黄色いフィルムを貼る位置
 * (scene.py の --zoom に --data を付けて書き出した type: "panel" の値。コンクリートの縁は含まない)。
 */
export const moduleOf: Record<string, { code: string; sign: string; film: Pt[] }> = {
  ABOUT: { code: "H08", sign: "CUBE", film: [[31.56, 28.13], [15.02, 24.66], [22.23, 10.36], [38.24, 13.06]] },
  COURSE: { code: "H07", sign: "STAIRS", film: [[31.04, 28.94], [6.67, 22.93], [14.29, 7.97], [38.32, 12.54]] },
  WORKS: { code: "H06", sign: "PLAY", film: [[30.6, 28.89], [17.69, 25.14], [24.69, 10.1], [37.76, 12.82]] },
  MEMBERS: { code: "H05", sign: "PLAYER", film: [[30.36, 29.42], [-0.32, 17.18], [6.26, 3.13], [37.81, 12.71]] },
  NEWS: { code: "H04", sign: "MESSAGE", film: [[30.46, 28.35], [21.77, 23.72], [27.77, 10.21], [36.89, 13.92]] },
  JOIN: { code: "H03", sign: "PLUS", film: [[30.44, 28.41], [14.16, 17.21], [19.53, 4.68], [36.77, 14.19]] },
};

/** セクションの見出し。「▲ 日本語の名前 ———」の細い行の下に、細い英字を大きく置く。画面に入ると、罫線が引かれ、英字がせり上がる */
export function SectionHead({
  ja,
  en,
  href,
  linkLabel,
  invert = false,
  id,
}: {
  /** 細い行に出す日本語の名前(作品、お知らせなど) */
  ja: string;
  en: string;
  href?: string;
  linkLabel?: string;
  invert?: boolean;
  id?: string;
}) {
  return (
    <div className="mb-9">
      <div className={`flex items-center gap-3 ${invert ? "text-white/70" : "text-muted"}`} aria-hidden="true">
        <span className="flex items-center gap-3" data-reveal="wipe">
          <Tri className={`size-3 ${invert ? "text-fun-yellow" : "text-ink"}`} />
          <span className="text-xs font-medium tracking-[0.2em]">{ja}</span>
        </span>
        <span className="h-px min-w-8 flex-1 bg-current opacity-50" data-reveal="line" style={stagger(2)} />
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h2 id={id} className={`poster-word text-6xl sm:text-8xl ${invert ? "text-white" : "text-ink"}`} data-reveal="up" style={stagger(1)}>
          {sentence(en)}
        </h2>
        {href && (
          <span data-reveal style={stagger(5)}>
            <Link
              href={href}
              className={`group flex items-center gap-3 px-1 font-mono text-xs font-medium tracking-[0.2em] transition-colors ${
                invert ? "hover:bg-fun-yellow hover:text-ink" : "hover:bg-fun-yellow"
              }`}
            >
              {linkLabel}
              <ArrowLine length="2.5rem" />
            </Link>
          </span>
        )}
      </div>
    </div>
  );
}

/** ページの中の小見出し。細い英字と、等幅の短い注記 */
export function SubHead({ children, note, id }: { children: ReactNode; note?: string; id?: string }) {
  return (
    <div className="relative mb-6 flex flex-wrap items-end gap-x-4 gap-y-1 pb-3">
      <h2 id={id} className="poster-word text-4xl sm:text-5xl" data-reveal="up">
        {children}
      </h2>
      {note && (
        <span className="pb-1" data-reveal style={stagger(3)}>
          <Annot className="text-muted">{note}</Annot>
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 h-px bg-ink" data-reveal="line" style={stagger(1)} aria-hidden="true" />
    </div>
  );
}

/**
 * 各ページのいちばん上の見出し。トップのヒーローと同じ組み方の、背の低い 1 枚。
 * そのページの箱に寄った写真を左上に置き、箱の穴あきパネルに黄色いフィルムを貼って「いまここ」を示す。
 * 読み込むと、写真 → フィルム → ページ名 → 注記の順に出る(ヒーローと同じ動き)
 */
export function PageHeading({ en, lead }: { en: string; lead?: ReactNode }) {
  const nav = navItems.findIndex((n) => n.en === en);
  const no = pad2(nav + 1);
  const mod = moduleOf[en];
  const photo = `zoom-${en.toLowerCase()}` as PhotoName;

  return (
    <header className="stage page-head -mt-16 bg-linear-to-b from-sky via-sky to-paper">
      <StageMotion />
      <StackPhoto name={photo} sizes="(min-width: 1024px) 72vw, 125vw" eager className="page-photo depth a-build" style={BUILDING} />
      <svg className="page-photo tint depth a-build pointer-events-none" style={BUILDING} viewBox="0 0 100 62.5" aria-hidden="true">
        <polygon className="a-film" style={d(650)} points={mod.film.map((p) => p.join(",")).join(" ")} fill="var(--color-fun-yellow)" />
      </svg>

      <h1 className="poster-word page-word depth text-ink" style={WORD}>
        <span className="a-up inline-block" style={d(350)}>
          {sentence(en)}
        </span>
      </h1>

      {/* 箱の番号から引き出した注記 */}
      <div className="page-note a-type flex items-start gap-2 text-ink lg:max-xl:hidden" style={d(1100)} aria-hidden="true">
        <Crosshair className="mt-0.5 size-3.5 shrink-0" />
        <Annot>
          <span className="hl px-1">{mod.code}</span> FIG.{no} — {mod.sign}
          <br />
          <span className="text-muted">1 DOT = 1 PIXEL</span>
        </Annot>
      </div>

      <div className="page-copy">
        <div className="a-wipe flex flex-wrap items-center gap-x-3 gap-y-1" style={d(500)} aria-hidden="true">
          <span className="hl whitespace-nowrap px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.2em]">
            No.{no} / {pad2(navItems.length)}
          </span>
          <ArrowLine length="2rem" />
          <Annot className="text-muted">FUNGC /{en.toLowerCase()}/</Annot>
        </div>
        {lead && (
          <p className="a-rise mt-4 max-w-md border-l border-ink pl-4 leading-relaxed text-ink-2 lg:text-[clamp(0.95rem,1.2cqw,1.125rem)]" style={d(700)}>
            {lead}
          </p>
        )}
      </div>

      {/* 右下の飾り(十分に広い画面だけ。狭いとページ名に重なる) */}
      <div className="a-fade pointer-events-none absolute bottom-[2.2cqw] right-[3cqw] hidden items-center gap-4 text-ink xl:flex" style={d(1300)} aria-hidden="true">
        <DotGrid cols={7} rows={3} gap={7} className="opacity-70" />
        <Annot className="text-muted">{coordinates}</Annot>
      </div>
    </header>
  );
}
