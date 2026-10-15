@AGENTS.md

# FUN GC 公式サイト

- Next.js(App Router)を `output: "export"` で静的書き出しし、Cloudflare Pages に置いている。サーバー機能(API ルート、Server Actions、ISR、リダイレクト)は使わない。
- 文章やデータは `content/` に置き、`src/lib/schema.ts` の zod スキーマで検証する。形を変えるときはスキーマ、`CONTRIBUTING.md`、`docs/discord-bot.md` を一緒に直す。
- `content/members/<DiscordのユーザーID>.json` は Discord Bot が書き込む前提のファイル。手で編集するときも形を崩さない。
- 色とデザインは講座テンプレートに合わせる(`src/app/globals.css` の `@theme`)。黄色は背景や強調にだけ使い、文字色には使わない。
- 文章は日本語、です・ます調。
