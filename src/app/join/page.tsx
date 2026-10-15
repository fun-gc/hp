import type { Metadata } from "next";
import { Cube, cubeCycle } from "@/components/Cube";
import { PageHeading, SectionLabel } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "入部案内" };

const steps = [
  { title: "見学・相談", text: `${site.events.welcome}や${site.events.festival}の展示、講座の日に気軽に声をかけてください。下の連絡先からの相談も歓迎です。` },
  { title: "Discord に参加", text: "活動の連絡は Discord で行います。入部が決まったらサーバーの招待リンクをお送りします。" },
  { title: "講座やチームに参加", text: "講座で Unity の基本を学びながら、展示やチーム開発に参加できます。" },
];

const welcome = [
  "ゲームをつくってみたい人",
  "プログラム・イラスト・ドット絵・音楽・企画など、得意なことを活かしたい人",
  "一緒に展示やゲームジャムに挑戦したい人",
];

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        label="JOIN"
        title="入部案内"
        lead={`FUN GC は${site.university}の学生が集まるゲーム制作サークルです。ゲームが好きなら、それだけで十分です。`}
      />

      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-5">
          <SectionLabel>WELCOME</SectionLabel>
          <h2 className="text-2xl font-black">こんな人を待っています</h2>
          <ul className="space-y-3">
            {welcome.map((w, i) => (
              <li key={w} className="flex items-start gap-3 border border-line bg-white px-4 py-3">
                <Cube color={cubeCycle[i % 3]} className="mt-0.5 size-6 shrink-0" />
                <span className="font-bold">{w}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5">
          <SectionLabel>FLOW</SectionLabel>
          <h2 className="text-2xl font-black">入部までの流れ</h2>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center bg-ink font-display font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="contact" className="mt-20 scroll-mt-24 bg-ink px-6 py-10 text-white sm:px-10">
        <div className="space-y-4">
          <SectionLabel invert>CONTACT</SectionLabel>
          <h2 className="text-2xl font-black sm:text-3xl">お問い合わせ</h2>
          <p className="text-white/75">入部や見学の相談、展示・取材のご依頼などはこちらからどうぞ。</p>
          <div className="flex flex-wrap gap-3 pt-2">
            {site.contactFormUrl && (
              <a
                href={site.contactFormUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-white"
              >
                お問い合わせフォーム
              </a>
            )}
            <a href={`mailto:${site.email}`} className="border-2 border-white px-6 py-3 font-bold transition hover:bg-white hover:text-ink">
              {site.email}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
