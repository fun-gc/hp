"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { delay } from "@/lib/motion";
import { navItems, site } from "@/lib/site";
import { LogoMark } from "./Logo";

/** children はヘッダーのすぐ下に出す帯(開催中の予定など) */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    // 背景は透かして後ろをぼかす。トップページでは、ヒーローの建物がこの下まで続いて見える
    <header className="sticky top-0 z-40 border-b border-ink/70 bg-paper/70 backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="logo-spin flex items-center gap-3" onClick={() => setOpen(false)}>
          <LogoMark className="size-8" />
          <span className="font-poster text-xl font-semibold tracking-[0.14em]">{site.name}</span>
          <span className="hidden border-l border-ink/40 pl-3 font-mono text-[10px] leading-tight tracking-wider text-muted xl:block" aria-hidden="true">
            {site.fullName.toUpperCase()}
            <br />
            EST. HAKODATE
          </span>
        </Link>

        <nav className="hidden lg:block" aria-label="メインメニュー">
          <ul className="flex items-center gap-1">
            {navItems.map((item, i) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  {/* data-nav: トップのヒーローで、同じ名前の箱が黄色く光る(globals.css の .mod-hit) */}
                  <Link
                    href={item.href}
                    data-nav={item.en}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-baseline gap-1.5 px-3 py-2 font-mono text-[13px] font-medium tracking-[0.14em] transition-colors ${
                      active ? "hl" : "hover:bg-ink hover:text-paper"
                    }`}
                  >
                    <span className="text-[9px] opacity-60" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.en}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="flex items-center gap-3 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "メニューを閉じる" : "メニューを開く"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="font-mono text-[11px] font-medium tracking-[0.2em]" aria-hidden="true">
            {open ? "CLOSE" : "MENU"}
          </span>
          <span className="relative block h-3 w-6" aria-hidden="true">
            <span className={`absolute left-0 h-px w-6 bg-ink transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-px w-6 bg-ink transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </div>

      {children}

      {open && (
        <nav id="mobile-menu" className="border-t border-ink/70 lg:hidden" aria-label="メインメニュー">
          <ul className="wrap pb-4 pt-1">
            {navItems.map((item, i) => {
              const active = pathname.startsWith(item.href);
              return (
                // 開くと、上から順に 1 行ずつ出る
                <li key={item.href} className="a-rise [animation-duration:0.5s]" style={delay(i * 45)}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex items-baseline justify-between border-b border-ink/20 py-2.5"
                  >
                    <span className={`poster-word px-1 text-4xl capitalize ${active ? "marker" : ""}`}>{item.en.toLowerCase()}</span>
                    <span className="font-mono text-xs tracking-[0.18em] text-muted" aria-hidden="true">
                      No[{String(i + 1).padStart(2, "0")}]
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
