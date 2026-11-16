import type { Metadata } from "next";
import { PageHeading } from "@/components/Heading";
import { Annot } from "@/components/Poster";
import { WorkCard } from "@/components/WorkCard";
import { getWorks } from "@/lib/content";

export const metadata: Metadata = { title: "Works" };

export default function WorksPage() {
  const works = getWorks();
  const groups = new Map<string, typeof works>();
  for (const w of works) {
    const key = w.event ?? String(w.year);
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return (
    <>
      <PageHeading en="WORKS" />
      <div className="wrap space-y-20 py-16 sm:py-20">
        {[...groups.entries()].map(([event, items], g) => (
          <section key={event}>
            <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink pb-3">
              <span className="hl px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.2em]" aria-hidden="true">
                SET {String(g + 1).padStart(2, "0")}
              </span>
              <h2 className="text-2xl font-extrabold">{event}</h2>
              <Annot className="ml-auto text-muted">{String(items.length).padStart(2, "0")} WORKS</Annot>
            </div>
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((w) => (
                <WorkCard key={w.slug} work={w} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
