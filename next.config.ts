import type { NextConfig } from "next";

// Cloudflare などの静的ホスティングに置くため、HTML を書き出す static export にしている。
// サーバーが必要な機能(API ルート、Server Actions など)はこの設定では使えない。
// Discord Bot の受け口などは別の Cloudflare Worker として作る(docs/discord-bot.md)。
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
