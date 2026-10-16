import type { Metadata } from "next";
import { PageHeading } from "@/components/SectionLabel";
import { WorkCard } from "@/components/WorkCard";
import { getWorks } from "@/lib/content";

export const metadata: Metadata = { title: "作品" };

export default function WorksPage() {
  const works = getWorks();
  const groups = new Map<string, typeof works>();
  for (const w of works) {
    const key = w.event ?? String(w.year);
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading label="WORKS" title="作品" />
      <div className="space-y-16">
        {[...groups.entries()].map(([event, items]) => (
          <section key={event} className="space-y-6">
            <h2 className="flex items-center gap-3 text-2xl font-black">
              <span className="h-6 w-1.5 bg-fun-red" aria-hidden="true" />
              {event}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((w) => (
                <WorkCard key={w.slug} work={w} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
