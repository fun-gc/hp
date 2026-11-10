import Link from "next/link";
import type { CSSProperties } from "react";
import { site } from "@/lib/site";
import { Annot, ArcText, ArrowLine, Chevrons, CircleRow, coordinates, CrossTriangles, DotGrid, Eye, FarShore, StackPhoto, Tri } from "./Poster";

// トップページのヒーロー。1 枚のポスターとして組む:
//   空と霧の向こうの函館山 → 建物(切り抜き写真)→ 文字 → 手前の箱だけの写真 → 注記と線、の順に重ねる。
//   文字を 2 枚の写真のあいだに挟むので、黄色い大文字や細い英字の一部が、せり出した箱の後ろに回り込んで見える。
// 中の位置は、舞台(.stage)の幅を 100 とした単位。広い画面は横長(100 × 56.25)、狭い画面は縦長に組み直す。

/** 位置を CSS 変数で渡す(globals.css の .pin)。x, y は広い画面、mx, my は狭い画面 */
const at = (x: number, y: number, mx: number, my: number) => ({ "--x": x, "--y": y, "--mx": mx, "--my": my }) as CSSProperties;

// 写真の置き方。レンダーした絵(幅 100 × 高さ 58.33)を、広い画面では少し大きくして左上へずらし、右下に空を広く取る。
// 狭い画面では、絵のまん中(横 28%〜74%)を切り出した縦長の写真を使う。建物と文字の重なり方は、広い画面と同じになる。
const DESK = { scale: 1.1, x: -12, y: -6 };
const MOB = { scale: 100 / 46, x: -28 * (100 / 46), y: 0 };
type Pt = [number, number];
const place = (m: typeof DESK) => (p: Pt) => `${(p[0] * m.scale + m.x).toFixed(2)},${(p[1] * m.scale + m.y).toFixed(2)}`;

// 建物の面の四隅(レンダーした絵の中での位置。tools/poster-render/scene.py の --data で書き出した値)
const FACE = {
  // H05(MEMBERS)の穴あきパネルの面
  members: [[23.68, 35.26], [39.91, 41.89], [44.2, 32.54], [27.71, 27.45]] as Pt[],
};

// 黄色い大文字。建物の上から空へ、右下がりに並べる。N と G は、手前の箱(H07)の後ろに一部が隠れる位置に置く。
// F は、幅 1024px の画面でもヘッダー(高さ 4rem = 6.25cqw)の下に隠れない高さから始める
const letters: { ch: string; pos: CSSProperties }[] = [
  { ch: "F", pos: at(20.8, 6.9, 4.3, 22.2) },
  { ch: "U", pos: at(29.6, 12, 21.3, 34.3) },
  { ch: "N", pos: at(38.9, 17.6, 39.8, 46.7) },
  { ch: "G", pos: at(48.4, 23.9, 58.5, 59.1) },
  { ch: "C", pos: at(57.5, 30.8, 76, 73.2) },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

export function HomeHero({ works, members, upcoming }: { works: number; members: number; upcoming: number }) {
  const d = place(DESK);
  const m = place(MOB);
  const stats: [string, number][] = [
    ["WORKS", works],
    ["MEMBERS", members],
    ["UPCOMING", upcoming],
  ];

  return (
    <section className="stage hero -mt-16 bg-linear-to-b from-sky via-sky to-paper" aria-labelledby="hero-title">
      {/* ---- 奥: 霧の向こうの函館山 ---- */}
      <FarShore className="pin w-[150cqw] max-w-none opacity-90 lg:w-[62cqw]" style={at(51.6, 40, -22, 116)} />

      {/* ---- 建物 ---- */}
      <StackPhoto name="stack-day" narrow="stack-day-m" sizes="110vw" eager className="hero-photo fade-m" />

      {/* ---- 2 枚の写真のあいだに挟む文字 ---- */}
      <p aria-hidden="true" className="poster-word pin whitespace-nowrap text-[17cqw] text-ink lg:text-[8.2cqw]" style={at(15.2, 45.2, 4, 101)}>
        Playable
      </p>
      <div aria-hidden="true">
        {letters.map((l) => (
          <span key={l.ch} data-ch={l.ch} className="title-letter pin text-[26cqw] lg:text-[13.2cqw]" style={l.pos}>
            {l.ch}
          </span>
        ))}
      </div>

      {/* ---- 手前の箱 ---- */}
      <StackPhoto name="stack-front" narrow="stack-front-m" sizes="110vw" eager className="hero-photo fade-m pointer-events-none" />

      {/* 面に貼った黄色いフィルム(乗算)。手前の箱の写真より上に置く */}
      <svg className="tint pointer-events-none absolute inset-0 hidden size-full lg:block" viewBox="0 0 100 56.25" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
        <polygon points={FACE.members.map(d).join(" ")} fill="var(--color-fun-yellow)" />
      </svg>
      <svg className="tint fade-m pointer-events-none absolute left-0 top-0 w-full lg:hidden" viewBox="0 0 100 126.8" aria-hidden="true">
        <polygon points={FACE.members.map(m).join(" ")} fill="var(--color-fun-yellow)" />
      </svg>

      {/* ---- 線(広い画面)。箱の角から引き出した線と、弧 ---- */}
      <svg className="pointer-events-none absolute inset-0 hidden size-full lg:block" viewBox="0 0 100 56.25" preserveAspectRatio="xMinYMin slice" aria-hidden="true" fill="none">
        <g stroke="var(--color-fun-yellow)" strokeWidth="1.5">
          {/* H07 の角から、見出しへ引き出す線 */}
          <line x1="59.3" y1="27.7" x2="66.3" y2="25.8" vectorEffect="non-scaling-stroke" />
          {/* 大きな弧 */}
          <path d="M -4 20 A 58 58 0 0 0 62 60" vectorEffect="non-scaling-stroke" strokeWidth="1" />
        </g>
        {/* H08 の角から、注記へ引き出す線 */}
        <line x1="68.2" y1="19" x2="72.3" y2="19" stroke="var(--color-ink)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx="59.3" cy="27.7" r="0.45" fill="var(--color-fun-yellow)" />
        <circle cx="68.2" cy="19" r="0.3" fill="var(--color-ink)" />
      </svg>

      {/* ---- 注記 ---- */}
      <div className="pin flex items-center gap-3 bg-ink py-1.5 pl-1.5 pr-3 text-white lg:max-xl:hidden" style={at(2.2, 6.4, 40, 19)}>
        <Eye className="size-6 lg:size-7" />
        <Annot>
          No[01]
          <br />
          {site.universityEn.toUpperCase()}
        </Annot>
      </div>

      {/* 箱の番号から引き出した注記(広い画面) */}
      <div className="pin hidden items-start gap-2 text-ink lg:flex" style={at(73, 18.2, 0, 0)}>
        <Annot>
          <span className="hl px-1">H08</span> FIG.01 — THE STACK
          <br />
          6000 × 6000 × 6000 / RC + AL
          <br />
          <span className="text-muted">1 DOT = 1 PIXEL</span>
        </Annot>
      </div>

      {/* 右上の飾り */}
      <div aria-hidden="true" className="pin hidden w-[8cqw] flex-col gap-[0.7cqw] text-ink lg:flex" style={at(88.5, 6.2, 0, 0)}>
        <div className="flex items-center justify-between">
          <CircleRow className="h-[0.9cqw]" />
          <span className="font-mono text-[0.8cqw] leading-none">↔</span>
        </div>
        <CrossTriangles className="w-full" />
        <div className="flex items-end justify-between">
          <Tri className="size-[1cqw]" />
          <DotGrid cols={6} rows={2} gap={7} className="opacity-70" />
        </div>
      </div>

      {/* 縦書きの注記 */}
      <p aria-hidden="true" className="pin hidden font-mono text-[11px] tracking-[0.28em] text-ink [writing-mode:vertical-rl] lg:block" style={at(97.2, 23, 0, 0)}>
        waiting for player 2
      </p>

      {/* 黄色い面の中の注記(広い画面)。面の上の辺に沿わせて傾ける */}
      <p aria-hidden="true" className="pin hidden origin-top-left rotate-[17deg] font-mono text-[0.8cqw] font-medium leading-tight text-ink lg:block" style={at(19.6, 25.6, 0, 0)}>
        [0–100]
        <br />
        MEMBERS {pad2(members)}
      </p>

      {/* 下の空: 円に沿った文字と、斜体のひとこと */}
      <ArcText
        text="A GOOD BEGINNING MAKES A GOOD GAME"
        className="pin hidden w-[16cqw] text-ink lg:block"
        style={at(49.8, 44.2, 0, 0)}
        start={-152}
        span={124}
      />
      <p aria-hidden="true" className="pin hidden font-poster text-[1.35cqw] font-light italic text-ink lg:block" style={at(51.5, 52, 0, 0)}>
        | press any button
      </p>

      {/* ---- 見出しと本文 ---- */}
      <div className="hero-copy">
        <div className="flex items-center gap-3">
          <span className="hl whitespace-nowrap px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.2em]">GAME DEV</span>
          <ArrowLine length="2rem" />
          <Annot className="text-muted">
            UNITY / COURSE <span className="hidden sm:inline lg:hidden xl:inline">/ EXHIBITION / TEAM</span>
          </Annot>
        </div>
        <h1 id="hero-title" className="poster-word mt-4 text-[15.5cqw] text-ink lg:mt-[1.3cqw] lg:text-[4.9cqw]">
          Game <br className="lg:hidden" />
          Creators<span className="text-fun-red">.</span>
        </h1>
        <p className="mt-4 max-w-md border-l border-ink pl-4 leading-relaxed text-ink-2 lg:mt-[1.5cqw] lg:text-[clamp(0.9rem,1.15cqw,1.125rem)]">
          Discord と学内を拠点として、Unity の講座、展示、チーム開発をしています。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 lg:mt-[1.6cqw]">
          <Link
            href="/join/"
            className="group flex items-center gap-3 bg-ink px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] text-white transition-colors hover:bg-fun-yellow hover:text-ink"
          >
            JOIN US
            <ArrowLine length="1.5rem" />
          </Link>
          <Link
            href="/works/"
            className="border border-ink px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] transition-colors hover:bg-ink hover:text-white"
          >
            WORKS
          </Link>
        </div>
        <dl className="mt-7 flex gap-7 font-mono text-ink lg:mt-[2.3cqw]">
          {stats.map(([label, n]) => (
            <div key={label}>
              <dt className="text-[10px] tracking-[0.2em] text-muted">{label}</dt>
              <dd className="font-poster text-4xl font-light leading-none tabular-nums lining-nums lg:text-[clamp(2rem,2.9cqw,2.75rem)]">{pad2(n)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 右下: 位置の注記 */}
      <div aria-hidden="true" className="pin hidden items-center gap-3 text-ink xl:flex" style={at(86, 52.6, 0, 0)}>
        <Chevrons className="w-3" count={2} />
        <Annot>{coordinates}</Annot>
      </div>
    </section>
  );
}
