import type { Metadata } from "next";
import { PageHeading } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "入部案内" };

const steps = [
  { title: "フォームで入部を申し込む", text: "入部希望フォームに名前とメールアドレスを入力してください。見学や相談をしたい方は、下の連絡先からも相談できます。" },
  { title: "メールを確認して Discord に参加", text: "メールアドレスが @fun.ac.jp の場合、学内メール宛てに Discord サーバーの招待リンクを自動送信します。届いたメールから参加してください。" },
  { title: "講座やチームに参加", text: "講座で Unity の基本を学びながら、展示やチーム開発に参加できます。" },
];

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        title="入部案内"
        lead={`FUN GC は${site.university}のゲーム制作サークルです。見学はいつでも受け付けています。`}
      />

      <section aria-labelledby="join-form-heading" className="mb-12 max-w-3xl border-2 border-ink bg-white p-6 sm:p-8">
        <h2 id="join-form-heading" className="text-2xl font-black">入部を希望する方へ</h2>
        <p className="mt-4 leading-relaxed">
          入部希望フォームを送信すると、<strong>@fun.ac.jp の学内メール宛てに Discord サーバーの招待リンクを自動送信します。</strong>
          学内メールアドレスをお持ちの方は、そのアドレスを入力してください。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          学内以外のメールアドレスには、招待リンクを自動送信しません。
          見学や入部の相談は、下のお問い合わせ先へご連絡ください。
          招待メールが届かない場合は、迷惑メールフォルダーと入力したアドレスをご確認ください。
        </p>
        {site.joinFormUrl ? (
          <a href={site.joinFormUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-ink hover:text-white">
            入部希望フォームを開く（Google フォーム） ↗
          </a>
        ) : (
          <p className="mt-6 font-bold">入部希望フォームは準備中です。下のお問い合わせ先からご連絡ください。</p>
        )}
      </section>

      <section className="max-w-3xl">
        <div className="space-y-5">
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
