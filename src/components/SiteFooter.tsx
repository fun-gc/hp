import Link from "next/link";
import { navItems, site } from "@/lib/site";
import { LogoMark } from "./Logo";
import { Annot, coordinates, Slashes, Tri } from "./Poster";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-white">
      {/* 大きく切れた英字。ポスターの下端のように画面からはみ出させる */}
      <p
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[0.18em] -right-[0.04em] select-none font-poster text-[clamp(6rem,24vw,20rem)] font-light leading-none tracking-tight text-white/[0.06]"
      >
        FUNGC
      </p>
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-bold tracking-wider">FUNGC</span>
          </div>
          <p className="font-mono text-xs tracking-wider text-white/70">GAME CREATION CIRCLE — {site.universityEn.toUpperCase()}</p>
          <p className="font-mono text-xs tracking-wider text-white/70">
            CONTACT:{" "}
            <a href={`mailto:${site.email}`} className="underline underline-offset-4 hover:bg-fun-yellow hover:text-ink">
              {site.email}
            </a>
          </p>
          <div className="flex items-center gap-4 pt-4 text-fun-yellow">
            <Tri className="size-4" />
            <Slashes count={5} />
            <Annot className="text-white/50">{coordinates}</Annot>
          </div>
        </div>
        <nav aria-label="フッターメニュー">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2 font-display text-sm tracking-[0.12em] sm:grid-cols-3">
            {navItems.map((item, i) => (
              <li key={item.href}>
                <Link href={item.href} className="group flex items-baseline gap-2 text-white/80 hover:text-white">
                  <span className="font-mono text-[10px] text-white/40 group-hover:text-fun-yellow" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.en}
                </Link>
              </li>
            ))}
            <li>
              <a href={site.social.x} className="group flex items-baseline gap-2 text-white/80 hover:text-white" target="_blank" rel="noreferrer">
                <span className="font-mono text-[10px] text-white/40 group-hover:text-fun-yellow" aria-hidden="true">↗</span>X
              </a>
            </li>
            <li>
              <a href={site.social.github} className="group flex items-baseline gap-2 text-white/80 hover:text-white" target="_blank" rel="noreferrer">
                <span className="font-mono text-[10px] text-white/40 group-hover:text-fun-yellow" aria-hidden="true">↗</span>GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="relative border-t border-white/15">
        <p className="mx-auto flex max-w-6xl justify-between px-4 py-4 font-mono text-[11px] tracking-[0.15em] text-white/50 sm:px-6">
          <span>© {new Date().getFullYear()} FUNGC</span>
          <span aria-hidden="true" className="italic">end of page_</span>
        </p>
      </div>
    </footer>
  );
}
