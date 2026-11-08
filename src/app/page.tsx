import Link from "next/link";
import { InteractiveLogo } from "@/components/InteractiveLogo";
import { Annot, ArrowLine, coordinates, Crosshair, CubeStack, DotGrid, Slashes, Tri } from "@/components/Poster";
import { SectionLabel } from "@/components/SectionLabel";
import { Poster } from "@/components/WorkCard";
import { getMembers, getNews, getSchedule, getWorks } from "@/lib/content";
import { eventKindLabels } from "@/lib/schema";
import { site } from "@/lib/site";
import { workPoster } from "@/lib/work";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** トップページの各セクションの見出し。英字を大きく置き、日本語の見出しを添える */
function SectionHead({
  index,
  en,
  title,
  href,
  linkLabel,
  invert = false,
}: {
  index: number;
  en: string;
  title: string;
  href?: string;
  linkLabel?: string;
  invert?: boolean;
}) {
  return (
    <div className="mb-8 space-y-3">
      <SectionLabel index={index} invert={invert}>
        {en}
      </SectionLabel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p
            aria-hidden="true"
            className={`font-poster text-5xl font-light capitalize leading-none tracking-tight sm:text-7xl ${invert ? "text-white" : "text-ink"}`}
          >
            {en.toLowerCase()}
          </p>
          <h2 className="text-xl font-black sm:text-2xl">{title}</h2>
        </div>
        {href && (
          <Link
            href={href}
            className={`group flex items-center gap-2 font-mono text-xs font-bold tracking-wider ${invert ? "hover:text-fun-yellow" : "hover:bg-fun-yellow"}`}
          >
            {linkLabel}
            <ArrowLine length="2.5rem" className="transition-all group-hover:w-14" />
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
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 md:min-h-[44rem] md:pb-20 md:pt-14">
          <div className="flex items-start justify-between gap-6 text-ink">
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
            <div className="flex items-center gap-3">
              <span className="tag-yellow shrink-0 px-2 py-0.5 font-bold">ゲーム制作</span>
              <ArrowLine length="3rem" className="shrink-0" />
              <Annot className="text-muted">Unity / 講座 / 展示 / チーム開発</Annot>
            </div>
            <h1 className="text-[1.7rem] font-black leading-[1.4] tracking-tight sm:text-5xl sm:leading-[1.3]">
              {site.university}の
              <br />
              <span className="marker">ゲーム制作サークル</span>です。
            </h1>
            <p className="max-w-md border-l border-ink pl-4 text-base leading-relaxed text-muted sm:text-lg">
              Discord と学内を拠点に、Unity の講座、展示、チーム開発をしています。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/join/"
                className="group flex items-center gap-3 bg-ink px-6 py-3 font-bold text-white transition hover:bg-fun-yellow hover:text-ink"
              >
                入部案内を見る
                <ArrowLine length="1.5rem" />
              </Link>
              <Link href="/works/" className="border border-ink bg-paper/70 px-6 py-3 font-bold transition hover:bg-fun-yellow">
                作品を見る
              </Link>
            </div>
            <dl className="flex gap-6 pt-4 font-mono text-ink">
              {[
                ["WORKS", allWorks.length],
                ["MEMBERS", memberCount],
                ["UPCOMING", upcomingAll.length],
              ].map(([label, n]) => (
                <div key={label}>
                  <dt className="text-[10px] tracking-[0.2em] text-muted">{label}</dt>
                  <dd className="font-poster text-4xl font-light leading-none">{pad2(Number(n))}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* 建物と大文字。スマホでは文章の下に置き、PC では右側の背景に敷く */}
        <div className="relative h-[26rem] border-t border-ink sm:h-[32rem] md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-[62%] md:border-t-0">
          <CubeStack className="absolute inset-0 size-full" />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-paper via-paper/20 to-transparent md:block" aria-hidden="true" />

          {/* 細い線と弧 */}
          <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="8" x2="100" y2="96" stroke="var(--color-ink)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
            <line x1="20" y1="0" x2="20" y2="100" stroke="var(--color-ink)" strokeWidth="0.15" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <path d="M -10 85 Q 40 55 110 70" fill="none" stroke="var(--color-fun-yellow)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* 斜めに崩した FUNGC */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {"FUNGC".split("").map((ch, i) => (
              <span
                key={i}
                className="poster-letter absolute text-[clamp(5rem,13vw,11rem)] drop-shadow-[0_2px_0_rgb(28_36_43/0.35)]"
                style={{ left: `${10 + i * 16}%`, top: `${2 + i * 17}%` }}
              >
                {ch}
              </span>
            ))}
          </div>

          {/* 注記 */}
          <div className="pointer-events-none absolute left-[4%] top-[58%] hidden text-ink sm:block">
            <Annot className="block bg-paper/80 px-1">[0–100]</Annot>
            <Annot className="mt-1 block bg-paper/80 px-1">structural completeness</Annot>
            <Annot className="mt-3 block bg-paper/80 px-1">
              Coordinates:
              <br />
              {coordinates}
            </Annot>
          </div>
          <div className="pointer-events-none absolute bottom-6 right-6 flex flex-col items-end gap-3 text-ink">
            <Slashes count={7} className="text-ink" />
            <Annot className="tag-yellow px-1.5 py-0.5">GAME CIRCLE // HAKODATE</Annot>
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-4 font-mono text-[11px] tracking-[0.3em] text-ink [writing-mode:vertical-rl]"
          >
            make — play — show
          </span>

          {/* 押せるロゴ。図版のキャプションのように枠で囲む */}
          <figure className="corner-ticks absolute bottom-6 left-4 w-36 bg-paper/90 p-2 text-ink sm:w-44 md:bottom-auto md:left-auto md:right-12 md:top-10 md:w-48">
            <InteractiveLogo className="aspect-[1210/1280] w-full" />
            <figcaption className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted">
              <span>FIG.01</span>
              <span>面を押してみよう</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---- 作品 ---- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHead index={2} en="WORKS" title="作品" href="/works/" linkLabel="一覧" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
          {works.map((w, i) => (
            <li key={w.slug} className={i % 2 === 1 ? "md:translate-y-8" : ""}>
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
          <SectionHead index={3} en="SCHEDULE" title="これからの予定" href="/course/#schedule" linkLabel="カレンダー" />
          {upcoming.length === 0 ? (
            <p className="border border-dashed border-ink/40 px-4 py-8 text-center text-sm text-muted">次の予定は準備中です。</p>
          ) : (
            <ul className="border-t border-ink">
              {upcoming.map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink/25 py-4">
                  <span className="w-24 shrink-0 font-mono text-sm font-bold">{e.date.replaceAll("-", ".")}</span>
                  <span className="bg-ink px-2 py-0.5 text-xs font-bold text-white">{eventKindLabels[e.kind]}</span>
                  <span className="font-bold">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionHead index={4} en="NEWS" title="お知らせ" href="/news/" linkLabel="一覧" />
          <ul className="border-t border-ink">
            {news.map((n) => (
              <li key={n.slug} className="border-b border-ink/25">
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
        <div className="relative overflow-hidden bg-ink px-6 py-12 text-white sm:px-12 sm:py-16">
          <CubeStack size={9} className="absolute -right-24 top-0 hidden h-full w-[60%] opacity-40 mix-blend-luminosity sm:block" />
          <p
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 bottom-0 hidden font-poster text-[9rem] font-medium leading-[0.75] text-fun-yellow sm:block lg:text-[12rem]"
          >
            JOIN
          </p>
          <div className="relative z-10 max-w-xl space-y-5">
            <SectionHead index={5} en="JOIN US" title="部員募集中" invert />
            <p className="leading-relaxed text-white/75">見学はいつでも受け付けています。</p>
            <div className="flex items-center gap-5">
              <Link href="/join/" className="inline-block bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-white">
                入部案内へ
              </Link>
              <Tri className="size-5 text-fun-yellow" />
              <Annot className="text-white/50">visit anytime_</Annot>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
