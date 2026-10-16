import Link from "next/link";
import { InteractiveLogo } from "@/components/InteractiveLogo";
import { SectionLabel } from "@/components/SectionLabel";
import { Poster } from "@/components/WorkCard";
import { getNews, getSchedule, getWorks } from "@/lib/content";
import { eventKindLabels } from "@/lib/schema";
import { site } from "@/lib/site";
import { workPoster } from "@/lib/work";

export default function Home() {
  const news = getNews().slice(0, 3);
  const works = getWorks()
    .filter((w) => workPoster(w))
    .slice(0, 4);
  const buildDate = new Date().toISOString().slice(0, 10);
  const upcoming = getSchedule()
    .filter((e) => e.date >= buildDate)
    .slice(0, 3);

  return (
    <>
      {/* ロゴの演出はロゴより外側にも描くので、横にはみ出した分はここで切る */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 overflow-x-clip px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div className="space-y-6">
          <h1 className="text-3xl font-black leading-snug tracking-tight sm:text-5xl">
            {site.university}の
            <br />
            <span className="marker">ゲーム制作サークル</span>です。
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Discord と学内を拠点に、Unity の講座、展示、チーム開発をしています。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/join/" className="bg-ink px-6 py-3 font-bold text-white transition hover:bg-fun-red">
              入部案内を見る
            </Link>
            <Link href="/works/" className="border-2 border-ink px-6 py-3 font-bold transition hover:bg-fun-yellow">
              作品を見る
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm md:max-w-md">
          <InteractiveLogo className="aspect-[1210/1280] w-full" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div className="space-y-3">
            <SectionLabel>WORKS</SectionLabel>
            <h2 className="text-3xl font-black">作品</h2>
          </div>
          <Link href="/works/" className="text-sm font-bold hover:text-fun-red-ink">
            一覧 →
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {works.map((w) => (
            <li key={w.slug}>
              <Link href="/works/" className="group block space-y-2">
                <div className="relative aspect-video overflow-hidden bg-ink">
                  <Poster src={workPoster(w)!} contain={Boolean(w.thumbnail)} />
                </div>
                <p className="font-bold leading-snug group-hover:text-fun-red-ink">{w.title}</p>
                <p className="text-xs text-muted">{w.event ?? w.year}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 md:grid-cols-2">
        <div>
          <div className="mb-6 flex items-end justify-between">
            <div className="space-y-3">
              <SectionLabel>SCHEDULE</SectionLabel>
              <h2 className="text-3xl font-black">これからの予定</h2>
            </div>
            <Link href="/course/#schedule" className="text-sm font-bold hover:text-fun-red-ink">
              カレンダー →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              次の予定は準備中です。
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {upcoming.map((e, i) => (
                <li key={i} className="flex items-center gap-4 py-4">
                  <span className="w-24 shrink-0 font-display font-bold">{e.date.replaceAll("-", ".")}</span>
                  <span className="bg-ink px-2 py-0.5 text-xs font-bold text-white">{eventKindLabels[e.kind]}</span>
                  <span className="font-bold">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-6 flex items-end justify-between">
            <div className="space-y-3">
              <SectionLabel>NEWS</SectionLabel>
              <h2 className="text-3xl font-black">お知らせ</h2>
            </div>
            <Link href="/news/" className="text-sm font-bold hover:text-fun-red-ink">
              一覧 →
            </Link>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {news.map((n) => (
              <li key={n.slug}>
                <Link href={`/news/${n.slug}/`} className="flex flex-col gap-1 py-4 hover:text-fun-red-ink sm:flex-row sm:gap-4">
                  <span className="w-24 shrink-0 font-display font-bold text-muted">
                    {n.date.toISOString().slice(0, 10).replaceAll("-", ".")}
                  </span>
                  <span className="font-bold">{n.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="relative overflow-hidden bg-ink px-6 py-12 text-white sm:px-12">
          <div className="relative z-10 max-w-xl space-y-5">
            <SectionLabel invert>JOIN US</SectionLabel>
            <h2 className="text-3xl font-black sm:text-4xl">部員募集中</h2>
            <p className="leading-relaxed text-white/75">
              見学はいつでも受け付けています。
            </p>
            <Link href="/join/" className="inline-block bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-white">
              入部案内へ
            </Link>
          </div>
          <svg viewBox="0 0 40 44" className="absolute -bottom-10 -right-10 hidden size-80 opacity-90 sm:block" aria-hidden="true">
            <polygon points="20,2 38,12 20,22 2,12" fill="var(--color-fun-red)" />
            <polygon points="2,12 20,22 20,42 2,32" fill="var(--color-ink-2)" />
            <polygon points="20,22 38,12 38,32 20,42" fill="#2e3037" />
          </svg>
        </div>
      </section>
    </>
  );
}
