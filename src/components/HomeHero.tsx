import Link from "next/link";
import { delay as d, type Vars } from "@/lib/motion";
import { navItems, site } from "@/lib/site";
import { moduleOf } from "./Heading";
import { StageMotion } from "./Motion";
import { Annot, ArrowLine, Chevrons, coordinates, Eye, FarShore, StackPhoto } from "./Poster";

// トップページのヒーロー。1 枚のポスターとして組む:
//   空と霧の向こうの函館山 → 建物(切り抜き写真)→ 黄色い大文字 → 注記と線、の順に重ねる。黄色い大文字は、どの箱よりも手前に置く。
//   細い英字の「Playable」は、いったん外してある(パネルで遊べる仕掛けを作るときに戻すかもしれない)。戻すときは、建物の写真と
//   手前の箱だけの写真(public/poster の stack-front)のあいだに挟むと、左下の箱の少し後ろにあるように見える。
// 中の位置は、舞台(.stage)の幅を 100 とした単位。広い画面は横長(100 × 56.25)、狭い画面は縦長に組み直す。
//
// 動き(globals.css の「動き」):
//   読み込むと、写真 → 黄色の大文字 → 線と注記の順に、刷り重ねるように出る(a-*、--d は始まるまでのミリ秒)。
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

// 穴あきパネルの四隅(レンダーした絵の中での位置。tools/poster-render/scene.py の --data で書き出した type: "panel" の値)。
// 箱の側面のうち、コンクリートの縁を除いたパネルだけの範囲なので、黄色いフィルムがパネルにぴったり重なる。
// いちばん外側の列の箱を、メニューの並びと同じ順に(scene.py の SPRITE_AT)
const FACE: Record<(typeof navItems)[number]["en"], Pt[]> = {
  ABOUT: [[69.24, 16.9], [60.85, 15.74], [64.09, 8.21], [72.47, 8.85]],
  COURSE: [[60.41, 25.57], [48.57, 23.02], [51.97, 15.62], [63.84, 17.36]],
  WORKS: [[43.53, 31.64], [37.25, 29.74], [40.77, 22.47], [47.11, 23.89]],
  MEMBERS: [[39.23, 40.96], [23.93, 34.81], [27.49, 27.9], [43.01, 32.77]],
  NEWS: [[21.74, 44.13], [17.06, 41.72], [20.74, 34.71], [25.52, 36.7]],
  JOIN: [[17.21, 53.05], [8.02, 47.08], [11.75, 40.21], [21.19, 45.22]],
};

// 層ごとの奥行き。--depth はカーソル、--drift はスクロールに対して動く量(舞台の幅を 100 とした単位)
const FAR: Vars = { "--depth": -0.3, "--drift": 5 };
const BUILDING: Vars = { "--depth": 0.4 };
const LETTERS: Vars = { "--depth": 0.95, "--drift": -1.4 };

// 黄色い大文字。建物の上から空へ、右下がりの一直線に並べる(左上の角が 1 本の直線に乗る。広い画面は F と C、狭い画面も F と C を結ぶ線)。
// 文字は 5 つとも建物の手前に置き、箱が文字を隠すところは作らない(手前の箱の写真より上に描く)。
// F は、幅 1024px の画面でもヘッダー(高さ 4rem = 6.25cqw)の下に隠れない高さから始める
const letters: { ch: string; pos: [number, number, number, number] }[] = [
  { ch: "F", pos: [20.4, 6.9, 3.6, 22.2] },
  { ch: "U", pos: [29.2, 12.57, 20.6, 34.17] },
  { ch: "N", pos: [38.5, 18.56, 39, 47.14] },
  { ch: "G", pos: [48, 24.68, 57.6, 60.24] },
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
      <FarShore className="pin depth a-fade w-[150cqw] max-w-none opacity-90 [animation-duration:2.4s] lg:w-[62cqw]" style={at(51.6, 40, -22, 98, { ...FAR, ...d(300) })} />

      {/* ---- 建物 ---- */}
      <StackPhoto name="stack-day" narrow="stack-day-m" sizes="110vw" eager className="hero-photo fade-m depth a-build" style={BUILDING} />

      {/* ---- 黄色い大文字。建物のどの箱よりも手前 ---- */}
      <div aria-hidden="true">
        {letters.map((l, i) => (
          <span key={l.ch} data-ch={l.ch} className="title-letter pin depth a-drop text-[26cqw] lg:text-[13.2cqw]" style={at(...l.pos, { ...LETTERS, ...d(280 + i * 95) })}>
            {l.ch}
          </span>
        ))}
      </div>

      {/* 面に貼った黄色いフィルム(乗算) */}
      <svg
        className="tint depth a-build pointer-events-none absolute left-0 top-0 hidden h-[56.25cqw] w-[100cqw] lg:block"
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
        className="depth pointer-events-none absolute left-0 top-0 hidden h-[56.25cqw] w-[100cqw] lg:block"
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
        <circle className="a-fade" style={d(1100)} cx="59.3" cy="27.7" r="0.45" fill="var(--color-fun-yellow)" />
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
