// テンプレートの見出し上にある「赤・緑・黄の 3 本線 + 英字ラベル」
export function SectionLabel({ children, invert = false }: { children: React.ReactNode; invert?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-1.5 w-7 bg-fun-red" />
        <span className="h-1.5 w-7 bg-fun-green" />
        <span className="h-1.5 w-7 bg-fun-yellow" />
      </span>
      <span
        className={`font-display text-xs font-semibold tracking-[0.18em] ${invert ? "text-white/70" : "text-muted"}`}
      >
        {children}
      </span>
    </div>
  );
}

export function PageHeading({ label, title, lead }: { label: string; title: string; lead?: React.ReactNode }) {
  return (
    <header className="mb-10 space-y-4">
      <SectionLabel>{label}</SectionLabel>
      <h1 className="text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
      {lead && <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{lead}</p>}
    </header>
  );
}

export function PointBand({ label = "POINT", children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-ink px-6 py-5 text-white sm:flex-row sm:items-center sm:gap-6">
      <span className="font-display text-sm font-bold tracking-[0.2em] text-fun-yellow">{label}</span>
      <p className="font-bold leading-relaxed">{children}</p>
    </div>
  );
}
