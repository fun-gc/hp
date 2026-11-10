import Link from "next/link";
import { delay as d, type Vars } from "@/lib/motion";
import { navItems, site } from "@/lib/site";
import { moduleOf } from "./Heading";
import { StageMotion } from "./Motion";
import { Annot, ArcText, ArrowLine, Chevrons, CircleRow, coordinates, CrossTriangles, DotGrid, Eye, FarShore, StackPhoto, Tri } from "./Poster";

// トップページのヒーロー。1 枚のポスターとして組む:
//   空と霧の向こうの函館山 → 建物(切り抜き写真)→ 文字 → 手前の箱だけの写真 → 注記と線、の順に重ねる。
//   文字を 2 枚の写真のあいだに挟むので、黄色い大文字や細い英字の一部が、せり出した箱の後ろに回り込んで見える。
// 中の位置は、舞台(.stage)の幅を 100 とした単位。広い画面は横長(100 × 56.25)、狭い画面は縦長に組み直す。
//
// 動き(globals.css の「動き」):
//   読み込むと、写真 → 黄色の大文字 → 細い英字 → 線と注記の順に、刷り重ねるように出る(a-*、--d は始まるまでのミリ秒)。
//   .depth の付いた層は、カーソルとスクロールに合わせて少しずつ違う量だけ動き、重ねた紙のような奥行きが出る(StageMotion)。

/** 位置を CSS 変数で渡す(globals.css の .pin)。x, y は広い画面、mx, my は狭い画面。more で、動きの変数を足す */
const at = (x: number, y: number, mx: number, my: number, more: Vars = {}): Vars => ({ "--x": x, "--y": y, "--mx": mx, "--my": my, ...more });

// 写真の置き方。レンダーした絵(幅 100 × 高さ 58.33)を、広い画面では少し大きくして左上へずらし、右下に空を広く取る。
// 狭い画面では、絵のまん中(横 28%〜74%)を切り出した縦長の写真を使う。建物と文字の重なり方は、広い画面と同じになる。
const DESK = { scale: 1.1, x: -12, y: -6 };
const MOB = { scale: 100 / 46, x: -28 * (100 / 46), y: 0 };
type Pt = [number, number];
const map = (m: typeof DESK) => (p: Pt): Pt => [p[0] * m.scale + m.x, p[1] * m.scale + m.y];
const place = (m: typeof DESK) => (p: Pt) => map(m)(p).map((v) => v.toFixed(2)).join(",");

// 建物の面の四隅(レンダーした絵の中での位置。tools/poster-render/scene.py の --data で書き出した値)。
// いちばん外側の列の箱の、穴あきパネルの面。メニューの並びと同じ順(scene.py の SPRITE_AT)
const FACE: Record<(typeof navItems)[number]["en"], Pt[]> = {
  ABOUT: [[60.62, 16.24], [70.31, 17.61], [73.96, 8.41], [64.29, 7.71]],
  COURSE: [[48.33, 23.51], [61.37, 26.37], [65.25, 16.99], [52.17, 15.13]],
  WORKS: [[37.0, 30.22], [44.24, 32.45], [48.29, 23.6], [40.98, 21.99]],
  MEMBERS: [[23.68, 35.26], [39.91, 41.89], [44.2, 32.54], [27.71, 27.45]],
  NEWS: [[16.79, 42.18], [22.18, 45.0], [26.48, 36.51], [20.96, 34.25]],
  JOIN: [[7.75, 47.53], [17.61, 54.03], [22.14, 45.09], [11.97, 39.76]],
};

// 層ごとの奥行き。--depth はカーソル、--drift はスクロールに対して動く量(舞台の幅を 100 とした単位)
const FAR: Vars = { "--depth": -0.3, "--drift": 5 };
const BUILDING: Vars = { "--depth": 0.4 };
const LETTERS: Vars = { "--depth": 0.95, "--drift": -1.4 };
const WORD: Vars = { "--depth": 1.3, "--drift": -2.6 };

// 黄色い大文字。建物の上から空へ、右下がりに並べる。N と G は、手前の箱(H07)の後ろに一部が隠れる位置に置く。
// F は、幅 1024px の画面でもヘッダー(高さ 4rem = 6.25cqw)の下に隠れない高さから始める
const letters: { ch: string; pos: [number, number, number, number] }[] = [
  { ch: "F", pos: [20.8, 6.9, 4.3, 22.2] },
  { ch: "U", pos: [29.6, 12, 21.3, 34.3] },
  { ch: "N", pos: [38.9, 17.6, 39.8, 46.7] },
  { ch: "G", pos: [48.4, 23.9, 58.5, 59.1] },
  { ch: "C", pos: [57.5, 30.8, 76, 73.2] },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * メニューと対応する箱の面。広い画面でカーソルを乗せると黄色いフィルムが乗り、行き先の札が出て、押すとそのページへ移る。
 * ヘッダーのメニューにカーソルを乗せても、同じ面が光る(globals.css の .mod-hit)。メニューと同じ行き先なので、読み上げとタブ移動からは外す
 */
function ModuleLinks() {
  const desk = map(DESK);
  return (
    <div aria-hidden="true">
      {navItems.map((item) => {
        const pts = FACE[item.en].map(desk);
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
        const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
        const clip = pts.map(([x, y]) => `${(((x - x0) / w) * 100).toFixed(2)}% ${(((y - y0) / h) * 100).toFixed(2)}%`).join(", ");
        const cx = xs.reduce((a, b) => a + b, 0) / 4;
        const cy = ys.reduce((a, b) => a + b, 0) / 4;
        return (
          <div key={item.en} className="contents">
            <Link
              href={item.href}
              tabIndex={-1}
              data-mod={item.en}
              className="mod-hit depth"
              style={{ left: `${x0.toFixed(2)}cqw`, top: `${y0.toFixed(2)}cqw`, width: `${w.toFixed(2)}cqw`, height: `${h.toFixed(2)}cqw`, clipPath: `polygon(${clip})`, ...BUILDING }}
            />
            <span data-mod={item.en} className="mod-tag depth" style={{ left: `${cx.toFixed(2)}cqw`, top: `${cy.toFixed(2)}cqw`, ...BUILDING }}>
              {moduleOf[item.en].code} {item.en} →
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HomeHero({ works, members, upcoming }: { works: number; members: number; upcoming: number }) {
  const desk = place(DESK);
  const mob = place(MOB);
  const stats: [string, number][] = [
    ["WORKS", works],
    ["MEMBERS", members],
    ["UPCOMING", upcoming],
  ];

  return (
    <section className="stage hero -mt-16 bg-linear-to-b from-sky via-sky to-paper" aria-labelledby="hero-title">
      <StageMotion />

      {/* ---- 奥: 霧の向こうの函館山 ---- */}
      <FarShore className="pin depth a-fade w-[150cqw] max-w-none opacity-90 [animation-duration:2.4s] lg:w-[62cqw]" style={at(51.6, 40, -22, 116, { ...FAR, ...d(300) })} />

      {/* ---- 建物 ---- */}
      <StackPhoto name="stack-day" narrow="stack-day-m" sizes="110vw" eager className="hero-photo fade-m depth a-build" style={BUILDING} />

      {/* ---- 2 枚の写真のあいだに挟む文字 ---- */}
      <p
        aria-hidden="true"
        className="poster-word pin depth a-wipe whitespace-nowrap text-[17cqw] text-ink [animation-duration:1.3s] lg:text-[8.2cqw]"
        style={at(15.2, 45.2, 4, 101, { ...WORD, ...d(650) })}
      >
        Playable
      </p>
      <div aria-hidden="true">
        {letters.map((l, i) => (
          <span key={l.ch} data-ch={l.ch} className="title-letter pin depth a-drop text-[26cqw] lg:text-[13.2cqw]" style={at(...l.pos, { ...LETTERS, ...d(280 + i * 95) })}>
            {l.ch}
          </span>
        ))}
      </div>

      {/* ---- 手前の箱 ---- */}
      <StackPhoto name="stack-front" narrow="stack-front-m" sizes="110vw" eager className="hero-photo fade-m depth a-build pointer-events-none" style={BUILDING} />

      {/* 面に貼った黄色いフィルム(乗算)。手前の箱の写真より上に置く */}
      <svg
        className="tint depth a-build pointer-events-none absolute inset-0 hidden size-full lg:block"
        style={BUILDING}
        viewBox="0 0 100 56.25"
        preserveAspectRatio="xMinYMin slice"
        aria-hidden="true"
      >
        <polygon className="a-film" style={d(950)} points={FACE.MEMBERS.map(desk).join(" ")} fill="var(--color-fun-yellow)" />
      </svg>
      <svg className="tint fade-m depth a-build pointer-events-none absolute left-0 top-0 w-full lg:hidden" style={BUILDING} viewBox="0 0 100 126.8" aria-hidden="true">
        <polygon className="a-film" style={d(950)} points={FACE.MEMBERS.map(mob).join(" ")} fill="var(--color-fun-yellow)" />
      </svg>

      <ModuleLinks />

      {/* ---- 線(広い画面)。箱の角から引き出した線と、弧 ---- */}
      <svg
        className="depth pointer-events-none absolute inset-0 hidden size-full lg:block"
        style={BUILDING}
        viewBox="0 0 100 56.25"
        preserveAspectRatio="xMinYMin slice"
        aria-hidden="true"
        fill="none"
      >
        {/* 線の太さも絵の中の単位(幅 1440px の画面で 1.5px と 1px)。pathLength を 1 にして、a-draw で端から引く */}
        <g stroke="var(--color-fun-yellow)" strokeWidth="0.104">
          {/* H07 の角から、見出しへ引き出す線 */}
          <line className="a-draw" style={d(1150)} pathLength={1} x1="59.3" y1="27.7" x2="66.3" y2="25.8" />
          {/* 大きな弧 */}
          <path className="a-draw [animation-duration:2s]" style={d(700)} pathLength={1} d="M -4 20 A 58 58 0 0 0 62 60" strokeWidth="0.07" />
        </g>
        {/* H08 の角から、注記へ引き出す線 */}
        <line className="a-draw" style={d(1350)} pathLength={1} x1="68.2" y1="19" x2="72.3" y2="19" stroke="var(--color-ink)" strokeWidth="0.07" />
        <circle className="a-fade" style={d(1100)} cx="59.3" cy="27.7" r="0.45" fill="var(--color-fun-yellow)" />
        <circle className="a-fade" style={d(1300)} cx="68.2" cy="19" r="0.3" fill="var(--color-ink)" />
      </svg>

      {/* ---- 注記 ---- */}
      <div className="pin a-wipe flex items-center gap-3 bg-ink py-1.5 pl-1.5 pr-3 text-white lg:max-xl:hidden" style={at(2.2, 6.4, 40, 19, d(500))}>
        <Eye className="size-6 lg:size-7" />
        <Annot>
          No[01]
          <br />
          {site.universityEn.toUpperCase()}
        </Annot>
      </div>

      {/* 箱の番号から引き出した注記(広い画面) */}
      <div className="pin depth a-type hidden items-start gap-2 text-ink lg:flex" style={at(73, 18.2, 0, 0, { ...BUILDING, ...d(1650) })}>
        <Annot>
          <span className="hl px-1">H08</span> FIG.01 — THE STACK
          <br />
          6000 × 6000 × 6000 / RC + AL
          <br />
          <span className="text-muted">1 DOT = 1 PIXEL</span>
        </Annot>
      </div>

      {/* 右上の飾り */}
      <div aria-hidden="true" className="pin a-fade hidden w-[8cqw] flex-col gap-[0.7cqw] text-ink lg:flex" style={at(88.5, 6.2, 0, 0, d(1500))}>
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
      <p aria-hidden="true" className="pin a-type-v hidden font-mono text-[11px] tracking-[0.28em] text-ink [writing-mode:vertical-rl] lg:block" style={at(97.2, 23, 0, 0, d(1900))}>
        waiting for player 2<span className="blink">_</span>
      </p>

      {/* 黄色い面の中の注記(広い画面)。面の上の辺に沿わせて傾ける */}
      <p
        aria-hidden="true"
        className="pin depth a-fade hidden origin-top-left rotate-[17deg] font-mono text-[0.8cqw] font-medium leading-tight text-ink lg:block"
        style={at(19.6, 25.6, 0, 0, { ...BUILDING, ...d(1500) })}
      >
        [0–100]
        <br />
        MEMBERS {pad2(members)}
      </p>

      {/* 下の空: 円に沿った文字と、斜体のひとこと */}
      <ArcText
        text="A GOOD BEGINNING MAKES A GOOD GAME"
        className="pin a-turn hidden w-[16cqw] text-ink lg:block"
        style={at(49.8, 44.2, 0, 0, d(1250))}
        start={-152}
        span={124}
      />
      <p aria-hidden="true" className="pin a-fade hidden font-poster text-[1.35cqw] font-light italic text-ink lg:block" style={at(51.5, 52, 0, 0, d(2100))}>
        <span className="blink">|</span> press any button
      </p>

      {/* ---- 見出しと本文 ---- */}
      <div className="hero-copy">
        <div className="a-wipe flex items-center gap-3" style={d(500)}>
          <span className="hl whitespace-nowrap px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.2em]">GAME DEV</span>
          <ArrowLine length="2rem" />
          <Annot className="text-muted">
            UNITY / COURSE <span className="hidden sm:inline lg:hidden xl:inline">/ EXHIBITION / TEAM</span>
          </Annot>
        </div>
        <h1 id="hero-title" className="poster-word mt-4 text-[15.5cqw] text-ink lg:mt-[1.3cqw] lg:text-[4.9cqw]">
          <span className="a-up inline-block" style={d(600)}>
            Game
          </span>{" "}
          <br className="lg:hidden" />
          <span className="a-up inline-block" style={d(710)}>
            Creators<span className="text-fun-red">.</span>
          </span>
        </h1>
        <p className="a-rise mt-4 max-w-md border-l border-ink pl-4 leading-relaxed text-ink-2 lg:mt-[1.5cqw] lg:text-[clamp(0.9rem,1.15cqw,1.125rem)]" style={d(900)}>
          Discord と学内を拠点として、Unity の講座、展示、チーム開発をしています。
        </p>
        <div className="a-rise mt-6 flex flex-wrap items-center gap-3 lg:mt-[1.6cqw]" style={d(1050)}>
          <Link href="/join/" className="sweep group flex items-center gap-3 px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] text-white [--sweep-from:var(--color-ink)] [--sweep-to:var(--color-fun-yellow)] hover:text-ink">
            JOIN US
            <ArrowLine length="1.5rem" />
          </Link>
          <Link
            href="/works/"
            className="sweep border border-ink px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] [--sweep-from:transparent] [--sweep-to:var(--color-ink)] hover:text-white"
          >
            WORKS
          </Link>
        </div>
        <dl className="a-rise mt-7 flex gap-7 font-mono text-ink lg:mt-[2.3cqw]" style={d(1200)}>
          {stats.map(([label, n], i) => (
            <div key={label}>
              <dt className="text-[10px] tracking-[0.2em] text-muted">{label}</dt>
              <dd className="font-poster text-4xl font-light leading-none tabular-nums lining-nums lg:text-[clamp(2rem,2.9cqw,2.75rem)]">
                <span className="sr-only">{n}</span>
                {/* 00 から数え上げる(数字は CSS の counter で出す) */}
                <span aria-hidden="true" className="count" style={{ "--to": n, ...d(1250 + i * 120) } as Vars} />
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 右下: 位置の注記 */}
      <div aria-hidden="true" className="pin a-fade hidden items-center gap-3 text-ink xl:flex" style={at(86, 52.6, 0, 0, d(2000))}>
        <Chevrons className="w-3" count={2} />
        <Annot>{coordinates}</Annot>
      </div>
    </section>
  );
}
