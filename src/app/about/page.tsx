import type { Metadata } from "next";
import Link from "next/link";
import { Cube, cubeCycle } from "@/components/Cube";
import { PageHeading } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

const activities = [
  {
    title: "Game Development Course",
    text: "Regular game development courses, mainly in Unity. 90 minutes each: build it and play with it first, then learn the terms and how it works.",
    link: { href: "/course/", label: "COURSE & SCHEDULE" },
  },
  {
    title: `Exhibition at ${site.events.welcomeEn}`,
    text: "Our members' games on show at the spring welcome event for new students.",
  },
  {
    title: `Exhibition at ${site.events.festivalEn}`,
    text: "Every year we exhibit the year's games at the school festival. Past exhibits are playable on the Works page.",
    link: { href: "/works/", label: "PAST WORKS" },
  },
  {
    title: "Team Development",
    text: "Planning, programming, graphics and sound, split into roles — one game, built over a long stretch.",
    id: "team",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading en="ABOUT" lead={`FUNGC is the game creation circle of ${site.universityEn}. We work on Discord and on campus.`} />

      <ol className="divide-y divide-ink/20 border-y border-ink">
        {activities.map((a, i) => (
          <li key={a.title} id={a.id} className="grid scroll-mt-24 gap-4 py-8 sm:grid-cols-[auto_5rem_1fr]">
            <Cube color={cubeCycle[i % 3]} className="hidden size-8 sm:block" />
            <span className="font-poster text-5xl font-light leading-none">{String(i + 1).padStart(2, "0")}</span>
            <div className="space-y-3">
              <h2 className="text-xl font-black sm:text-2xl">{a.title}</h2>
              <p className="max-w-3xl leading-relaxed text-muted">{a.text}</p>
              {a.id === "team" && (
                <p className="flex max-w-3xl items-center gap-4 border-l-4 border-fun-yellow bg-paper-2 px-5 py-4">
                  <span className="font-mono text-xs tracking-[0.2em] text-muted">NOW BUILDING</span>
                  <span className="font-bold">Metroidvania</span>
                </p>
              )}
              {a.link && (
                <Link href={a.link.href} className="inline-block font-mono text-sm font-bold tracking-wider hover:bg-fun-yellow">
                  {a.link.label} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-16 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-poster text-4xl font-light">FUGU → FUNGC</h2>
          <p className="leading-relaxed text-muted">
            Formerly known as FUGU (FUN Game Unity): we joined Global Game Jam and held online exhibitions at {site.events.festivalEn}. Now we carry on as FUNGC.
          </p>
        </div>
        <div className="space-y-4">
          <h2 className="font-poster text-4xl font-light">Where we work</h2>
          <dl className="divide-y divide-ink/20 border-y border-ink/40">
            <div className="flex flex-wrap gap-x-4 py-3">
              <dt className="w-24 font-mono text-xs tracking-[0.2em] text-muted">ONLINE</dt>
              <dd className="leading-relaxed">Discord — daily talk, sharing work, announcements</dd>
            </div>
            <div className="flex flex-wrap gap-x-4 py-3">
              <dt className="w-24 font-mono text-xs tracking-[0.2em] text-muted">CAMPUS</dt>
              <dd className="leading-relaxed">{site.universityEn} — courses, exhibition prep</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
