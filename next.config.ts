import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Cloudflare などの静的ホスティングに置くため、HTML を書き出す static export にしている。
// サーバーが必要な機能(API ルート、Server Actions など)はこの設定では使えない。
// Discord の /profile コマンドの受け口は、Cloudflare Pages Functions(functions/)として同じプロジェクトで動かす(docs/discord-bot.md)。
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

export default async function config(phase: string): Promise<NextConfig> {
  // ビルドの最初に Discord のメンバー募集チャンネルを読み、content/discord-events.json を作る。
  // 設定ファイルはビルド中に何度か読み込まれるので、環境変数で 1 回だけにする。
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.FUNGC_DISCORD_SYNCED) {
    process.env.FUNGC_DISCORD_SYNCED = "1";
    const { syncDiscordEvents } = await import("./bot/calendar/sync.mjs");
    await syncDiscordEvents();
  }
  return nextConfig;
}
