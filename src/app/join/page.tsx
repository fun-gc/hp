import type { Metadata } from "next";
import { PageHeading, SubHead } from "@/components/Heading";
import { NightStage } from "@/components/NightStage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Join" };

const steps = [
  { title: "フォームで入部・見学を申し込む", text: "入部・見学フォームで希望する内容を選び、名前とメールアドレスを入力してください。相談は下の連絡先でも受け付けています。" },
  { title: "メールを確認して Discord に参加", text: "メールアドレスが @fun.ac.jp の場合、学内メール宛てに Discord サーバーの招待リンクを自動送信します。届いたメールから参加してください。" },
  { title: "講座やチームに参加", text: "講座で Unity の基本を学びながら、展示やチーム開発に参加できます。" },
];

export default function JoinPage() {
  return (
    <>
      <PageHeading en="JOIN" lead="Google フォームから入部、見学を受け付けています。" />

      <div className="wrap grid gap-16 py-16 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <section aria-labelledby="join-form-heading">
          <SubHead id="join-form-heading" note="GOOGLE FORM">
            Join / Visit
          </SubHead>
          {site.joinFormUrl ? (
            <a
              href={site.joinFormUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 bg-fun-yellow px-7 py-4 text-lg font-extrabold text-ink transition-colors hover:bg-ink hover:text-white"
            >
              今すぐ参加
              <span className="font-mono text-sm font-normal" aria-hidden="true">
                ↗
              </span>
              <span className="sr-only">(Google フォームが新しいタブで開きます)</span>
            </a>
          ) : (
            <p className="font-bold">入部・見学フォームは準備中です。下のお問い合わせ先からご連絡ください。</p>
          )}
        </section>

        <section aria-labelledby="join-steps-heading">
          <SubHead id="join-steps-heading" note="3 STEPS">
            How to join
          </SubHead>
          <ol>
            {steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[4.5rem_1fr] gap-x-4 border-b border-ink/25 py-5 first:pt-0">
                <span className="font-poster text-5xl font-light leading-none tabular-nums lining-nums" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="space-y-1">
                  <p className="text-lg font-extrabold">{s.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* トップの「Join us」と同じ、夜の建物 */}
      <div id="contact" className="scroll-mt-16">
        <NightStage labelledBy="contact-heading" arc="PLEASE LEAVE A MESSAGE AFTER THE BEEP">
          <h2 id="contact-heading" className="poster-word text-6xl sm:text-8xl">
            Contact
          </h2>
          <p className="mt-6 max-w-md border-l border-white/60 pl-4 leading-relaxed text-white/85">入部や見学の相談、展示・取材のご依頼などはこちらからどうぞ。</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {site.contactFormUrl && (
              <a
                href={site.contactFormUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-fun-yellow px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] text-ink transition-colors hover:bg-white"
              >
                CONTACT FORM
              </a>
            )}
            <a href={`mailto:${site.email}`} className="border border-white px-6 py-3 font-mono text-sm font-medium tracking-wider transition-colors hover:bg-white hover:text-ink">
              {site.email}
            </a>
          </div>
        </NightStage>
      </div>
    </>
  );
}
