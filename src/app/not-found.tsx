import Link from "next/link";
import { Cube } from "@/components/Cube";
import { delay } from "@/lib/motion";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <Cube color="red" className="anim-rise size-16" />
      <p className="-my-[0.15em] overflow-y-clip py-[0.15em] font-poster text-8xl font-light text-ink">
        <span className="anim-word block" style={delay(0.1)}>
          404
        </span>
      </p>
      <h1 className="anim-fade font-mono text-sm tracking-[0.25em] text-muted" style={delay(0.35)}>
        PAGE NOT FOUND
        <span className="blink" aria-hidden="true">
          _
        </span>
      </h1>
      <Link href="/" className="anim-rise bg-ink px-5 py-3 font-bold text-white hover:bg-fun-yellow hover:text-ink" style={delay(0.5)}>
        BACK TO TOP
      </Link>
    </div>
  );
}
