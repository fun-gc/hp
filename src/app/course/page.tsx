import type { Metadata } from "next";
import { Cube, cubeCycle } from "@/components/Cube";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { PageHeading, SectionLabel } from "@/components/SectionLabel";
import { getSchedule } from "@/lib/content";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "ゲーム開発講座" };

// 講座テンプレートの「90分の配分の目安」
const flow = [
  { title: "導入", text: "今日のゴール・流れ・前回のふりかえり", min: 10 },
  { title: "章 1", text: "体験 → 解説 → つまずき", min: 15 },
  { title: "章 2", text: "体験 → 解説 → つまずき", min: 15 },
  { title: "章 3", text: "体験 → 解説 → ここだけは覚える", min: 15 },
  { title: "演習・解答例", text: "ゴールと手順を見て、自分で書く", min: 25 },
  { title: "まとめ・次回予告", text: "3 つの学びの振り返りと NEXT", min: 10 },
];

const firstSession = ["エディタの見方", "GameObject と Component", "初めてのスクリプト", "C# の最低限の文法", "演習:キューブを動かす"];

export default function CoursePage() {
  const events = getSchedule();
  const buildDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        label="COURSE"
        title="ゲーム開発講座"
        lead="Unity をメインにしたゲーム開発講座です。"
      />

      <section id="schedule" className="mb-20 scroll-mt-24 space-y-6">
        <div className="space-y-3">
          <SectionLabel>SCHEDULE</SectionLabel>
          <h2 className="text-3xl font-black">講座・イベントの日程</h2>
          <p className="text-muted">日付を押すと、その日の予定だけを表示します。</p>
        </div>
        <ScheduleCalendar events={events} buildDate={buildDate} />
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-5">
          <SectionLabel>TIME · 90 分</SectionLabel>
          <h2 className="text-2xl font-black">1 回の流れ</h2>
          <ul className="divide-y divide-line border-y border-line">
            {flow.map((f, i) => (
              <li key={f.title} className="flex items-center gap-4 py-3">
                <Cube color={cubeCycle[i % 3]} className="size-6 shrink-0" />
                <span className="w-24 shrink-0 font-bold sm:w-36">{f.title}</span>
                <span className="flex-1 text-sm text-muted">{f.text}</span>
                <span className="font-display font-bold">{f.min}分</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5">
          <SectionLabel>EXAMPLE · 第 1 回</SectionLabel>
          <h2 className="text-2xl font-black">たとえば第 1 回では</h2>
          <ol className="space-y-3">
            {firstSession.map((t, i) => (
              <li key={t} className="flex items-center gap-4 border border-line bg-white px-4 py-3">
                <span className="font-display text-lg font-bold">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-bold">{t}</span>
              </li>
            ))}
          </ol>
          {site.courseRepoPublic ? (
            <a
              href={site.courseRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-ink px-5 py-3 font-bold text-white hover:bg-fun-red"
            >
              講座資料(GitHub) →
            </a>
          ) : (
            <p className="text-sm text-muted">講座資料は GitHub で公開する準備をしています。</p>
          )}
        </div>
      </section>
    </div>
  );
}
