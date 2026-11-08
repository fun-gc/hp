import { navItems } from "@/lib/site";
import { Annot, coordinates, CubeStack, DotGrid, Tri } from "./Poster";

// 見出しの上に置く英字ラベル。ポスター風に「▲ [番号] 英字 ———」の形で、細い線を右へ伸ばす。
export function SectionLabel({
  children,
  index,
  invert = false,
}: {
  children: React.ReactNode;
  index?: number;
  invert?: boolean;
}) {
  const tone = invert ? "text-white/70" : "text-muted";
  return (
    <div className={`flex items-center gap-3 ${tone}`}>
      <Tri className={`size-3 ${invert ? "text-fun-yellow" : "text-ink"}`} />
      {index !== undefined && <span className="font-mono text-[11px]">[{String(index).padStart(2, "0")}]</span>}
      <span className="font-mono text-xs font-medium uppercase tracking-[0.25em]">{children}</span>
      <span className="h-px min-w-8 flex-1 bg-current opacity-50" aria-hidden="true" />
    </div>
  );
}

/** 各ページの一番上の見出し。英字を大きく敷き、日本語の見出しを重ねる */
export function PageHeading({ title, lead, en }: { title: string; lead?: React.ReactNode; en?: string }) {
  const nav = navItems.findIndex((n) => n.en === en);
  const no = String(nav >= 0 ? nav + 1 : 0).padStart(2, "0");
  return (
    <header className="relative mb-14 border-b border-ink pb-10">
      {/* 右側にグレーの立方体の塊をのぞかせ、細い線と三角を重ねる */}
      <div className="pointer-events-none absolute -top-2 bottom-0 right-0 hidden w-[44%] md:block" aria-hidden="true">
        <CubeStack size={8} className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper to-transparent" />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-paper to-transparent" />
        <div className="absolute right-10 top-10 flex flex-col items-end gap-4 text-ink">
          <Tri className="size-14" filled={false} />
          <DotGrid cols={7} rows={4} className="text-ink/70" />
        </div>
        {en && (
          <span className="absolute bottom-8 right-0 font-mono text-[11px] tracking-[0.3em] text-ink [writing-mode:vertical-rl]">
            {en} / {coordinates}
          </span>
        )}
      </div>
      <div className="relative mb-6 flex items-center justify-between gap-4 text-muted">
        <Annot>No[{no}] — FUNGC / {en ?? "PAGE"}</Annot>
      </div>
      {en && (
        <p
          aria-hidden="true"
          className="relative -ml-1 font-poster text-[clamp(3.5rem,13vw,10rem)] font-light capitalize leading-[0.85] tracking-tight text-ink/85"
        >
          {en.toLowerCase()}
        </p>
      )}
      <div className="relative mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
        <h1 className="tag-yellow inline-block px-3 py-1 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <Annot className="pb-1 text-muted">
          ↳ {en ? `/${en.toLowerCase()}/` : ""} [0–{no}]
        </Annot>
      </div>
      {lead && <p className="relative mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{lead}</p>}
      <span className="absolute -bottom-px right-0 h-1 w-24 bg-fun-yellow" aria-hidden="true" />
    </header>
  );
}
