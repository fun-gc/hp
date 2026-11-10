"use client";

import { useState } from "react";
import type { Work } from "@/lib/schema";
import { playLinkEn } from "@/lib/en";
import { workPoster } from "@/lib/work";

/* eslint-disable @next/next/no-img-element -- GIF や外部サムネイルをそのまま表示する */
export function Poster({ src, contain = false }: { src: string; contain?: boolean }) {
  if (!contain) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className="size-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
      />
    );
  }
  // タイトル画面などが切れないよう全体を表示し、余白には同じ画像をぼかして敷く
  return (
    <>
      <img src={src} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-xl" />
      <img src={src} alt="" loading="lazy" className="relative size-full object-contain transition duration-500 group-hover:scale-[1.03]" />
    </>
  );
}
/* eslint-enable @next/next/no-img-element */

// 作品カード。サムネイルを押したときだけ YouTube を読み込むので、一覧ページが重くならない。
export function WorkCard({ work }: { work: Work }) {
  const [playing, setPlaying] = useState(false);
  const poster = workPoster(work);
  const play = playLinkEn(work);

  return (
    <article className="corner-ticks flex flex-col border border-ink/25 bg-paper-2 p-1.5 text-ink">
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
              <span className="grid size-14 place-items-center bg-fun-yellow text-ink transition group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="ml-1 size-6" aria-hidden="true">
                  <path d="M6 4l14 8-14 8z" fill="currentColor" />
                </svg>
              </span>
            </span>
          </button>
        ) : poster ? (
          <Poster src={poster} contain={Boolean(work.thumbnail)} />
        ) : (
          <div className="grid size-full place-items-center font-poster text-3xl font-light tracking-widest text-white/40">
            NO IMAGE
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {work.event && <span className="bg-ink px-2 py-0.5 text-[11px] font-bold text-white">{work.event}</span>}
          {work.tags.map((t) => (
            <span key={t} className="border border-ink/30 px-2 py-0.5 font-mono text-[11px] text-muted">
              {t}
            </span>
          ))}
        </div>
        <h3 className="text-lg font-extrabold leading-snug text-ink">{work.title}</h3>
        <p className="text-sm text-muted">{work.authors.join(" / ")}</p>
        <p className="flex-1 text-sm leading-relaxed">{work.body}</p>
        {work.playUrl && (
          <a
            href={work.playUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-3 bg-ink px-4 py-2 font-mono text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-fun-yellow hover:text-ink"
          >
            {play.verb}
            {play.host && <span className="font-normal opacity-70">{play.host}</span>}
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  );
}
