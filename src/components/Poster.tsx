// ポスター風デザインの飾り。どれも装飾なので、読み上げからは外す(aria-hidden)。
// 建築ポスターのように、建物の写真(3D のレンダー)に、細い線・三角・等幅の注記を重ねて使う。

/** 3D でつくった立方体の建物のレンダー画像(public/poster/、tools/poster-render/ で生成)。幅ごとに書き出してある */
const photoWidths = {
  hero: [800, 1200, 1800],
  night: [960, 1440, 1920],
  detail: [800, 1200, 1600],
  detail2: [800, 1200, 1600],
} as const;
export type PhotoName = keyof typeof photoWidths;

/* eslint-disable @next/next/no-img-element -- 静的書き出しなので、幅違いの WebP を srcSet で出し分ける */
export function PosterPhoto({
  name,
  sizes,
  className = "",
  position,
  eager = false,
}: {
  name: PhotoName;
  sizes: string;
  className?: string;
  position?: string;
  eager?: boolean;
}) {
  const widths = photoWidths[name];
  return (
    <img
      src={`/poster/${name}-${widths[widths.length - 1]}.webp`}
      srcSet={widths.map((w) => `/poster/${name}-${w}.webp ${w}w`).join(", ")}
      sizes={sizes}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}
/* eslint-enable @next/next/no-img-element */

/**
 * 夜の建物の写真と、文字を読みやすくする墨色のグラデーション。親の箱は relative overflow-hidden bg-ink にし、
 * 中身は relative z-10 で上に重ねる。トップの「Join us」と入部ページの「Contact」で使う
 */
export function NightBackdrop() {
  return (
    <>
      {/* パネルの穴から黄色い明かりがもれる夜の建物。スクロールに合わせて少しずらす */}
      <PosterPhoto
        name="night"
        sizes="(min-width: 1152px) 1152px, 100vw"
        className="parallax-y absolute inset-0 size-full object-cover object-right"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/0" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent sm:hidden" aria-hidden="true" />
    </>
  );
}

/** 公立はこだて未来大学のおおよその位置。注記の飾りとして使う */
export const coordinates = `41°50'30"N 140°46'01"E`;

/** 等幅の小さな注記 */
export function Annot({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={`font-mono text-[10px] leading-tight tracking-wide sm:text-[11px] ${className}`}>
      {children}
    </span>
  );
}

/** 三角形。fill を外すと線だけになる */
export function Tri({ className = "size-6", filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon
        points="12,2 22,21 2,21"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.2}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/** 細い線の矢印。length は CSS の長さ。grow を付けると、親(group)にカーソルを乗せたときに伸びる */
export function ArrowLine({ className = "", length = "6rem", grow = false }: { className?: string; length?: string; grow?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block h-px w-(--len) bg-current align-middle ${
        grow ? "transition-[width] duration-300 ease-out group-hover:w-[calc(var(--len)*1.7)] motion-reduce:transition-none" : ""
      } ${className}`}
      style={{ "--len": length } as React.CSSProperties}
    >
      <span className="absolute -right-px -top-[3px] size-[7px] rotate-45 border-r border-t border-current" />
    </span>
  );
}

/** 数字を、スロットのように 0 から回して止める(globals.css の roll-*)。読み上げには数字そのものを渡す */
export function RollNumber({ value, delay = 0 }: { value: string; delay?: number }) {
  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex">
        {value.split("").map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className="roll-digit">
              <span className="roll-strip" style={{ "--n": Number(ch), "--d": `${delay + i * 0.12}s` } as React.CSSProperties}>
                {"0123456789".split("").map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </span>
    </>
  );
}

/** 点の格子 */
export function DotGrid({ cols = 6, rows = 4, className = "" }: { cols?: number; rows?: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${cols * 8} ${rows * 8}`} className={className} aria-hidden="true" style={{ width: cols * 8, height: rows * 8 }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <circle key={i} cx={(i % cols) * 8 + 2} cy={Math.floor(i / cols) * 8 + 2} r={1.3} fill="currentColor" />
      ))}
    </svg>
  );
}

/** 「//////」の並び */
export function Slashes({ count = 6, className = "" }: { count?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex gap-2 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="block h-5 w-[3px] skew-x-[-28deg] bg-current" />
      ))}
    </span>
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

/** 画面の左右の端に縦書きで流す注記。広い画面だけに出す */
export function PosterRails() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 left-0 right-0 z-30 hidden 2xl:block">
      <p className="absolute left-4 top-1/2 origin-left -translate-y-1/2 font-mono text-[10px] tracking-[0.3em] text-muted [writing-mode:vertical-rl]">
        FUNGC // FUTURE UNIVERSITY HAKODATE // GAME CIRCLE // {coordinates}
      </p>
      <p className="absolute right-4 top-1/2 -translate-y-1/2 rotate-180 font-mono text-[10px] tracking-[0.3em] text-muted [writing-mode:vertical-rl]">
        FUGU → FUNGC // UNITY // MIRAIVE // MIRAI-SAI // DISCORD
      </p>
    </div>
  );
}
