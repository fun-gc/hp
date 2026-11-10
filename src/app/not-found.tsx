import Link from "next/link";
import { Annot, ArrowLine, Crosshair } from "@/components/Poster";

export default function NotFound() {
  return (
    <div className="wrap flex flex-col items-start gap-6 py-28">
      <div className="flex items-center gap-3 text-ink" aria-hidden="true">
        <Crosshair className="size-4" />
        <Annot>
          <span className="hl px-1">H00</span> THIS MODULE DOES NOT EXIST
        </Annot>
      </div>
      <p className="poster-word text-[clamp(7rem,26vw,18rem)] text-ink">404</p>
      <h1 className="font-mono text-sm tracking-[0.25em] text-muted">PAGE NOT FOUND_</h1>
      <Link
        href="/"
        className="flex items-center gap-3 bg-ink px-6 py-3 font-mono text-sm font-medium tracking-[0.18em] text-white transition-colors hover:bg-fun-yellow hover:text-ink"
      >
        BACK TO TOP
        <ArrowLine length="1.5rem" />
      </Link>
    </div>
  );
}
