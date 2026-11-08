import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/SectionLabel";
import { getNews } from "@/lib/content";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  const news = getNews();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading en="NEWS" />
      <ul className="divide-y divide-ink/20 border-y border-ink">
        {news.map((n) => (
          <li key={n.slug}>
            <Link href={`/news/${n.slug}/`} className="group flex flex-col gap-2 py-6 sm:flex-row sm:gap-6">
              <span className="w-28 shrink-0 font-mono text-sm text-muted">
                {n.date.toISOString().slice(0, 10).replaceAll("-", ".")}
              </span>
              <span className="space-y-1">
                <span className="block text-lg font-black group-hover:bg-fun-yellow">{n.title}</span>
                <span className="block text-sm text-muted">{n.excerpt}…</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
