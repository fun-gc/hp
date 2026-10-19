import Link from "next/link";
import { navItems, site } from "@/lib/site";
import { LogoMark } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-bold tracking-wider">FUNGC</span>
          </div>
          <p className="text-sm text-white/70">{site.university} ゲーム制作サークル</p>
          <p className="text-sm text-white/70">
            お問い合わせ:{" "}
            <a href={`mailto:${site.email}`} className="underline underline-offset-4 hover:text-fun-yellow">
              {site.email}
            </a>
          </p>
        </div>
        <nav aria-label="フッターメニュー">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/80 hover:text-fun-yellow">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={site.social.x} className="text-white/80 hover:text-fun-yellow" target="_blank" rel="noreferrer">
                X
              </a>
            </li>
            <li>
              <a href={site.social.github} className="text-white/80 hover:text-fun-yellow" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 font-display text-xs tracking-[0.15em] text-white/50 sm:px-6">
          © {new Date().getFullYear()} FUNGC
        </p>
      </div>
    </footer>
  );
}
