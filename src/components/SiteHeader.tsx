"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { delay } from "@/lib/motion";
import { navItems } from "@/lib/site";
import { LogoMark } from "./Logo";

/** children はヘッダーのすぐ下に出す帯(開催中の予定など) */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    // 背景は少し透かして、後ろをぼかす。開いたメニューも同じ背景の中に出すので、透け具合がそろう
    <header className="sticky top-0 z-40 border-b border-ink bg-paper/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <LogoMark className="size-8" />
          <span className="font-display text-lg font-bold tracking-wider">FUNGC</span>
          <span className="hidden font-mono text-[10px] leading-tight text-muted lg:block" aria-hidden="true">
            No[00]
            <br />
            GAME CREATORS
          </span>
        </Link>

        <nav className="hidden md:block" aria-label="メインメニュー">
          <ul className="flex items-stretch">
            {navItems.map((item, i) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href} className="border-l border-ink/20 first:border-l-0">
                  <Link
                    href={item.href}
                    className={`flex flex-col px-3 py-1 leading-tight transition-colors lg:px-4 ${
                      active ? "bg-fun-yellow text-ink" : "text-ink hover:bg-ink hover:text-paper"
                    }`}
                  >
                    <span className="font-mono text-[9px] tracking-[0.2em] opacity-60" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-sm font-bold tracking-[0.12em]">{item.en}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="grid size-10 place-items-center md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "メニューを閉じる" : "メニューを開く"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-4 w-6">
            <span className={`absolute left-0 h-0.5 w-6 bg-ink transition ${open ? "top-2 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-2 h-0.5 w-6 bg-ink transition ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 h-0.5 w-6 bg-ink transition ${open ? "top-2 -rotate-45" : "top-4"}`} />
          </span>
        </button>
      </div>

      {children}

      {open && (
        <nav id="mobile-menu" className="anim-menu border-t border-ink md:hidden" aria-label="メインメニュー">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {navItems.map((item, i) => (
              <li key={item.href} className="anim-menu" style={delay(0.04 * (i + 1))}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between border-b border-ink/20 py-3 last:border-0"
                >
                  <span className="font-poster text-3xl font-light capitalize">{item.en.toLowerCase()}</span>
                  <span className="font-mono text-xs tracking-[0.18em] text-muted">{String(i + 1).padStart(2, "0")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ページをどこまで読んだかを、下端の黄色い線で出す(スクロールに連動する CSS。対応ブラウザのみ) */}
      <span aria-hidden="true" className="scroll-progress pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-fun-yellow" />
    </header>
  );
}
