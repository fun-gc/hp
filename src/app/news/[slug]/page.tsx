import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Annot, Tri } from "@/components/Poster";
import { getNews } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getNews().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const item = getNews().find((n) => n.slug === slug);
  return { title: item?.title, description: item?.excerpt };
}

export default async function NewsArticle({ params }: PageProps<"/news/[slug]">) {
  const { slug } = await params;
  const item = getNews().find((n) => n.slug === slug);
  if (!item) notFound();

  return (
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <header className="mb-10 border-b border-ink pb-8">
        <p className="flex items-center gap-3 text-muted">
          <Tri className="size-3 text-ink" />
          <Annot>H04 — NEWS</Annot>
          <span className="h-px flex-1 bg-current opacity-50" aria-hidden="true" />
          <span className="font-mono text-sm">{item.date.toISOString().slice(0, 10).replaceAll("-", ".")}</span>
        </p>
        <h1 className="mt-6 text-3xl font-extrabold leading-snug sm:text-4xl">{item.title}</h1>
      </header>
      {/* 本文は content/news の Markdown をビルド時に HTML にしたもの(リポジトリ内の文章だけを表示する) */}
      <div className="prose-fun" dangerouslySetInnerHTML={{ __html: item.html }} />
      <Link href="/news/" className="mt-14 inline-block px-1 font-mono text-xs font-medium tracking-[0.2em] hover:bg-fun-yellow">
        ← ALL NEWS
      </Link>
    </article>
  );
}
