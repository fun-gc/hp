import type { Metadata } from "next";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { PageHeading } from "@/components/SectionLabel";
import { getSchedule } from "@/lib/content";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Course" };

export default function CoursePage() {
  const events = getSchedule();
  const buildDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        en="COURSE"
        lead={
          <>
            Unity をメインにしたゲーム開発講座です。
            <br />
            初めての方も気軽にお声かけください。
          </>
        }
      />

      <section id="schedule" className="scroll-mt-24 space-y-6">
        <div data-reveal className="space-y-3">
          <h2 className="font-poster text-5xl font-light">Schedule</h2>
          <p className="text-muted">日付を押すと、その日の予定だけを表示します。</p>
        </div>
        <div data-reveal>
          <ScheduleCalendar events={events} buildDate={buildDate} />
        </div>
        {/* 講座資料のリポジトリを公開したら(site.courseRepoPublic)、ここにリンクを出す */}
        {site.courseRepoPublic && (
          <a
            href={site.courseRepoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-ink px-5 py-3 font-mono text-sm font-bold tracking-wider text-white hover:bg-fun-yellow hover:text-ink"
          >
            MATERIALS (GitHub) →
          </a>
        )}
      </section>
    </div>
  );
}
