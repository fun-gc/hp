# 編集画面(/admin)

FUNGC の Discord サーバーに参加している人は、https://fungc.org/admin/ から Discord でログインして、お知らせ・予定・メンバー・作品を編集できます。保存した内容はすぐには公開されず、編集した人ごとの PR になります。運営が確認してマージすると、サイトに反映されます。

```
https://fungc.org/admin/ で「DISCORD でログイン」
   ↓ Discord の許可の画面(受け取るのはユーザー名・表示名・アイコンだけ)
Cloudflare Pages Functions(functions/api/admin/[[route]].js → bot/admin/)
   ↓ Bot のトークンで FUNGC のサーバーのメンバーかを確かめ、署名したクッキーでログインを 7 日間保つ
編集画面で保存
   ↓ src/lib/schema.ts と同じ zod スキーマで検証
GitHub App としてブランチ edit/<DiscordのユーザーID> にコミットし、PR を作る(2 回目からは同じ PR に積む)
   ↓ 運営が PR を確認してマージ
Cloudflare Pages が再ビルド → fungc.org に反映
```

- サイト本体は今までどおり静的な HTML です。`/admin/` も中身のない枠だけを書き出し、ログインしてからブラウザで内容を読み込みます。動くのは `/api/admin/` 以下だけです。
- データベースは使いません。内容はリポジトリの `content/` を GitHub から直接読み書きします。
- 検索エンジンには載せません(`noindex`)。サイトのどこからもリンクしていないので、運営から URL を伝えてください。

## できること

| タブ | 書き込むファイル | 内容 |
| --- | --- | --- |
| お知らせ | `content/news/<日付>-<名前>.md` | 追加・編集・削除。本文は Markdown で、PREVIEW で見た目を確かめられる |
| 予定 | `content/schedule.json` | 追加・編集・削除。Discord の募集チャンネルから読んだ予定はここには出ないので、元の投稿を直す |
| メンバー | `content/members/<DiscordのユーザーID>.json` | 自分やほかの人のプロフィールの追加・編集・削除。作品・メダル・並び順・学年の表示など運営が入れる項目も |
| 作品 | `content/works/<年>-<名前>.md`、`public/works/` | 追加・編集・削除。サムネイル画像のアップロード、YouTube の URL からの動画 ID の取り出し |

- 画面に出るのは、`main` の内容に、自分の確認待ちの PR の変更を足したものです。保存した変更は、マージ前でも画面に出ます。
- 見た目は、PR に付く Cloudflare Pages のプレビュー URL で確かめられます。
- 保存するたびに 1 つコミットします。コミットと PR の説明には、編集した人の名前・Discord のユーザー名・ユーザー ID が入ります。
- ほかの人が同じ内容を先に変えていたら、上書きせずに「読み込み直す」を出します。
- 編集画面にない項目(手で書き足した項目)は、保存しても消えません。

### 書けないもの

だれでも編集できて、内容はそのままサイトに出るので、次のものは保存のときに断ります。

- お知らせの本文の HTML のタグ。リンクに使えるのは `https://`・`http://`・`mailto:` と、サイト内のパス(`/join/` など)だけです。
- URL の項目(遊べるページ、アイコン、X・GitHub・Web サイトのリンク)は `https://` か `http://` だけです。
- サムネイル画像は PNG・JPEG・GIF・WebP の 5 MB までです。中身を見て形式を決め、`public/works/<作品のファイル名>.<拡張子>` に置きます。拡張子が変わったときは前の画像を消します。

形が壊れていて読めないファイルは、一覧に「読み込めません」と出ます。GitHub の画面で直してください。

## 運営がすること

- 編集画面からの PR は、題が「サイトの編集: <名前>」、ブランチが `edit/<DiscordのユーザーID>` です。ふつうの PR と同じように確認して、マージしてください。
- 直してほしいところは、PR のコメントか Discord で本人に伝えてください。本人がもう一度保存すると、同じ PR に追加されます。
- マージしたあとに保存すると、新しい PR ができます。マージせずに閉じた PR の変更は、次に保存したときに捨てられます(ブランチを `main` から作り直します)。
- 確認待ちの PR があるあいだに `main` が進んだときは、保存のたびに `main` の変更を PR に取り込みます。同じファイルがぶつかると、その人は保存できなくなります。GitHub で PR のぶつかりを直すか、PR を閉じてください。

## ログインのしくみ

- Discord のスコープは `identify` だけです。メールアドレスや、参加しているサーバーの一覧は受け取りません。
- サーバーのメンバーかどうかは、カレンダーと同じ Bot のトークンで、FUNGC のサーバーにその人がいるかを聞いて確かめます。ロールは見ないので、サーバーにいる人はだれでも編集できます(公開は運営の確認のあと)。運営ロールの人だけに絞りたくなったら、`bot/admin/discord.mjs` の `findGuildMember` が返す `member.roles` で絞れます。
- 保存するときにも、サーバーにいるかをもう一度確かめます。サーバーを抜けた人は、ログインが残っていても保存できません。
- ログインの状態は、`DISCORD_CLIENT_SECRET` から作った鍵で署名したクッキー(`__Host-fungc-admin`)に入れ、7 日で切れます。Client Secret を作り直すと、全員がログアウトされます。
- ほかのサイトから保存させないように、保存とログアウトは、編集画面と同じサイトから送られたものだけを受け付けます。

## 初回の設定(管理者が 1 回だけ)

Discord のアプリ(Bot)と GitHub App は、カレンダーと `/profile` のために作ったものをそのまま使います([discord-bot.md](./discord-bot.md))。新しく要るのは、Discord の OAuth2 の設定だけです。

1. **Discord の OAuth2 を設定する**: [Discord Developer Portal](https://discord.com/developers/applications) で FUNGC の Bot のアプリを開き、左の **OAuth2** のページで次をする。
   - **Client ID** を控える(**General Information** の Application ID と同じ値です)。
   - **Client Secret** の **Reset Secret** を押し、出てきた値を控える(あとからは見られません)。
   - **Redirects** の **Add Redirect** で `https://fungc.org/api/admin/callback` を入れて **Save Changes**。`www.fungc.org` でもサイトを開けるようにしているなら、`https://www.fungc.org/api/admin/callback` も足します。
2. **Cloudflare に設定する**: Pages のプロジェクト → **Settings → Variables and Secrets** に、本番(Production)で次の 2 つを追加する。
   - `DISCORD_CLIENT_ID`(Text): 1 の Client ID
   - `DISCORD_CLIENT_SECRET`(Secret): 1 の Client Secret
3. **反映させる**: **Deployments** から最新の本番デプロイを **Retry deployment** する。
4. https://fungc.org/admin/ を開いてログインし、お知らせを 1 件保存して PR ができるかを確かめる(確かめたら PR は閉じてかまいません)。設定が足りないときは、ログインしたあとの画面の上に足りない設定の名前が出ます。

使う設定の一覧です。1・2 で足す 2 つのほかは、カレンダーと `/profile` の設定で入っています。

| 名前 | 中身 |
| --- | --- |
| `DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET` | Discord の OAuth2 の Client ID と Client Secret。Client Secret はクッキーの署名にも使う |
| `DISCORD_BOT_TOKEN` | カレンダーと同じ Bot のトークン。ログインした人がサーバーのメンバーかを確かめる |
| `DISCORD_GUILD_ID` | FUNGC のサーバーの ID。なければ、募集チャンネル(`DISCORD_CHANNEL_ID`)のあるサーバーを使う |
| `GITHUB_APP_ID`、`GITHUB_APP_PRIVATE_KEY` | `/profile` と同じ GitHub App。`GITHUB_TOKEN` でも動く |
| `GITHUB_REPO` | 書き込むリポジトリ。省略すると `fun-gc/hp` |

### プレビューで試すとき

PR のプレビュー(`https://<ブランチ名>.hp-7kl.pages.dev`)で試すときは、Developer Portal の **Redirects** にそのプレビューの `https://<ブランチ名>.hp-7kl.pages.dev/api/admin/callback` を足し、Cloudflare の **Variables and Secrets** の **Preview** にも上の設定(GitHub App の 2 つを含む)を入れてから、プレビューをデプロイし直してください。

プレビューで保存しても、書き込み先は本物のリポジトリ(`fun-gc/hp`)です。試しにできた PR は、マージせずに閉じてください。試し終わったら、Redirects に足したプレビューの URL は消しておきます。

## 手元で試す

`npm run build` で `out/` を作ってから、次のように設定を `.dev.vars` に書いて `npx wrangler pages dev out` を実行し、http://localhost:8788/admin/ を開きます(`.dev.vars` はリポジトリに入れません)。Developer Portal の **Redirects** には `http://localhost:8788/api/admin/callback` を足しておきます。

```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_CHANNEL_ID=...
# 本物のリポジトリに PR を作らないように、自分のフォークと、そこに書き込めるトークンを使う
GITHUB_REPO=<自分のユーザー名>/hp
GITHUB_TOKEN=...
```

`GITHUB_TOKEN` は、フォークだけに **Contents** と **Pull requests** の **Read and write** を付けた fine-grained トークンにします。ログインのクッキーに `Secure` を付けているので、Chrome で開いてください。

ファイルの読み書き、ログイン、PR の作り方は `npm test`(`bot/admin/*.test.mjs`)で、Discord と GitHub の代わりを使って確かめています。

## ファイルの書き方

保存したファイルは、手で書いたファイルと同じ形にそろえます。今あるファイルを開いて保存しただけなら、中身は 1 文字も変わりません。

- お知らせと作品の Markdown は、項目の順番を `bot/admin/content.mjs` の `NEWS_KEYS`・`WORK_KEYS` に合わせ、空の項目は書きません。引用符は、YAML として読み違えるおそれのある値にだけ付けます。
- メンバーの JSON は `/profile` と同じ並び(`bot/members/profile.mjs` の `orderMember`)で書きます。
- 予定は日付と開始時刻の順に並べ直して書きます。

`content/` の形(`src/lib/schema.ts`)を変えたときは、編集画面(`bot/admin/content.mjs` と `src/components/admin/`)も合わせて直してください。
