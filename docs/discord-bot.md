# Discord Bot 連携の設計(案)

メダル付与の条件は Discord の運用を見てから決めるので、ここではデータの流れと仕組みだけを決めます。

## 方針

- **常時起動のサーバーを持たない。** Discord のスラッシュコマンドは HTTP で受け取れる(Interactions Endpoint)ので、Bot は **Cloudflare Workers**(無料枠)で動かす。サイトと同じ Cloudflare アカウントで管理できる。
- **データの置き場はこのリポジトリ。** Bot はデータベースを持たず、`content/members/<DiscordのユーザーID>.json` を書き換える **PR を作る**。運営が承認してマージすると、サイトが再ビルドされて反映される。履歴が残り、いたずらや誤入力も PR で止められる。

```
メンバー: /profile
   ↓ (Discord が HTTP で通知)
Cloudflare Worker(Bot)
   ↓ GitHub App として PR を作成: content/members/1234....json
運営が PR を承認・マージ
   ↓
Cloudflare Pages が再ビルド → fungc.org のメンバー欄に反映
```

## コマンド案

| コマンド | 誰が | 内容 |
| --- | --- | --- |
| `/profile edit` | 全員 | 入力フォーム(モーダル)が開く。表示名、入学年度、担当、自己紹介、好きなゲーム、リンクを入力 |
| `/profile public` | 全員 | サイトへの掲載を ON / OFF |
| `/profile show` | 全員 | 自分の登録内容を確認(本人にだけ見える返信) |
| `/medal give @人 メダル` | 運営ロール | メダルを付与する PR を作る |
| `/medal list` | 全員 | メダルの一覧と説明 |

- アイコンは Discord のアバターをそのまま使い、`/profile edit` のたびに最新の URL に更新する。
- 学年は入学年度から自動計算(4 年生で OB・OG 表示)。`src/lib/grade.ts` 参照。

## プライバシー

リポジトリは公開なので、**掲載を OFF にしたメンバーのファイルはリポジトリに置かない**(OFF にしたらファイルを削除する PR を作る)。Discord のユーザー ID はファイル名に使うため、掲載 ON の人の ID は公開される点を `/profile public` の説明に書いておく。

## メダルの自動判定(将来)

条件が決まったら、Workers の **Cron Triggers**(定期実行)で Discord の REST API から発言やイベント参加を集計し、条件を満たした人にメダルを付ける PR をまとめて作る。

- REST API で取れるもの: チャンネルの発言履歴、スケジュールイベントの参加登録、ロール
- 取れないもの: ボイスチャンネルの滞在時間など、リアルタイムのイベント(常時接続の Gateway が必要)。これを条件に使う場合だけ、常時起動のサーバーを別に考える。

## 必要なもの(作るときに用意する)

- Discord Developer Portal でアプリ(Bot)を作成し、サーバーに追加(サーバー管理者の権限が必要)
- GitHub App「FUN GC Bot」を `fun-gc` 組織に作成し、`hp` リポジトリに Contents と Pull requests の書き込み権限で入れる
- Worker のシークレット: Discord の公開鍵・Bot トークン、GitHub App の秘密鍵

## 決めること

- Bot のコードをこのリポジトリの `bot/` に置くか、別リポジトリ(`fun-gc/discord-bot`)にするか
- 運営ロールの名前
- `/profile` の入力項目の最終版
