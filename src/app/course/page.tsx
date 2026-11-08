import type { Metadata } from "next";
import { Cube, cubeCycle } from "@/components/Cube";
import { ScheduleCalendar } from "@/components/ScheduleCalendar";
import { PageHeading } from "@/components/SectionLabel";
import { getSchedule } from "@/lib/content";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Course" };

// 講座テンプレートの「90分の配分の目安」
const flow = [
  { title: "Intro", text: "Today's goal, the plan, a look back", min: 10 },
  { title: "Chapter 1", text: "Try → Explain → Pitfalls", min: 15 },
  { title: "Chapter 2", text: "Try → Explain → Pitfalls", min: 15 },
  { title: "Chapter 3", text: "Try → Explain → Remember this", min: 15 },
  { title: "Exercise", text: "Write it yourself from the goal and steps", min: 25 },
  { title: "Wrap-up", text: "Three takeaways and what's NEXT", min: 10 },
];

const firstSession = ["Reading the editor", "GameObject & Component", "Your first script", "Just enough C#", "Exercise: move a cube"];

export default function CoursePage() {
  const events = getSchedule();
  const buildDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        en="COURSE"
        lead={
          <>
            Game development courses, mainly in Unity.
            <br />
            Beginners welcome — just drop in.
          </>
        }
      />

      <section id="schedule" className="mb-20 scroll-mt-24 space-y-6">
        <div className="space-y-3">
          <h2 className="font-poster text-5xl font-light">Schedule</h2>
          <p className="font-mono text-xs tracking-wider text-muted">TAP A DATE TO FILTER.</p>
        </div>
        <ScheduleCalendar events={events} buildDate={buildDate} />
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div className="space-y-5">
          <h2 className="flex items-baseline gap-3 font-poster text-4xl font-light">
            One session <span className="font-mono text-xs tracking-[0.2em] text-muted">90 MIN</span>
          </h2>
          <ul className="divide-y divide-ink/20 border-y border-ink">
            {flow.map((f, i) => (
              <li key={f.title} className="flex items-center gap-4 py-3">
                <Cube color={cubeCycle[i % 3]} className="size-6 shrink-0" />
                <span className="w-24 shrink-0 font-bold sm:w-36">{f.title}</span>
                <span className="flex-1 text-sm text-muted">{f.text}</span>
                <span className="font-mono font-bold">{f.min}<span className="text-[10px] font-normal text-muted"> MIN</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5">
          <h2 className="flex items-baseline gap-3 font-poster text-4xl font-light">
            Session 01 <span className="font-mono text-xs tracking-[0.2em] text-muted">FOR EXAMPLE</span>
          </h2>
          <ol className="space-y-3">
            {firstSession.map((t, i) => (
              <li key={t} className="flex items-center gap-4 border border-ink/25 bg-paper-2 px-4 py-3">
                <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-bold">{t}</span>
              </li>
            ))}
          </ol>
          {site.courseRepoPublic ? (
            <a
              href={site.courseRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-ink px-5 py-3 font-bold text-white hover:bg-fun-yellow hover:text-ink"
            >
              MATERIALS (GitHub) →
            </a>
          ) : (
            <p className="font-mono text-xs tracking-wider text-muted">MATERIALS — COMING SOON ON GITHUB.</p>
          )}
        </div>
      </section>
    </div>
  );
}
