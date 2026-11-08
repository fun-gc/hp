"use client";

import { useEffect } from "react";

/**
 * data-reveal を付けた要素を、画面に入ったときに下からふわっと出す(見た目は globals.css)。
 * 隠すのは html に data-motion が付いているあいだだけで、付けるのは layout の head にあるスクリプト(motionBootScript)。
 * ページを移動して新しく入ってきた要素も、MutationObserver で拾う。
 */
export function RevealOnScroll() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-motion")) return;
    root.setAttribute("data-motion", "on");

    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
          .forEach((el, i) => {
            // 同時に入ってきたものは、文書の順に少しずつ遅らせて出す
            el.style.setProperty("--rd", `${Math.min(i, 5) * 90}ms`);
            el.setAttribute("data-shown", "");
            io.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -6% 0px" },
    );

    const watched = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
