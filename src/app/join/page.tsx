import type { Metadata } from "next";
import { NightBackdrop } from "@/components/Poster";
import { PageHeading } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Join" };

const steps = [
  { title: "フォームで入部・見学を申し込む", text: "入部・見学フォームで希望する内容を選び、名前とメールアドレスを入力してください。相談は下の連絡先でも受け付けています。" },
  { title: "メールを確認して Discord に参加", text: "メールアドレスが @fun.ac.jp の場合、学内メール宛てに Discord サーバーの招待リンクを自動送信します。届いたメールから参加してください。" },
  { title: "講座やチームに参加", text: "講座で Unity の基本を学びながら、展示やチーム開発に参加できます。" },
];

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading en="JOIN" lead="Google フォームから入部、見学を受け付けています。" />

      <section aria-labelledby="join-form-heading" data-reveal className="mb-12 max-w-3xl">
        <h2 id="join-form-heading" className="font-poster text-4xl font-light">Join / Visit</h2>
        {site.joinFormUrl ? (
          <a href={site.joinFormUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-ink hover:text-white">
            今すぐ参加
            <span className="ml-2 font-mono text-xs font-normal" aria-hidden="true">
              ↗
            </span>
            <span className="sr-only">(Google フォームが新しいタブで開きます)</span>
          </a>
        ) : (
          <p className="mt-5 font-bold">入部・見学フォームは準備中です。下のお問い合わせ先からご連絡ください。</p>
        )}
      </section>

      <section className="max-w-3xl">
        <div className="space-y-5">
          <h2 data-reveal className="font-poster text-4xl font-light">
            How to join
          </h2>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} data-reveal className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center bg-ink font-mono font-bold text-white">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* トップの「Join us」と同じ、夜の建物の写真を敷く */}
      <section
        id="contact"
        data-reveal
        className="relative mt-20 scroll-mt-24 overflow-hidden bg-ink px-6 py-12 text-white sm:px-12 sm:py-16"
      >
        <NightBackdrop />
        <div className="relative z-10 max-w-xl space-y-4">
          <h2 className="font-poster text-4xl font-light sm:text-5xl">Contact</h2>
          <p className="text-white/75">入部や見学の相談、展示・取材のご依頼などはこちらからどうぞ。</p>
          <div className="flex flex-wrap gap-3 pt-2">
            {site.contactFormUrl && (
              <a
                href={site.contactFormUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-white"
              >
                CONTACT FORM
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
