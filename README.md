# FUN GC 公式サイト

公立はこだて未来大学のゲーム制作サークル **FUN GC** の公式サイト(https://fungc.org)のリポジトリです。

- 文章や予定を更新したい → [CONTRIBUTING.md](./CONTRIBUTING.md)(Git を使わず GitHub の画面だけで編集できます)
- 公開の仕組み → [docs/deploy-cloudflare.md](./docs/deploy-cloudflare.md)
- Discord Bot 連携の設計 → [docs/discord-bot.md](./docs/discord-bot.md)

## 構成

| 場所 | 中身 |
| --- | --- |
| `content/news/*.md` | お知らせ(Markdown) |
| `content/works/*.md` | 作品紹介 |
| `content/schedule.json` | 講座・イベントの日程(講座ページのカレンダーに出る) |
| `content/members/<DiscordのID>.json` | メンバーのプロフィール(Discord Bot から登録する予定) |
| `content/medals.json` | メダルの定義(条件は運用を見て決める) |
| `src/app/` | 各ページ |
| `src/components/` | 部品(ロゴ、カレンダー、カードなど) |
| `src/lib/site.ts` | 連絡先やリンクなど、サイト全体の設定 |

## 手元で動かす

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # out/ に静的ファイルを書き出す
```

Next.js(App Router)+ Tailwind CSS で作り、`output: "export"` で静的な HTML として書き出して Cloudflare Pages に置いています。

## 変更の流れ

1. ブランチを作って変更する(GitHub の画面で編集すると自動でブランチと PR を作れます)
2. Pull Request を作ると、CI のビルドと Cloudflare Pages のプレビュー URL が付きます
3. 運営メンバー 1 人が確認して承認したら `main` にマージ → 本番(fungc.org)に自動で反映
