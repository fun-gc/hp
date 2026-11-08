import type { Metadata } from "next";
import Link from "next/link";
import { Cube, cubeCycle } from "@/components/Cube";
import { PageHeading } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

const activities = [
  {
    title: "Game Development Course",
    text: "Unity をメインにしたゲーム開発講座を定期的に開いています。1 回 90 分で、先に動かして体験し、あとから用語と仕組みを学ぶ流れです。",
    link: { href: "/course/", label: "COURSE & SCHEDULE" },
  },
  {
    title: `Exhibition at ${site.events.welcomeEn}`,
    text: "春の新入生歓迎イベントで、メンバーがつくったゲームを展示します。",
  },
  {
    title: `Exhibition at ${site.events.festivalEn}`,
    text: "毎年の学校祭で、1 年間の成果となるゲームを展示しています。過去の展示作品は作品ページで遊べます。",
    link: { href: "/works/", label: "PAST WORKS" },
  },
  {
    title: "Team Development",
    text: "企画・プログラム・グラフィック・サウンドを分担し、ひとつのゲームを長い期間かけてつくっています。",
    id: "team",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading en="ABOUT" lead={`FUNGC は${site.university}のゲーム制作サークルです。活動の拠点は Discord と学内です。`} />

      <ol className="divide-y divide-ink/20 border-y border-ink">
        {activities.map((a, i) => (
          <li key={a.title} id={a.id} data-reveal className="grid scroll-mt-24 gap-4 py-8 sm:grid-cols-[auto_5rem_1fr]">
            <Cube color={cubeCycle[i % 3]} className="hidden size-8 sm:block" />
            <span className="font-poster text-5xl font-light leading-none">{String(i + 1).padStart(2, "0")}</span>
            <div className="space-y-3">
              <h2 className="text-xl font-black sm:text-2xl">{a.title}</h2>
              <p className="max-w-3xl leading-relaxed text-muted">{a.text}</p>
              {a.id === "team" && (
                <p className="flex max-w-3xl items-center gap-4 border-l-4 border-fun-yellow bg-paper-2 px-5 py-4">
                  <span className="font-mono text-xs tracking-[0.2em] text-muted">NOW BUILDING</span>
                  <span className="font-bold">いまはメトロイドヴァニアを開発しています。</span>
                </p>
              )}
              {a.link && (
                <Link href={a.link.href} className="inline-block font-mono text-sm font-bold tracking-wider hover:bg-fun-yellow">
                  {a.link.label} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-16 grid gap-8 md:grid-cols-2">
        <div data-reveal className="space-y-4">
          <h2 className="font-poster text-4xl font-light">FUGU → FUNGC</h2>
          <p className="leading-relaxed text-muted">
            以前は「FUGU(FUN Game Unity)」という名前で活動し、Global Game Jam への参加や未来祭でのオンライン作品展示を行っていました。現在は FUNGC として活動を続けています。
          </p>
        </div>
        <div data-reveal className="space-y-4">
          <h2 className="font-poster text-4xl font-light">Where we work</h2>
          <dl className="divide-y divide-ink/20 border-y border-ink/40">
            <div className="flex flex-wrap gap-x-4 py-3">
              <dt className="w-24 font-mono text-xs tracking-[0.2em] text-muted">ONLINE</dt>
              <dd className="leading-relaxed">Discord サーバー(日々の相談、作品共有、お知らせ)</dd>
            </div>
            <div className="flex flex-wrap gap-x-4 py-3">
              <dt className="w-24 font-mono text-xs tracking-[0.2em] text-muted">CAMPUS</dt>
              <dd className="leading-relaxed">{site.university}の学内(講座、展示準備)</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
