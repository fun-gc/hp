import Link from "next/link";
import { Cube } from "@/components/Cube";
import { InteractiveLogo } from "@/components/InteractiveLogo";
import { PointBand, SectionLabel } from "@/components/SectionLabel";
import { getNews, getSchedule } from "@/lib/content";
import { eventKindLabels } from "@/lib/schema";
import { site } from "@/lib/site";

const activities = [
  {
    color: "red" as const,
    title: "ゲーム開発講座",
    text: "Unity を中心に、まず動かして体験してから学ぶ 90 分の講座を開いています。",
    href: "/course/",
  },
  {
    color: "green" as const,
    title: "作品展示",
    text: `新入生歓迎イベント ${site.events.welcome} と学校祭「${site.events.festival}」で、メンバーのゲームを展示しています。`,
    href: "/works/",
  },
  {
    color: "yellow" as const,
    title: "チーム開発",
    text: "役割を分担して、ひとつのゲームを長期間かけてつくるチーム開発にも取り組んでいます。",
    href: "/about/#team",
  },
];

export default function Home() {
  const news = getNews().slice(0, 3);
  const buildDate = new Date().toISOString().slice(0, 10);
  const upcoming = getSchedule()
    .filter((e) => e.date >= buildDate)
    .slice(0, 3);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div className="space-y-6">
          <SectionLabel>FUTURE UNIVERSITY HAKODATE</SectionLabel>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            つくって、
            <br />
            遊んで、
            <br />
            <span className="marker">見せあおう。</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            FUN GC は{site.university}のゲーム制作サークルです。Discord と学内を拠点に、講座、展示、チーム開発を通してゲームづくりを楽しんでいます。
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
          <p className="mt-3 text-center text-xs text-muted">立方体の面を押してみよう</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 space-y-3">
          <SectionLabel>ACTIVITY</SectionLabel>
          <h2 className="text-3xl font-black">3 つの活動</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {activities.map((a) => (
            <Link
              key={a.title}
              href={a.href}
              className="group flex flex-col gap-4 border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-ink)]"
            >
              <Cube color={a.color} className="size-10" />
              <h3 className="text-xl font-black">{a.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted">{a.text}</p>
              <span className="font-display text-sm font-bold tracking-widest group-hover:text-fun-red-ink">MORE →</span>
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <PointBand>用語は後から。まず動かして、体験してから名前を付けよう。</PointBand>
        </div>
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
            <h2 className="text-3xl font-black sm:text-4xl">一緒にゲームをつくろう</h2>
            <p className="leading-relaxed text-white/75">
              プログラム、絵、音、企画。得意なことがあってもなくても、ゲームが好きならぜひ見学に来てください。
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
