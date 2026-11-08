import type { Metadata } from "next";
import { PageHeading } from "@/components/SectionLabel";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Join" };

const steps = [
  { title: "Apply with the form", text: "Choose join or visit, then enter your name and email. Questions are welcome via the contact below, too." },
  { title: "Check your email, join Discord", text: "Addresses ending in @fun.ac.jp get a Discord invite sent to their university email automatically." },
  { title: "Join courses and teams", text: "Learn the Unity basics in the courses, then take part in exhibitions and team projects." },
];

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading en="JOIN" lead={`FUNGC is the game creation circle of ${site.universityEn}. Visitors welcome anytime.`} />

      <section aria-labelledby="join-form-heading" className="mb-12 max-w-3xl">
        <h2 id="join-form-heading" className="font-poster text-4xl font-light">Join / Visit</h2>
        {site.joinFormUrl ? (
          <a href={site.joinFormUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block bg-fun-yellow px-6 py-3 font-bold text-ink transition hover:bg-ink hover:text-white">
            OPEN THE FORM <span className="inline-block font-mono text-xs font-normal">(Google Forms) ↗</span>
          </a>
        ) : (
          <p className="mt-5 font-bold">The form is coming soon. Please use the contact below.</p>
        )}
      </section>

      <section className="max-w-3xl">
        <div className="space-y-5">
          <h2 className="font-poster text-4xl font-light">How to join</h2>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
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

      <section id="contact" className="mt-20 scroll-mt-24 bg-ink px-6 py-10 text-white sm:px-10">
        <div className="space-y-4">
          <h2 className="font-poster text-4xl font-light sm:text-5xl">Contact</h2>
          <p className="text-white/75">Joining, visiting, exhibitions, interviews — ask us anything.</p>
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
