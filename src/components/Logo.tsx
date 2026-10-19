// 講座テンプレートのロゴ(立方体 + FUNGC の文字)を SVG で再現したもの。
// 正式なロゴデータが手に入ったら public/ に置いて差し替える。
type Props = { className?: string; title?: string };

export function CubeFaces({ gap = true }: { gap?: boolean }) {
  return (
    <g stroke={gap ? "var(--color-paper)" : "none"} strokeWidth={gap ? 22 : 0} strokeLinejoin="round">
      <polygon points="610,160 1062,402 610,646 158,402" fill="var(--color-fun-red)" />
      <polygon points="158,402 610,646 610,1140 158,898" fill="var(--color-fun-green)" />
      <polygon points="610,646 1062,402 1062,898 610,1140" fill="var(--color-fun-yellow)" />
    </g>
  );
}

export function LogoLetters() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={36} strokeLinecap="butt" strokeLinejoin="miter">
      {/* F */}
      <polyline points="56,58 102,106 102,592" />
      <polyline points="121,62 318,62 333,82" />
      <line x1="121" y1="255" x2="272" y2="255" />
      {/* U */}
      <polyline points="437,44 437,490 508,575 652,575 724,490 724,44" />
      {/* N */}
      <polyline points="853,592 853,118" />
      <polyline points="835,62 924,62 1082,575 1155,575" />
      <polyline points="1135,44 1135,520" />
      {/* G */}
      <polyline points="530,755 487,712 320,712 270,763 270,1172 320,1225 480,1225 556,1186 556,960 432,960 408,985" />
      {/* C */}
      <polyline points="925,757 880,712 722,712 672,763 672,1172 722,1225 882,1225 955,1190" />
    </g>
  );
}

export function Logo({ className, title = "FUNGC" }: Props) {
  return (
    <svg viewBox="0 0 1210 1280" className={className} role="img" aria-label={title}>
      <CubeFaces />
      <LogoLetters />
    </svg>
  );
}

/** ロゴの立方体だけ。ヘッダーやアイコンに使う。 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="140 150 940 1000" className={className} aria-hidden="true">
      <CubeFaces />
    </svg>
  );
}
