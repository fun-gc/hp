import type { Metadata } from "next";
import Link from "next/link";
import { Cube, cubeCycle } from "@/components/Cube";
import { PageHeading } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "活動紹介" };

const activities = [
  {
    title: "ゲーム開発講座",
    text: "Unity をメインにしたゲーム開発講座を定期的に開いています。1 回 90 分で、先に動かして体験し、あとから用語と仕組みを学ぶ流れです。",
    link: { href: "/course/", label: "講座の詳細と日程" },
  },
  {
    title: `新入生歓迎イベント ${site.events.welcome} での展示`,
    text: "春の新入生歓迎イベントで、メンバーがつくったゲームを展示します。",
  },
  {
    title: `学校祭「${site.events.festival}」での展示`,
    text: "毎年の学校祭で、1 年間の成果となるゲームを展示しています。過去の展示作品は作品ページで遊べます。",
    link: { href: "/works/", label: "過去の展示作品" },
  },
  {
    title: "チームでの長期開発",
    text: "企画・プログラム・グラフィック・サウンドを分担し、ひとつのゲームを長い期間かけてつくっています。",
    id: "team",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        title="活動紹介"
        lead={`FUN GC は${site.university}のゲーム制作サークルです。活動の拠点は Discord と学内です。`}
      />

      <ol className="divide-y divide-line border-y border-line">
        {activities.map((a, i) => (
          <li key={a.title} id={a.id} className="grid scroll-mt-24 gap-4 py-8 sm:grid-cols-[auto_4rem_1fr]">
            <Cube color={cubeCycle[i % 3]} className="hidden size-8 sm:block" />
            <span className="font-display text-3xl font-bold leading-none">{String(i + 1).padStart(2, "0")}</span>
            <div className="space-y-3">
              <h2 className="text-xl font-black sm:text-2xl">{a.title}</h2>
              <p className="max-w-3xl leading-relaxed text-muted">{a.text}</p>
              {a.id === "team" && (
                <p className="max-w-3xl border-l-4 border-fun-yellow bg-white px-5 py-4 font-bold">
                  いまはメトロイドヴァニアを開発しています。
                </p>
              )}
              {a.link && (
                <Link href={a.link.href} className="inline-block font-bold hover:text-fun-red-ink">
                  {a.link.label} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-16 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-2xl font-black">FUGU から FUN GC へ</h2>
          <p className="leading-relaxed text-muted">
            以前は「FUGU(FUN Game Unity)」という名前で活動し、Global Game Jam への参加や未来祭でのオンライン作品展示を行っていました。現在は FUN GC として活動を続けています。
          </p>
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-black">活動場所</h2>
          <ul className="space-y-2 leading-relaxed text-muted">
            <li>・Discord サーバー(日々の相談、作品共有、お知らせ)</li>
            <li>・{site.university}の学内(講座、展示準備)</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
