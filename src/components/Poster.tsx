import { useId } from "react";

// ポスター風デザインの飾り。どれも装飾なので、読み上げからは外す(aria-hidden)。
// 建築ポスターのように、グレーの立方体の集まりに、細い線・三角・等幅の注記を重ねて使う。

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

/** 細い線の矢印。length は CSS の長さ */
export function ArrowLine({ className = "", length = "6rem" }: { className?: string; length?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-block h-px bg-current align-middle ${className}`} style={{ width: length }}>
      <span className="absolute -right-px -top-[3px] size-[7px] rotate-45 border-r border-t border-current" />
    </span>
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

// ---- グレーの立方体の集まり(写真の建物の代わり) ----

type Voxel = { x: number; y: number; z: number };

/** 決まった並びの疑似乱数。ビルドのたびに形が変わらないようにする */
function noise(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 斜めの稜線に沿って段々に積み上がる塊 */
function buildVoxels(size: number): Voxel[] {
  const voxels: Voxel[] = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const ridge = size - Math.abs(x - y) * 1.6 - (x + y) * 0.18;
      const h = Math.max(0, Math.round(ridge + noise(x, y) * 3 - 2));
      for (let z = 0; z < h; z++) {
        // ところどころ抜けをつくって、張り出しや窓のように見せる
        if (z > 1 && noise(x * 3 + z, y * 5 - z) > 0.86) continue;
        voxels.push({ x, y, z });
      }
    }
  }
  // 奥から手前へ描く
  return voxels.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.z - b.z);
}

const W = 18; // 菱形の横幅の半分
const H = 10; // 菱形の高さの半分
const Z = 20; // 側面の高さ

export function CubeStack({ size = 11, className = "" }: { size?: number; className?: string }) {
  // 1 ページに複数置いても模様の id がぶつからないようにする
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const voxels = buildVoxels(size);
  const pts = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const centers = voxels.map((v) => ({ cx: (v.x - v.y) * W, cy: (v.x + v.y) * H - v.z * Z }));
  const minX = Math.min(...centers.map((c) => c.cx - W));
  const maxX = Math.max(...centers.map((c) => c.cx + W));
  const minY = Math.min(...centers.map((c) => c.cy - H));
  const maxY = Math.max(...centers.map((c) => c.cy + H + Z));
  const shapes = voxels.map((v, i) => {
    const { cx, cy } = centers[i];
    const top = pts([
      [cx, cy - H],
      [cx + W, cy],
      [cx, cy + H],
      [cx - W, cy],
    ]);
    const left = pts([
      [cx - W, cy],
      [cx, cy + H],
      [cx, cy + H + Z],
      [cx - W, cy + Z],
    ]);
    const right = pts([
      [cx, cy + H],
      [cx + W, cy],
      [cx + W, cy + Z],
      [cx, cy + H + Z],
    ]);
    const perforated = noise(v.x + v.z, v.y) > 0.45;
    return (
      <g key={i}>
        <polygon points={top} fill="var(--color-cube-top)" />
        <polygon points={left} fill="var(--color-cube-left)" />
        <polygon points={right} fill="var(--color-cube-right)" />
        {perforated && <polygon points={left} fill={`url(#${id}-l)`} />}
        {perforated && <polygon points={right} fill={`url(#${id}-d)`} />}
      </g>
    );
  });
  const pad = 4;
  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={`${id}-l`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.42" fill="#ffffff" opacity="0.35" />
        </pattern>
        <pattern id={`${id}-d`} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.42" fill="#1c242b" opacity="0.35" />
        </pattern>
      </defs>
      <g stroke="var(--color-cube-edge)" strokeWidth={0.35} strokeLinejoin="round">
        {shapes}
      </g>
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
        FUGU → FUNGC // UNITY // MIRAIVE // 未来祭 // DISCORD
      </p>
    </div>
  );
}
