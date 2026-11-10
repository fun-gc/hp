import type { Metadata } from "next";
import Link from "next/link";
import { Cube, cubeCycle } from "@/components/Cube";
import { PageHeading, SubHead } from "@/components/Heading";
import { ArrowLine } from "@/components/Poster";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

const activities = [
  {
    title: "ゲーム開発講座",
    text: "Unity をメインにしたゲーム開発講座を定期的に開いています。1 回 90 分で、先に動かして体験し、あとから用語と仕組みを学ぶ流れです。",
    link: { href: "/course/", label: "COURSE & SCHEDULE" },
  },
  {
    title: `新入生歓迎イベント ${site.events.welcome} での展示`,
    text: "春の新入生歓迎イベントで、メンバーがつくったゲームを展示します。",
  },
  {
    title: `学校祭「${site.events.festival}」での展示`,
    text: "毎年の学校祭で、1 年間の成果となるゲームを展示しています。過去の展示作品は作品ページで遊べます。",
    link: { href: "/works/", label: "PAST WORKS" },
  },
  {
    title: "チームでの長期開発",
    text: "企画・プログラム・グラフィック・サウンドを分担し、ひとつのゲームを長い期間かけてつくっています。",
    id: "team",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeading en="ABOUT" lead={`FUNGC は${site.university}のゲーム制作サークルです。活動の拠点は Discord と学内です。`} />

      <div className="wrap py-16 sm:py-20">
        <ol className="border-t border-ink">
          {activities.map((a, i) => (
            <li key={a.title} id={a.id} className="grid scroll-mt-24 gap-x-8 gap-y-4 border-b border-ink/25 py-9 sm:grid-cols-[6.5rem_1fr_auto]">
              <span className="font-poster text-6xl font-light leading-none tabular-nums lining-nums" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="space-y-3">
                <h2 className="text-xl font-extrabold sm:text-2xl">{a.title}</h2>
                <p className="max-w-3xl leading-relaxed text-muted">{a.text}</p>
                {a.id === "team" && (
                  <p className="flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-fun-yellow bg-paper-2 px-5 py-4">
                    <span className="font-mono text-xs tracking-[0.2em] text-muted">NOW BUILDING</span>
                    <span className="font-bold">いまはメトロイドヴァニアを開発しています。</span>
                  </p>
                )}
                {a.link && (
                  <Link href={a.link.href} className="inline-flex items-center gap-3 px-1 font-mono text-xs font-medium tracking-[0.2em] hover:bg-fun-yellow">
                    {a.link.label}
                    <ArrowLine length="2rem" />
                  </Link>
                )}
              </div>
              <Cube color={cubeCycle[i % 3]} className="hidden size-9 sm:block" />
            </li>
          ))}
        </ol>

        <section className="mt-20 grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SubHead note="SINCE FUGU">FUGU → FUNGC</SubHead>
            <p className="leading-relaxed text-muted">
              以前は「FUGU(FUN Game Unity)」という名前で活動し、Global Game Jam への参加や未来祭でのオンライン作品展示を行っていました。現在は FUNGC({site.fullName})として活動を続けています。
            </p>
          </div>
          <div>
            <SubHead note="ONLINE / CAMPUS">Where we work</SubHead>
            <dl className="divide-y divide-ink/20">
              <div className="flex flex-wrap gap-x-4 pb-3">
                <dt className="w-24 pt-1 font-mono text-xs tracking-[0.2em] text-muted">ONLINE</dt>
                <dd className="leading-relaxed">Discord サーバー(日々の相談、作品共有、お知らせ)</dd>
              </div>
              <div className="flex flex-wrap gap-x-4 pt-3">
                <dt className="w-24 pt-1 font-mono text-xs tracking-[0.2em] text-muted">CAMPUS</dt>
                <dd className="leading-relaxed">{site.university}の学内(講座、展示準備)</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}
