import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono, Raleway } from "next/font/google";
// 日本語フォントは next/font/google だと Cloudflare のビルドで失敗するため、npm パッケージから自前で配信する
import "@fontsource/line-seed-jp/400.css";
import "@fontsource/line-seed-jp/700.css";
import "@fontsource/line-seed-jp/800.css";
import { NowBanner } from "@/components/NowBanner";
import { PosterRails } from "@/components/Poster";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSchedule } from "@/lib/content";
import { motionBootScript } from "@/lib/motion";
import { site } from "@/lib/site";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// ポスター風の大きな英字(細めの幾何学的なサンセリフ)
const raleway = Raleway({
  variable: "--font-raleway",
  weight: ["300", "400", "500"],
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
    // head のスクリプトが html に data-motion を足すので、その差は hydration で警告しない
    <html
      lang="ja"
      className={`${chakraPetch.variable} ${jetbrainsMono.variable} ${raleway.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* スクロールで出てくる要素を、最初の描画の前に隠しておく(src/lib/motion.ts) */}
        <script dangerouslySetInnerHTML={{ __html: motionBootScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader>
          <NowBanner events={upcoming} />
        </SiteHeader>
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <PosterRails />
        <RevealOnScroll />
      </body>
    </html>
  );
}
