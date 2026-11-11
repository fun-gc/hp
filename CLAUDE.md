@AGENTS.md

# FUNGC 公式サイト

- Next.js(App Router)を `output: "export"` で静的書き出しし、Cloudflare Pages に置いている。サーバー機能(API ルート、Server Actions、ISR、リダイレクト)は使わない。
- 例外は Discord の `/profile` コマンドの受け口だけで、Cloudflare Pages Functions(`functions/api/discord.js` → `bot/members/`)として動かす。
- 文章やデータは `content/` に置き、`src/lib/schema.ts` の zod スキーマで検証する。形を変えるときはスキーマ、`CONTRIBUTING.md`、`docs/discord-bot.md` を一緒に直す。
- `content/members/<DiscordのユーザーID>.json` は Discord Bot が書き込む前提のファイル。手で編集するときも形を崩さない。
- 色とデザインは講座テンプレートに合わせる(`src/app/globals.css` の `@theme`)。
- 文章は日本語、です・ます調。
- FUNGC は FUN Game Creators の略(FUN は公立はこだて未来大学 Future University Hakodate の略称)。英語で GC を言い換えるときは Game Circle や Game Club ではなく Game Creators と書く。正式名称は `src/lib/site.ts` の `fullName` から使う。
- ドキュメントと既存のコードが食い違うときはコードの書き方に従い、見つけた食い違いを最後の返答ですべて挙げること。
