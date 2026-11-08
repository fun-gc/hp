import Link from "next/link";
import { Cube } from "@/components/Cube";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <Cube color="red" className="size-16" />
      <p className="font-poster text-8xl font-light text-ink">404</p>
      <h1 className="font-mono text-sm tracking-[0.25em] text-muted">PAGE NOT FOUND_</h1>
      <Link href="/" className="bg-ink px-5 py-3 font-bold text-white hover:bg-fun-yellow hover:text-ink">
        BACK TO TOP
      </Link>
    </div>
  );
}
