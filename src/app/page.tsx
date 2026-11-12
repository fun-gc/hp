import Link from "next/link";
import type { CSSProperties } from "react";
import { SectionHead } from "@/components/Heading";
import { HomeHero } from "@/components/HomeHero";
import { NightStage } from "@/components/NightStage";
import { Annot, ArrowLine, Crosshair, DotGrid, Slashes, Tri } from "@/components/Poster";
import { Poster } from "@/components/WorkCard";
import { getMemberCount, getNews, getSchedule, getWorks } from "@/lib/content";
import { stagger } from "@/lib/motion";
import { eventKindEn, monthsEn } from "@/lib/en";
import { workPoster } from "@/lib/work";

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Home() {
  const news = getNews().slice(0, 3);
  const allWorks = getWorks();
  const works = allWorks.filter((w) => workPoster(w)).slice(0, 4);
  const buildDate = new Date().toISOString().slice(0, 10);
  const upcomingAll = getSchedule().filter((e) => e.date >= buildDate);
  const upcoming = upcomingAll.slice(0, 3);

  return (
    <>
      <HomeHero works={allWorks.length} members={getMemberCount()} upcoming={upcomingAll.length} />

      {/* ---- 作品。建物の箱のように、1 段ずつ下げて並べる ---- */}
      <section className="wrap relative pb-20 pt-20 lg:pb-44" aria-labelledby="home-works">
        <SectionHead ja="作品" en="WORKS" href="/works/" linkLabel="ALL WORKS" id="home-works" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-7">
          {works.map((w, i) => (
            <li key={w.slug} className="lg:translate-y-[calc(var(--step)*2.4rem)]" data-reveal style={{ "--step": i, ...stagger(i + 2) } as CSSProperties}>
              <Link href="/works/" className="group block">
                <Annot className="flex justify-between text-muted">
                  <span>No.{pad2(i + 1)}</span>
                  <span>{w.year}</span>
                </Annot>
                <div className="relative mt-2 aspect-video overflow-hidden bg-ink transition-shadow duration-200 group-hover:shadow-[7px_7px_0_var(--color-fun-yellow)]">
                  <Poster src={workPoster(w)!} contain={Boolean(w.thumbnail)} />
                </div>
                <p className="mt-3 border-t border-ink pt-2 font-bold leading-snug">
                  <span className="group-hover:bg-fun-yellow">{w.title}</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted">↳ {w.event ?? w.year}</p>
              </Link>
            </li>
          ))}
        </ul>
        {/* 段の先に置く注記(広い画面) */}
        <div className="pointer-events-none absolute bottom-16 left-8 hidden items-center gap-4 text-ink lg:flex" aria-hidden="true" data-reveal="wipe">
          <Slashes count={6} />
          <Annot>
            {pad2(allWorks.length)} WORKS IN STOCK
            <br />
            <span className="text-muted">make — play — show</span>
          </Annot>
        </div>
      </section>

      {/* ---- 予定とお知らせ ---- */}
      <section className="border-y border-ink/70 bg-paper-2">
        <div className="wrap relative grid gap-16 py-20 lg:grid-cols-2 lg:gap-20">
          <div className="pointer-events-none absolute right-8 top-6 hidden items-center gap-4 text-ink lg:flex" aria-hidden="true" data-reveal>
            <DotGrid cols={10} rows={3} className="opacity-50" />
            <Crosshair className="size-5" />
          </div>
          <div>
            <SectionHead ja="予定" en="SCHEDULE" href="/course/#schedule" linkLabel="CALENDAR" />
            {upcoming.length === 0 ? (
              <p className="corner-ticks px-4 py-10 text-center text-sm text-muted" data-reveal style={stagger(3)}>
                次の予定は準備中です。
              </p>
            ) : (
              <ul className="border-t border-ink">
                {upcoming.map((e, i) => (
                  <li key={i} className="flex items-center gap-5 border-b border-ink/25 py-4" data-reveal style={stagger(i + 3)}>
                    <p className="w-16 shrink-0 text-center" aria-label={e.date}>
                      <span className="block font-poster text-4xl font-light leading-none tabular-nums lining-nums">{Number(e.date.slice(8))}</span>
                      <span className="font-mono text-[10px] tracking-[0.2em] text-muted">{monthsEn[Number(e.date.slice(5, 7)) - 1]}</span>
                    </p>
                    <p className="min-w-0 space-y-1">
                      <span className="inline-block bg-ink px-2 py-0.5 font-mono text-[11px] font-medium tracking-wider text-white">{eventKindEn[e.kind]}</span>
                      <span className="block font-bold">{e.title}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <SectionHead ja="お知らせ" en="NEWS" href="/news/" linkLabel="ALL NEWS" />
            <ul className="border-t border-ink">
              {news.map((n) => (
                <li key={n.slug} className="border-b border-ink/25" data-reveal style={stagger(news.indexOf(n) + 3)}>
                  <Link href={`/news/${n.slug}/`} className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-5">
                    <span className="w-24 shrink-0 font-mono text-sm text-muted">{n.date.toISOString().slice(0, 10).replaceAll("-", ".")}</span>
                    <span className="font-bold">
                      <span className="group-hover:bg-fun-yellow">{n.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- 部員募集。ヒーローと同じ建物の夜 ---- */}
      <NightStage labelledBy="home-join">
        <SectionHead ja="入部案内" en="JOIN US" invert id="home-join" />
        <p className="max-w-md border-l border-white/60 pl-4 leading-relaxed text-white/85" data-reveal style={stagger(4)}>
          見学はいつでも受け付けています。
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-5" data-reveal style={stagger(6)}>
          <Link
            href="/join/"
            className="sweep group flex items-center gap-3 whitespace-nowrap px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] text-ink [--sweep-from:var(--color-fun-yellow)] [--sweep-to:#fff]"
          >
            HOW TO JOIN
            <ArrowLine length="1.5rem" />
          </Link>
          <Tri className="size-4 text-fun-yellow" />
          <Annot className="text-white/60">
            visit anytime<span className="blink">_</span>
          </Annot>
        </div>
      </NightStage>
    </>
  );
}
