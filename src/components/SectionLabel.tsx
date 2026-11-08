import { navItems } from "@/lib/site";
import { Annot, ArrowLine, coordinates, DotGrid, PosterPhoto, Tri, type PhotoName } from "./Poster";

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

// ページごとに、建物のレンダー画像のどこを見せるかを変える
const headingPhoto: Record<string, { name: PhotoName; position: string }> = {
  ABOUT: { name: "detail", position: "35% 40%" },
  COURSE: { name: "detail2", position: "55% 30%" },
  WORKS: { name: "detail", position: "85% 70%" },
  MEMBERS: { name: "detail2", position: "15% 70%" },
  NEWS: { name: "detail", position: "60% 15%" },
  JOIN: { name: "detail2", position: "85% 45%" },
};

/** 各ページの一番上の見出し。細い英字を大きく置き、右側に建物の写真をのぞかせる */
export function PageHeading({ en, lead }: { en: string; lead?: React.ReactNode }) {
  const nav = navItems.findIndex((n) => n.en === en);
  const no = String(nav >= 0 ? nav + 1 : 0).padStart(2, "0");
  const total = String(navItems.length).padStart(2, "0");
  const word = en.charAt(0) + en.slice(1).toLowerCase();
  const photo = headingPhoto[en] ?? headingPhoto.ABOUT;
  return (
    <header className="relative mb-14 border-b border-ink pb-10">
      {/* PC: 右側に写真を敷き、細い線と三角を重ねる */}
      <div className="pointer-events-none absolute -top-2 bottom-0 right-0 hidden w-[46%] md:block" aria-hidden="true">
        <PosterPhoto name={photo.name} position={photo.position} sizes="46vw" eager className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-paper to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper to-transparent" />
        <div className="absolute right-10 top-10 flex flex-col items-end gap-4 text-ink">
          <Tri className="size-14" filled={false} />
          <DotGrid cols={7} rows={4} className="text-ink/70" />
        </div>
        <span className="absolute bottom-8 right-0 font-mono text-[11px] tracking-[0.3em] text-ink [writing-mode:vertical-rl]">
          {en} / {coordinates}
        </span>
      </div>

      <div className="relative mb-6 flex items-center justify-between gap-4 text-muted">
        <Annot>
          No[{no}] — FUNGC / {en}
        </Annot>
      </div>
      <h1 className="relative -ml-1 font-poster text-[clamp(3.75rem,14vw,10rem)] font-light leading-[0.85] tracking-tight text-ink">
        {word}
      </h1>
      <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden="true">
        <span className="tag-yellow px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em]">
          No.{no} / {total}
        </span>
        <ArrowLine length="3rem" />
        <Annot className="text-muted">/{en.toLowerCase()}/</Annot>
      </div>
      {lead && <p className="relative mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{lead}</p>}

      {/* スマホ: 見出しの下に写真の帯を入れる */}
      <div className="relative mt-8 h-36 overflow-hidden md:hidden" aria-hidden="true">
        <PosterPhoto name={photo.name} position={photo.position} sizes="100vw" eager className="size-full object-cover" />
        <Annot className="tag-yellow absolute bottom-2 left-2 px-1">FIG.{no}</Annot>
      </div>
      <span className="absolute -bottom-px right-0 h-1 w-24 bg-fun-yellow" aria-hidden="true" />
    </header>
  );
}
