// ポスター風デザインの部品。建築ポスターのように、建物の写真(3D のレンダー)に、等幅の注記・細い線・図形を重ねて使う。
// 飾りはどれも読み上げから外す(aria-hidden)。
import type { CSSProperties, ReactNode } from "react";

/**
 * 建物「THE STACK」の切り抜き写真(public/poster/、tools/poster-render/ で生成)。空は透明なので、下の地の色がそのまま空になる。
 * stack-* は同じカメラで撮った昼・夜と、手前の箱だけを抜き出した front(文字を箱の後ろに通すために上から重ねる)。
 * *-m は同じ写真の右側を縦長に切り出したもので、狭い画面で使う。
 * zoom-* は各ページの箱に寄ったカット。
 */
const photos = {
  "stack-day": [1600, 2400],
  "stack-front": [1600, 2400],
  "stack-night": [1600, 2400],
  "stack-day-m": [750, 1104],
  "stack-front-m": [750, 1104],
  "stack-night-m": [750, 1104],
  "zoom-about": [800, 1600],
  "zoom-course": [800, 1600],
  "zoom-works": [800, 1600],
  "zoom-members": [800, 1600],
  "zoom-news": [800, 1600],
  "zoom-join": [800, 1600],
} as const;
export type PhotoName = keyof typeof photos;

const srcSet = (name: PhotoName) => photos[name].map((w) => `/poster/${name}-${w}.webp ${w}w`).join(", ");

/* eslint-disable @next/next/no-img-element -- 静的書き出しなので、幅違いの WebP を srcSet で出し分ける */
/**
 * narrow を渡すと、狭い画面(lg 未満)ではそちらの写真を使う。どちらか片方しか読み込まれないよう <picture> で出し分ける。
 * 置き方(位置と大きさ)は className の側で、画面の幅ごとに決める
 */
export function StackPhoto({
  name,
  narrow,
  sizes,
  narrowSizes = "100vw",
  className = "",
  eager = false,
  style,
}: {
  name: PhotoName;
  narrow?: PhotoName;
  sizes: string;
  narrowSizes?: string;
  className?: string;
  eager?: boolean;
  style?: CSSProperties;
}) {
  const shown = narrow ?? name;
  const widths = photos[shown];
  const img = (
    <img
      src={`/poster/${shown}-${widths[widths.length - 1]}.webp`}
      srcSet={srcSet(shown)}
      sizes={narrow ? narrowSizes : sizes}
      alt=""
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      draggable={false}
      className={className}
      style={style}
    />
  );
  if (!narrow) return img;
  return (
    <picture>
      <source media="(min-width: 64rem)" srcSet={srcSet(name)} sizes={sizes} />
      {img}
    </picture>
  );
}

/**
 * 霧の向こうの函館山。大学から函館湾ごしに見える、山頂に電波塔の並ぶ低い山の影。
 * night を付けると夜の姿になり、ふもとの水ぎわに街の明かりが並ぶ
 */
export function FarShore({ className = "", style, night = false }: { className?: string; style?: CSSProperties; night?: boolean }) {
  const name = night ? "hakodate-night" : "hakodate";
  return (
    <img
      src={`/poster/${name}-1600.webp`}
      srcSet={`/poster/${name}-900.webp 900w, /poster/${name}-1600.webp 1600w`}
      sizes="(min-width: 1024px) 62vw, 150vw"
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      style={style}
    />
  );
}
/* eslint-enable @next/next/no-img-element */

/** 公立はこだて未来大学のおおよその位置 */
export const coordinates = `41°50'30"N 140°46'01"E`;
/** "FUNGC" を ASCII コードで書いたもの。注記の飾りに使う */
export const hexName = "0x46 0x55 0x4E 0x47 0x43";

/** 等幅の小さな注記 */
export function Annot({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className={`font-mono text-[10px] leading-tight tracking-wide sm:text-[11px] ${className}`} style={style}>
      {children}
    </span>
  );
}

/** 三角形。filled を外すと線だけになる */
export function Tri({ className = "size-6", filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon points="12,2 22,21 2,21" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1} strokeLinejoin="miter" />
    </svg>
  );
}

/** 細い線の矢印。length は CSS の長さ */
export function ArrowLine({ className = "", length = "3rem" }: { className?: string; length?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-block h-px shrink-0 bg-current align-middle ${className}`} style={{ width: length }}>
      <span className="absolute -right-px -top-[3px] size-[7px] rotate-45 border-r border-t border-current" />
    </span>
  );
}

/** 点の格子 */
export function DotGrid({ cols = 6, rows = 4, gap = 8, className = "" }: { cols?: number; rows?: number; gap?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${cols * gap} ${rows * gap}`} className={className} aria-hidden="true" style={{ width: cols * gap, height: rows * gap }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <circle key={i} cx={(i % cols) * gap + gap / 2} cy={Math.floor(i / cols) * gap + gap / 2} r={1.25} fill="currentColor" />
      ))}
    </svg>
  );
}

/** 「//////」の並び */
export function Slashes({ count = 6, className = "" }: { count?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex gap-[7px] ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="block h-5 w-[2.5px] -skew-x-[30deg] bg-current" />
      ))}
    </span>
  );
}

/** 「>>>」を縦に積んだ山形の印 */
export function Chevrons({ count = 3, className = "w-5" }: { count?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 20 ${count * 9 + 6}`} className={className} aria-hidden="true" fill="currentColor">
      {Array.from({ length: count }, (_, i) => (
        <polygon key={i} points={`0,${i * 9} 10,${i * 9 + 7} 20,${i * 9} 20,${i * 9 + 5} 10,${i * 9 + 12} 0,${i * 9 + 5}`} />
      ))}
    </svg>
  );
}

/** 丸と、半円 2 つの並び(●◗◗) */
export function CircleRow({ className = "h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 12" className={className} aria-hidden="true" fill="currentColor">
      <circle cx="6" cy="6" r="6" />
      <path d="M17 0a6 6 0 0 1 0 12z" />
      <path d="M30 0a6 6 0 0 1 0 12z" />
    </svg>
  );
}

/** 太い輪の中に黄色い丸。見出しの頭や、位置の印に使う */
export function Eye({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="6" />
      <circle cx="18" cy="18" r="5" fill="var(--color-fun-yellow)" />
    </svg>
  );
}

/** 十字の目印 */
export function Crosshair({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M8 0v16M0 8h16" stroke="currentColor" strokeWidth={1} />
      <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
  );
}

/** 上向きと下向きの三角を重ねた線の印。真ん中に点を打つ */
export function CrossTriangles({ className = "w-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 112" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
      <polygon points="60,4 116,108 4,108" />
      <polygon points="4,4 116,4 60,108" />
      <circle cx="60" cy="56" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * 円に沿って並べた文字。span は使う弧の角度で、文字はその中に均等に広がる。
 * 文字の大きさは viewBox(200 × 200)の中での大きさなので、箱の幅に合わせて一緒に伸び縮みする
 */
export function ArcText({
  text,
  className = "",
  start = -160,
  span = 140,
  size = 11,
  style,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  /** 書き始めの角度(真上が -90、時計回り) */
  start?: number;
  span?: number;
  size?: number;
}) {
  const id = `arc-${text.replace(/[^a-z0-9]/gi, "").slice(0, 16)}-${Math.round(start)}`;
  const r = 90;
  const point = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(100 + r * Math.cos(a)).toFixed(2)},${(100 + r * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <path id={id} d={`M ${point(start)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${point(start + span)}`} />
      </defs>
      <text fill="currentColor" fontSize={size} fontWeight={700} letterSpacing="0.04em" style={{ fontFamily: "var(--font-poster)" }}>
        <textPath href={`#${id}`} textLength={((span * Math.PI) / 180) * r} lengthAdjust="spacing">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
