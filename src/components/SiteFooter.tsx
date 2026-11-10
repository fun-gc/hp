import Link from "next/link";
import { navItems, site } from "@/lib/site";
import { moduleOf } from "./Heading";
import { LogoMark } from "./Logo";
import { Annot, coordinates, hexName, Slashes, Tri } from "./Poster";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/15 bg-ink text-white">
      {/* 下端で切れる大きな英字。ポスターの裁ち落としのように、画面からはみ出させる */}
      <p
        aria-hidden="true"
        className="poster-word pointer-events-none absolute -bottom-[0.2em] right-[-0.03em] select-none whitespace-nowrap text-[clamp(6rem,23vw,21rem)] text-white/[0.07]"
      >
        Creators.
      </p>

      <div className="wrap relative grid gap-12 py-14 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <LogoMark className="size-9" />
            <span className="font-poster text-2xl font-semibold tracking-[0.14em]">{site.name}</span>
          </div>
          <p className="font-mono text-xs leading-relaxed tracking-wider text-white/70">
            {site.fullName.toUpperCase()}
            <br />
            {site.universityEn.toUpperCase()}
          </p>
          <p className="font-mono text-xs tracking-wider text-white/70">
            CONTACT:{" "}
            <a href={`mailto:${site.email}`} className="underline underline-offset-4 hover:bg-fun-yellow hover:text-ink">
              {site.email}
            </a>
          </p>
          <div className="flex items-center gap-4 pt-3 text-fun-yellow" aria-hidden="true">
            <Tri className="size-4" />
            <Slashes count={5} />
            <Annot className="text-white/50">
              {coordinates}
              <br />
              {hexName}
            </Annot>
          </div>
        </div>

        {/* メニュー。建物の箱の番号を添える */}
        <nav aria-label="フッターメニュー">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 sm:grid-cols-3">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="group flex items-baseline gap-2.5 font-mono text-sm tracking-[0.16em] text-white/85 hover:text-white">
                  <span className="text-[10px] text-white/40 transition-colors group-hover:bg-fun-yellow group-hover:text-ink" aria-hidden="true">
                    {moduleOf[item.en].code}
                  </span>
                  {item.en}
                </Link>
              </li>
            ))}
            <li>
              <a href={site.social.x} className="group flex items-baseline gap-2.5 font-mono text-sm tracking-[0.16em] text-white/85 hover:text-white" target="_blank" rel="noreferrer">
                <span className="w-[1.85em] text-center text-[10px] text-white/40" aria-hidden="true">
                  ↗
                </span>
                X
              </a>
            </li>
            <li>
              <a
                href={site.social.github}
                className="group flex items-baseline gap-2.5 font-mono text-sm tracking-[0.16em] text-white/85 hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                <span className="w-[1.85em] text-center text-[10px] text-white/40" aria-hidden="true">
                  ↗
                </span>
                GITHUB
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="relative border-t border-white/15">
        <p className="wrap flex justify-between py-4 font-mono text-[11px] tracking-[0.15em] text-white/50">
          <span>© {new Date().getFullYear()} FUNGC</span>
          <span aria-hidden="true" className="italic">
            end of page_
          </span>
        </p>
      </div>
    </footer>
  );
}
