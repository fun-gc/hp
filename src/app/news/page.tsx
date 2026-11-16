import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { ArrowLine } from "@/components/Poster";
import { getNews } from "@/lib/content";

export const metadata: Metadata = { title: "News" };

export default function NewsPage() {
  const news = getNews();
  return (
    <>
      <PageHeading en="NEWS" />
      <div className="wrap py-16 sm:py-20">
        <ul className="max-w-5xl border-t border-ink">
          {news.map((n, i) => (
            <li key={n.slug} className="border-b border-ink/25">
              <Link href={`/news/${n.slug}/`} className="group grid gap-x-8 gap-y-2 py-7 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline">
                <span className="font-mono text-sm text-muted">
                  <span className="mr-3 text-[10px]" aria-hidden="true">
                    [{String(news.length - i).padStart(2, "0")}]
                  </span>
                  {n.date.toISOString().slice(0, 10).replaceAll("-", ".")}
                </span>
                <span className="space-y-1.5">
                  <span className="block text-lg font-extrabold leading-snug">
                    <span className="group-hover:bg-fun-yellow">{n.title}</span>
                  </span>
                  <span className="block text-sm leading-relaxed text-muted">{n.excerpt}…</span>
                </span>
                <ArrowLine length="2rem" className="hidden sm:inline-block" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
