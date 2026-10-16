import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 space-y-4">
        <p className="font-display text-sm font-bold text-muted">{item.date.toISOString().slice(0, 10).replaceAll("-", ".")}</p>
        <h1 className="text-3xl font-black leading-snug sm:text-4xl">{item.title}</h1>
      </header>
      {/* 本文は content/news の Markdown をビルド時に HTML にしたもの(リポジトリ内の文章だけを表示する) */}
      <div className="prose-fun" dangerouslySetInnerHTML={{ __html: item.html }} />
      <Link href="/news/" className="mt-12 inline-block font-bold hover:text-fun-red-ink">
        ← お知らせ一覧へ
      </Link>
    </article>
  );
}
