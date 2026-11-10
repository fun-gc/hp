import type { Metadata } from "next";
import { PageHeading, SubHead } from "@/components/Heading";
import { ArrowLine } from "@/components/Poster";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { getSchedule } from "@/lib/content";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Course" };

export default function CoursePage() {
  const events = getSchedule();
  const buildDate = new Date().toISOString().slice(0, 10);

  return (
    <>
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

      <div className="wrap py-16 sm:py-20">
        <section id="schedule" className="scroll-mt-24">
          <SubHead note="JST / UTC+9">Schedule</SubHead>
          <p className="mb-6 text-muted">日付を押すと、その日の予定だけを表示します。</p>
          <ScheduleCalendar events={events} buildDate={buildDate} />
          {/* 講座資料のリポジトリを公開したら(site.courseRepoPublic)、ここにリンクを出す */}
          {site.courseRepoPublic && (
            <a
              href={site.courseRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-3 bg-ink px-5 py-3 font-mono text-sm font-medium tracking-[0.18em] text-white transition-colors hover:bg-fun-yellow hover:text-ink"
            >
              MATERIALS (GitHub)
              <ArrowLine length="1.5rem" />
            </a>
          )}
        </section>
      </div>
    </>
  );
}
