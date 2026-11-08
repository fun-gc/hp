import Link from "next/link";
import { HeroLetters } from "@/components/HeroLetters";
import { InteractiveLogo } from "@/components/InteractiveLogo";
import { Annot, ArrowLine, Crosshair, DotGrid, NightBackdrop, PosterPhoto, RollNumber, Slashes, Tri } from "@/components/Poster";
import { SectionLabel } from "@/components/SectionLabel";
import { Poster } from "@/components/WorkCard";
import { getMembers, getNews, getSchedule, getWorks } from "@/lib/content";
import { eventKindEn } from "@/lib/en";
import { delay } from "@/lib/motion";
import { site } from "@/lib/site";
import { workPoster } from "@/lib/work";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** トップページの各セクションの見出し。細い英字を大きく置く */
function SectionHead({
  index,
  en,
  href,
  linkLabel,
  invert = false,
  reveal = true,
}: {
  index: number;
  en: string;
  href?: string;
  linkLabel?: string;
  invert?: boolean;
  /** スクロールで出てくるようにする。外側の箱ごと出すときは false */
  reveal?: boolean;
}) {
  const word = en
    .split(" ")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
  return (
    <div className="mb-8 space-y-3" data-reveal={reveal || undefined}>
      <SectionLabel index={index} invert={invert}>
        {en}
      </SectionLabel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className={`font-poster text-5xl font-light leading-none tracking-tight sm:text-7xl ${invert ? "text-white" : "text-ink"}`}>
          {word}
        </h2>
        {href && (
          <Link
            href={href}
            className={`group flex items-center gap-2 font-mono text-xs font-bold tracking-wider ${invert ? "hover:text-fun-yellow" : "hover:bg-fun-yellow"}`}
          >
            {linkLabel}
            <ArrowLine length="2.5rem" grow />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const news = getNews().slice(0, 3);
  const allWorks = getWorks();
  const works = allWorks.filter((w) => workPoster(w)).slice(0, 4);
  const buildDate = new Date().toISOString().slice(0, 10);
  const upcomingAll = getSchedule().filter((e) => e.date >= buildDate);
  const upcoming = upcomingAll.slice(0, 3);
  const memberCount = getMembers().length;

  return (
    <>
      {/* ---- ヒーロー:グレーの立方体の建物に、斜めに崩した FUNGC の文字を重ねる ---- */}
      <section className="relative overflow-hidden border-b border-ink">
        {/* PC では文章の箱が右の写真に重なる。箱はクリックを通し、文字やボタンだけが受け取る(写真の上の文字やロゴを触れるように) */}
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 md:pointer-events-none md:min-h-[44rem] md:pb-20 md:pt-14">
          <div className="anim-fade flex items-start justify-between gap-6 text-ink" style={delay(0.1)}>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full border-[6px] border-ink" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-fun-yellow" />
              </span>
              <Annot>
                No[01]
                <br />
                FUTURE UNIVERSITY HAKODATE
              </Annot>
            </div>
          </div>

          <div className="mt-10 max-w-xl space-y-6 md:mt-16">
            <div className="anim-rise flex w-fit items-center gap-3" style={delay(0.15)}>
              <span className="tag-yellow shrink-0 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em]">GAME DEV</span>
              <ArrowLine length="2rem" className="anim-wipe shrink-0" />
              <Annot className="text-muted">UNITY / COURSE / EXHIBITION / TEAM</Annot>
            </div>
            {/* 行ごとに、下の切れ目からせり上げる */}
            <h1 className="w-fit font-poster text-[3rem] font-normal leading-[0.95] tracking-tight sm:text-7xl md:pointer-events-auto">
              <span className="-my-[0.15em] block overflow-y-clip py-[0.15em]">
                <span className="anim-word block" style={delay(0.2)}>
                  <span className="marker marker-draw" style={delay(1)}>
                    Game
                  </span>{" "}
                  creation
                </span>
              </span>
              <span className="-my-[0.15em] block overflow-y-clip py-[0.15em]">
                <span className="anim-word block" style={delay(0.32)}>
                  circle.
                </span>
              </span>
              <span className="anim-fade mt-4 block font-mono text-xs font-medium tracking-[0.25em] text-muted sm:text-sm" style={delay(0.6)}>
                @ {site.universityEn.toUpperCase()}
              </span>
            </h1>
            <p
              className="anim-rise max-w-md border-l border-ink pl-4 text-base leading-relaxed text-muted sm:text-lg md:pointer-events-auto"
              style={delay(0.45)}
            >
              Discord と学内を拠点に、Unity の講座、展示、チーム開発をしています。
            </p>
            <div className="anim-rise flex w-fit flex-wrap gap-3 md:pointer-events-auto" style={delay(0.55)}>
              <Link
                href="/join/"
                className="group flex items-center gap-3 bg-ink px-6 py-3 font-mono text-sm font-bold tracking-[0.15em] text-white transition hover:bg-fun-yellow hover:text-ink"
              >
                JOIN US
                <ArrowLine length="1.5rem" grow />
              </Link>
              <Link
                href="/works/"
                className="border border-ink bg-paper/70 px-6 py-3 font-mono text-sm font-bold tracking-[0.15em] transition hover:bg-fun-yellow"
              >
                WORKS
              </Link>
            </div>
            <dl className="anim-rise flex w-fit gap-6 pt-4 font-mono text-ink md:pointer-events-auto" style={delay(0.65)}>
              {[
                ["WORKS", allWorks.length],
                ["MEMBERS", memberCount],
                ["UPCOMING", upcomingAll.length],
              ].map(([label, n], i) => (
                <div key={label}>
                  <dt className="text-[10px] tracking-[0.2em] text-muted">{label}</dt>
                  <dd className="font-poster text-4xl font-light leading-none tabular-nums lining-nums">
                    <RollNumber value={pad2(Number(n))} delay={0.8 + i * 0.15} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* 建物と大文字。スマホでは文章の下に置き、PC では右側の背景に敷く */}
        <div className="relative h-[26rem] border-t border-ink sm:h-[32rem] md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-[62%] md:border-t-0">
          {/* 写真は少し大きい状態から落ち着かせ、そのあとはゆっくり寄せ続ける */}
          <div className="anim-settle absolute inset-0 overflow-hidden">
            <PosterPhoto name="hero" sizes="(min-width: 768px) 62vw, 100vw" eager className="anim-drift absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 hidden bg-gradient-to-r from-paper via-paper/10 to-transparent md:block" aria-hidden="true" />
          </div>

          {/* 細い線と弧。左から引いていく */}
          <svg
            className="anim-wipe pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={delay(0.4)}
          >
            <line x1="0" y1="8" x2="100" y2="96" stroke="var(--color-ink)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
            <line x1="20" y1="0" x2="20" y2="100" stroke="var(--color-ink)" strokeWidth="0.15" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <path d="M -10 85 Q 40 55 110 70" fill="none" stroke="var(--color-fun-yellow)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* 斜めに崩した FUNGC(つかんで投げられる)と、崩れ具合を出す注記 */}
          <HeroLetters />

          <div className="anim-fade pointer-events-none absolute bottom-6 right-6 flex flex-col items-end gap-3 text-ink" style={delay(1.2)}>
            <Slashes count={7} className="text-ink" />
            <Annot className="tag-yellow px-1.5 py-0.5">GAME CIRCLE // HAKODATE</Annot>
          </div>
          <span
            aria-hidden="true"
            className="anim-fade pointer-events-none absolute right-3 top-4 font-mono text-[11px] tracking-[0.3em] text-ink [writing-mode:vertical-rl]"
            style={delay(1.3)}
          >
            make — play — show
          </span>

          {/* 押せるロゴ。図版のキャプションのように枠で囲む */}
          <figure
            className="corner-ticks anim-rise absolute bottom-6 left-4 w-36 bg-paper/90 p-2 text-ink sm:w-44 md:bottom-auto md:left-auto md:right-12 md:top-10 md:w-48"
            style={delay(0.8)}
          >
            <InteractiveLogo className="aspect-[1210/1280] w-full" />
            <figcaption className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted">
              <span>FIG.01</span>
              <span>PRESS A FACE</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---- 作品 ---- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHead index={2} en="WORKS" href="/works/" linkLabel="ALL" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {works.map((w, i) => (
            <li key={w.slug} data-reveal className={i % 2 === 1 ? "md:translate-y-8" : ""}>
              <Link href="/works/" className="group block space-y-2">
                <Annot className="flex justify-between text-muted">
                  <span>No.{pad2(i + 1)}</span>
                  <span>{w.year}</span>
                </Annot>
                <div className="relative aspect-video overflow-hidden bg-ink outline outline-1 outline-offset-4 outline-ink/30 transition group-hover:outline-fun-yellow">
                  <Poster src={workPoster(w)!} contain={Boolean(w.thumbnail)} />
                </div>
                <p className="font-bold leading-snug group-hover:underline group-hover:decoration-fun-yellow group-hover:decoration-4 group-hover:underline-offset-4">
                  {w.title}
                </p>
                <p className="font-mono text-[11px] text-muted">↳ {w.event ?? w.year}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- 予定とお知らせ ---- */}
      <section className="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div className="pointer-events-none absolute -top-2 right-6 hidden items-center gap-4 text-ink md:flex" aria-hidden="true">
          <DotGrid cols={10} rows={3} className="text-ink/50" />
          <Crosshair className="size-5" />
        </div>
        <div>
          <SectionHead index={3} en="SCHEDULE" href="/course/#schedule" linkLabel="CALENDAR" />
          {upcoming.length === 0 ? (
            <p data-reveal className="border border-dashed border-ink/40 px-4 py-8 text-center text-sm text-muted">
              次の予定は準備中です。
            </p>
          ) : (
            <ul className="border-t border-ink">
              {upcoming.map((e, i) => (
                <li key={i} data-reveal className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink/25 py-4">
                  <span className="w-24 shrink-0 font-mono text-sm font-bold">{e.date.replaceAll("-", ".")}</span>
                  <span className="bg-ink px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">{eventKindEn[e.kind]}</span>
                  <span className="font-bold">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionHead index={4} en="NEWS" href="/news/" linkLabel="ALL" />
          <ul className="border-t border-ink">
            {news.map((n) => (
              <li key={n.slug} data-reveal className="border-b border-ink/25">
                <Link href={`/news/${n.slug}/`} className="group flex flex-col gap-1 py-4 sm:flex-row sm:gap-4">
                  <span className="w-24 shrink-0 font-mono text-sm text-muted">
                    {n.date.toISOString().slice(0, 10).replaceAll("-", ".")}
                  </span>
                  <span className="font-bold group-hover:bg-fun-yellow">{n.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- 部員募集 ---- */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div data-reveal className="relative overflow-hidden bg-ink px-6 py-12 text-white sm:px-12 sm:py-16">
          <NightBackdrop />
          <div className="relative z-10 max-w-xl space-y-5">
            <SectionHead index={5} en="JOIN US" invert reveal={false} />
            <p className="leading-relaxed text-white/80">見学はいつでも受け付けています。</p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                href="/join/"
                className="inline-block whitespace-nowrap bg-fun-yellow px-6 py-3 font-mono text-sm font-bold tracking-[0.15em] text-ink transition hover:bg-white"
              >
                HOW TO JOIN
              </Link>
              <Tri className="size-5 text-fun-yellow" />
              <Annot className="hidden text-white/60 sm:inline">
                visit anytime<span className="blink">_</span>
              </Annot>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
