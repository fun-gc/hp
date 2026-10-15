"use client";

import { useState } from "react";
import type { Work } from "@/lib/schema";

/* eslint-disable @next/next/no-img-element -- GIF や外部サムネイルをそのまま表示する */
function Poster({ src, contain = false }: { src: string; contain?: boolean }) {
  if (!contain) {
    return <img src={src} alt="" loading="lazy" className="size-full object-cover opacity-90 transition group-hover:opacity-100" />;
  }
  // タイトル画面などが切れないよう全体を表示し、余白には同じ画像をぼかして敷く
  return (
    <>
      <img src={src} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-xl" />
      <img src={src} alt="" loading="lazy" className="relative size-full object-contain" />
    </>
  );
}
/* eslint-enable @next/next/no-img-element */

// 作品カード。サムネイルを押したときだけ YouTube を読み込むので、一覧ページが重くならない。
export function WorkCard({ work }: { work: Work }) {
  const [playing, setPlaying] = useState(false);
  // サムネイルは「自前の画像・GIF」→「YouTube のサムネイル」の順で使う
  const poster =
    work.thumbnail ?? (work.youtubeId ? `https://i.ytimg.com/vi/${work.youtubeId}/hqdefault.jpg` : undefined);

  return (
    <article className="flex flex-col border border-line bg-white">
      <div className="relative aspect-video overflow-hidden bg-ink">
        {work.youtubeId && playing ? (
          <iframe
            className="absolute inset-0 size-full"
            src={`https://www.youtube-nocookie.com/embed/${work.youtubeId}?autoplay=1`}
            title={`${work.title} の紹介動画`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : work.youtubeId ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0"
            aria-label={`${work.title} の紹介動画を再生`}
          >
            <Poster src={poster!} contain={Boolean(work.thumbnail)} />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center bg-fun-red text-white transition group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="ml-1 size-6" aria-hidden="true">
                  <path d="M6 4l14 8-14 8z" fill="currentColor" />
                </svg>
              </span>
            </span>
          </button>
        ) : poster ? (
          <Poster src={poster} contain={Boolean(work.thumbnail)} />
        ) : (
          <div className="grid size-full place-items-center font-display text-3xl font-bold tracking-widest text-white/30">
            NO IMAGE
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          {work.event && <span className="bg-ink px-2 py-0.5 font-bold text-white">{work.event}</span>}
          {work.tags.map((t) => (
            <span key={t} className="border border-line px-2 py-0.5 text-muted">
              {t}
            </span>
          ))}
        </div>
        <h3 className="text-lg font-black leading-snug">{work.title}</h3>
        <p className="text-sm text-muted">{work.authors.join("、")}</p>
        <p className="flex-1 text-sm leading-relaxed">{work.body}</p>
        {work.playUrl && (
          <a
            href={work.playUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-2 bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-fun-red"
          >
            {work.playLabel ?? "遊んでみる"} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
    </article>
  );
}
