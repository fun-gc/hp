import type { Metadata } from "next";
import { IBM_Plex_Mono, Raleway } from "next/font/google";
import localFont from "next/font/local";
// 日本語フォントは next/font/google だと Cloudflare のビルドで失敗するため、npm パッケージから自前で配信する
import "@fontsource/line-seed-jp/400.css";
import "@fontsource/line-seed-jp/700.css";
import "@fontsource/line-seed-jp/800.css";
import { NowBanner } from "@/components/NowBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSchedule } from "@/lib/content";
import { todayInJapan } from "@/lib/date";
import { site } from "@/lib/site";
import "./globals.css";

// 大きく置く細い英字(幾何学的なサンセリフ)。元にしたポスターの「Resolution」「lost in time」に近い書体
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// 等幅の注記。イタリックが筆記体寄りで、ポスターの「confidential」に近い
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

// ヒーローの黄色い FUNGC に重ねる黒い線だけに使う書体(globals.css の .title-letter::after)。
// Raleway の G は形を重ねて作ってあり、そのまま線を引くと棒の中に重なりの線が出るので、
// 太さ 600 に固定して重なりをまとめたもの(F・U・N・G・C だけ。作り方は tools/title-outline-font/make.py)
const titleOutline = localFont({
  src: "./fonts/raleway-600-title-outline.woff2",
  variable: "--font-title-outline",
  weight: "600",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | ${site.university} ゲーム制作サークル`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "ja_JP",
    url: site.url,
  },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // 開催中かどうかは閲覧時に決めるので、ビルドした日より前の予定だけ外して渡す
  const buildDate = todayInJapan();
  const upcoming = getSchedule().filter((e) => e.date >= buildDate);

  return (
    <html lang="ja" data-scroll-behavior="smooth" className={`${raleway.variable} ${plexMono.variable} ${titleOutline.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader>
          <NowBanner events={upcoming} />
        </SiteHeader>
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
