import type { Metadata } from "next";
import { IBM_Plex_Mono, Raleway } from "next/font/google";
// 日本語フォントは next/font/google だと Cloudflare のビルドで失敗するため、npm パッケージから自前で配信する
import "@fontsource/line-seed-jp/400.css";
import "@fontsource/line-seed-jp/700.css";
import "@fontsource/line-seed-jp/800.css";
import { NowBanner } from "@/components/NowBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSchedule } from "@/lib/content";
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
  const buildDate = new Date().toISOString().slice(0, 10);
  const upcoming = getSchedule().filter((e) => e.date >= buildDate);

  return (
    <html lang="ja" className={`${raleway.variable} ${plexMono.variable} h-full antialiased`}>
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
