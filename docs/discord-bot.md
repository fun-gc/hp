# Discord Bot 連携の設計

メダル付与の条件は Discord の運用を見てから決めるので、ここではデータの流れと仕組みだけを決めます。Bot のコードはこのリポジトリの `bot/` に置きます。

## カレンダー(メンバー募集チャンネルの予定を載せる)

メンバー募集チャンネルの投稿から日付と内容を読み取り、講座ページのカレンダーとトップの「これからの予定」に自動で載せます。PR や承認は通さず、投稿してからおよそ 15〜20 分で反映されます。

```
メンバー募集チャンネルに投稿
   ↓ 15 分ごとに GitHub Actions が REST API で読む(.github/workflows/discord-calendar.yml)
予定が前回から変わっていたら Cloudflare Pages の Deploy Hook を叩く
   ↓
ビルドの最初に next.config.ts が bot/calendar/sync.mjs を呼び、content/discord-events.json を作る
   ↓ content/schedule.json と一緒に zod で検証してカレンダーに出す
fungc.org に反映
```

- 常時接続の Bot は動かさず、Bot のトークンで REST API を読むだけです。サーバーは要りません。
- 予定として読めた投稿には Bot が 📅 のリアクションを付けます。付かなければ日付が読めていないので、下の書き方に直してください。
- 投稿を編集・削除すると、次の読み込みでサイトの予定も変わります。読むのは直近 400 日の投稿です。
- `content/discord-events.json` はビルドのたびに作り直すファイルなので、リポジトリには入れません(`.gitignore`)。手で載せたい予定は今までどおり `content/schedule.json` に書きます。
- トークンが設定されていない環境(PR の CI や手元)では Discord を読まずにビルドします。トークンがあるのに読めなかったときはビルドを失敗させ、前の版を公開したままにします。
- テキストチャンネルとフォーラムチャンネルのどちらでも動きます。フォーラムではスレッド名をタイトルにします。

### 投稿の書き方

形式は自由ですが、次の形だと確実に読めます。

```
Unity 講座 第2回
日時: 11/5(水) 18:00〜19:30
場所: 3階 アトリウム
内容: 2D アクションの当たり判定を作ります
```

- **タイトル**: `タイトル:` があればそれ、なければ 1 行目(`【】` や日付は取り除きます)。
- **日付**: `日時:` `日程:` `日付:` `期間:` の行。なければ本文で最初に日付が出てくる行(「締切」「まで」を含む行は除く)。`11/5`、`11月5日`、`2026/11/5`、Discord のタイムスタンプ(`<t:…>`)が使えます。年がなければ投稿日から決め、投稿日より 2 か月以上前の日付は翌年とみなします。
- **複数日**: `日程: 11/4, 11/11, 11/18` は 3 件、`期間: 11/1〜11/3` は 3 日分になります。
- **時間**: 日付と同じ行か `時間:` の行の `18:00〜19:30`、`13時から` など。
- **場所・内容**: `場所:`、`内容:` の行。内容は 120 文字まで載ります。
- **種類**: 「講座」「勉強会」「もくもく」や「第3回」のような通し番号を含むと講座(赤)、「展示」「未来祭」「Miraive」を含むと展示(緑)、それ以外はイベント(黄)。
- **載せない**: 本文に「非掲載」と書いた投稿、返信、Bot の投稿、日付のない投稿、見出しのない 1 行だけの投稿は載りません。
- **主催者**: 投稿した人の名前を、予定一覧の日時の行の右端に出します。`/profile` でメンバー欄に載っている人はプロフィールの名前(後ろの括弧書きは外して「ゆうげつ(26部長)」なら「ゆうげつ」)、載っていない人はサーバーでのニックネームか Discord の表示名です。

#### 講座のお知らせのチラシ画像

本文から日付が読めない投稿に、講座のお知らせのチラシ(A4 縦の FUN GC テンプレート)の画像が付いていれば、画像の表の「日時」と「場所」の欄だけを切り抜いて文字を読みます(`bot/calendar/flyer.mjs`)。

- OCR は無料の [tesseract.js](https://github.com/naptha/tesseract.js) で、API キーなどの設定はいりません。日本語のデータも npm で入れたものを使います。
- 読むのは添付画像のうち縦横比が A4 縦のものだけで、種類は講座(赤)になります。タイトルはスレッド名です。
- 欄の位置は、表の見出しの左にある赤い四角(日時)と、そのすぐ下の緑の四角(場所)を探して決めます。見出しの行数が変わって表が上下にずれても読めます。見出しの四角の色や並び順を変えると読めなくなります。
- 本文に日時を書いた投稿は本文を優先し、画像は読みません。読み違えたときは本文に `【日時】` を書けば直ります。

サイトは誰でも見られるので、載るのはタイトル・日時・場所・内容・主催者名だけです。チラシ画像から読むのも日時と場所だけで、講師名などほかの欄は読みません。

### 初回の設定(管理者が 1 回だけ)

1. [Discord Developer Portal](https://discord.com/developers/applications) で **New Application**(名前は「FUNGC Bot」など)。
   - **Bot** タブ → **Reset Token** でトークンをコピーしておく。同じ画面の **Message Content Intent** を ON にして **Save Changes**。
   - **General Information** の **Application ID** をコピーする。
2. 次の URL の `<Application ID>` を置き換えて開き、FUNGC のサーバーに追加する(権限はチャンネルを見る・メッセージ履歴を読む・リアクションを付けるの 3 つ)。
   `https://discord.com/oauth2/authorize?client_id=<Application ID>&scope=bot&permissions=66624`
   チャンネルが非公開なら、チャンネルの権限で Bot を追加する。
3. Discord の **ユーザー設定 → 詳細設定 → 開発者モード** を ON にし、メンバー募集チャンネルを右クリック → **チャンネル ID をコピー**。
4. GitHub の `fun-gc/hp` → **Settings → Secrets and variables → Actions**
   - **Secrets** に `DISCORD_BOT_TOKEN`(1 のトークン)。`CF_PAGES_DEPLOY_HOOK` がまだなら [deploy-cloudflare.md](./deploy-cloudflare.md) の 3 を見て登録する。
   - **Variables** に `DISCORD_CHANNEL_ID`(3 の ID)。Secrets に入れても動きます。
5. Cloudflare の Pages プロジェクト → **Settings → Variables and Secrets** に、本番とプレビューの両方で `DISCORD_BOT_TOKEN`(Secret)と `DISCORD_CHANNEL_ID`(Text)を追加する。

設定したら GitHub の **Actions → Discord の予定を反映 → Run workflow** で一度動かすと、すぐ反映されます。

公開リポジトリの定期実行は、リポジトリに 60 日間変更がないと GitHub に止められます。止まったときはメールが来るので、Actions の画面から再開してください。

### Discord への掲示(今月の予定)

サイトのカレンダーと同じ予定(`content/schedule.json` と Discord から読んだ予定)を、掲示用チャンネル(ID `1101000649342210049`)に Bot が「今月の予定」として投稿します(`bot/calendar/board.mjs`)。

- 15 分ごとの見張りと一緒に動きます。月が変わって最初の実行で、その月のメッセージを新しく送ります。同じ月のあいだは、予定が変わったり日付が進んだりするたびにそのメッセージを書き換えます。前の月のメッセージは残ります。
- 終わった予定は打ち消し線、今日の予定には「← 今日」が付きます。2000 文字を超える月は、あふれた分を「ほか N 件」とまとめます。
- Bot には掲示用チャンネルの「チャンネルを見る」「メッセージ履歴を読む」「メッセージを送信」の権限が必要です。
- チャンネルを変えるときは、GitHub の **Variables** に `DISCORD_BOARD_CHANNEL_ID` を登録します(登録がなければ上の ID を使います)。

## メンバー登録(/profile コマンド)

Discord で `/profile edit` を使うと、入力フォームが開きます。送った内容は `content/members/<DiscordのユーザーID>.json` を書き換える PR になり、運営がマージするとメンバーページに載ります。

```
メンバー: /profile edit → フォームに入力して送信
   ↓ Discord が HTTP で通知(Interactions Endpoint URL: https://fungc.org/api/discord)
Cloudflare Pages Functions(functions/api/discord.js → bot/members/interactions.mjs)
   ↓ 署名を確かめ、src/lib/schema.ts と同じ zod スキーマで入力を検証
GitHub App としてブランチ member/<ユーザーID> と PR を作る(bot/members/github.mjs、github-app.mjs)
   ↓ 運営が PR を確認してマージ
Cloudflare Pages が再ビルド → fungc.org/members に反映
```

- 受け口はサイトと同じ Cloudflare Pages の中で動きます(`functions/` フォルダ)。別のサーバーや Worker は要りません。サイト本体は今までどおり静的な HTML です。
- 1 人につき PR は 1 つです。マージ前にもう一度送ると同じ PR に追加され、PR の題も最後の操作に合わせて変わります。
- 入力に問題があれば PR は作らず、本人にだけ見える返信で伝えます。PR の CI(ビルド)でももう一度検証します。
- メダル(`medals`)、作品(`works`)、学年の上書き(`override`)、並び順(`order`)は運営が手で入れる項目で、`/profile` で編集しても消えません。
- アイコンは Discord のアバター(サーバー用のアバターがあればそれ)を使い、`/profile edit` か `/profile links` を送るたびに最新にします。

### コマンド

| コマンド | 内容 |
| --- | --- |
| `/profile edit` | フォームが開く。名前、入学年度、担当、自己紹介、好きなゲーム(5 つまで)を入力。登録済みなら今の内容が入っている |
| `/profile links` | X、GitHub、Web サイトのリンク。`@名前` やユーザー名だけでも受け付ける |
| `/profile show` | 登録した内容と、運営の確認待ちかどうかを確認(本人にだけ見える返信) |
| `/profile delete` | 掲載をやめる。ファイルを消す PR を作る。まだ載っていなければ確認待ちの PR を閉じる |

- 学年は入学年度から自動で計算します(4 年生で OB・OG 表示)。`src/lib/grade.ts` 参照。
- 返信はすべて本人にだけ見えます。
- Bot の返事は、アイコンの魔女っ子に合わせて「〜だよ」「〜でね」の柔らかい口調にしています。絵文字は付けません。文言を足すときもこの口調にそろえてください(PR の題と説明は運営向けなので、です・ます調のまま)。

### プライバシー

リポジトリは公開なので、載せたくない人のファイルはリポジトリに置きません(`/profile delete` でファイルごと消します)。Discord のユーザー ID はファイル名に使うため、登録した人の ID は公開されます。このことは `/profile edit` の説明に書いてあります。

### 初回の設定(管理者が 1 回だけ)

カレンダー用に作った Discord のアプリ(Bot)をそのまま使います。サーバーに入れ直す必要はありません。

1. **GitHub App を作る**: GitHub の `fun-gc` 組織 → **Settings → Developer settings → GitHub Apps → New GitHub App**
   - **GitHub App name**: 「fungc-site-bot」など(GitHub 全体で重ならない名前)。PR やコミットはこの名前で作られます。
   - **Homepage URL**: `https://fungc.org`
   - **Webhook** の **Active** のチェックを外す(Bot は GitHub からの通知を受け取らないので要りません)
   - **Repository permissions**: **Contents** と **Pull requests** を **Read and write**(Metadata は自動で Read-only になります)
   - **Where can this GitHub App be installed?**: **Only on this account**
   - **Create GitHub App** を押したら、画面上部の **App ID** を控え、下の **Private keys → Generate a private key** で `.pem` ファイルをダウンロードする。
   - 左のメニューの **Install App** → `fun-gc` の **Install** → **Only select repositories** で `hp` を選ぶ。
   - App の鍵には期限がないので、毎年の作り直しは要りません。鍵が漏れたときだけ、同じ画面で新しい鍵を作って古い鍵を消し、2 を差し替えます。
2. **Cloudflare に設定する**: Pages のプロジェクト → **Settings → Variables and Secrets** に、本番(Production)で次の 3 つを追加し、**Deployments** から最新の本番デプロイを **Retry deployment** して反映させる。
   - `DISCORD_PUBLIC_KEY`(Text): Discord Developer Portal の **General Information** にある **Public Key**
   - `GITHUB_APP_ID`(Text): 1 の App ID
   - `GITHUB_APP_PRIVATE_KEY`(Secret): 1 でダウンロードした `.pem` ファイルをテキストエディタで開き、`-----BEGIN` から `-----END RSA PRIVATE KEY-----` までを丸ごと貼る

個人の fine-grained トークンを `GITHUB_TOKEN` に入れても動きます(App を設定するまでの移行用)。App の 2 つが設定されていればそちらを使うので、App に切り替えたら `GITHUB_TOKEN` は Cloudflare から消し、GitHub のトークンも削除してください。
3. **Discord に受け口を教える**: Developer Portal の **General Information → Interactions Endpoint URL** に `https://fungc.org/api/discord` を入れて **Save Changes**。Discord がその場で疎通を確かめ、2 が反映されていないと保存できません。
4. **コマンドを登録する**: GitHub の **Actions → Discord のコマンドを登録 → Run workflow**。カレンダー用の `DISCORD_BOT_TOKEN` と `DISCORD_CHANNEL_ID` を使い、そのチャンネルがあるサーバーに `/profile` を登録します。`bot/members/commands.mjs` を変えて main にマージしたときは自動で動きます。

`/profile` を打っても候補に出ないときは、Discord を再読み込み(Ctrl+R)してください。

### 手元で試す

`.dev.vars` に `DISCORD_PUBLIC_KEY` と `GITHUB_APP_ID`、`GITHUB_APP_PRIVATE_KEY` を書いて `npx wrangler pages dev out` を実行すると、`npm run build` した `out/` と一緒に受け口が動きます(`.dev.vars` はリポジトリに入れません)。入力の組み立てと PR の作り方は `npm test`(`bot/members/*.test.mjs`)で確かめています。

## メダル(これから作る)

メダルは今は運営が `content/members/<ID>.json` の `medals` に手で書きます。Discord から付けられるようにするなら、次の形を考えています。

| コマンド | 誰が | 内容 |
| --- | --- | --- |
| `/medal give @人 メダル` | 運営ロール | メダルを付与する PR を作る(`/profile` と同じ仕組み) |
| `/medal list` | 全員 | メダルの一覧と説明 |

### 自動判定(将来)

条件が決まったら、GitHub Actions の定期実行で Discord の REST API から発言やイベント参加を集計し、条件を満たした人にメダルを付ける PR をまとめて作る。

- REST API で取れるもの: チャンネルの発言履歴、スケジュールイベントの参加登録、ロール
- 取れないもの: ボイスチャンネルの滞在時間など、リアルタイムのイベント(常時接続の Gateway が必要)。これを条件に使う場合だけ、常時起動のサーバーを別に考える。

### 決めること

- 運営ロールの名前
- メダルの種類と付与の条件
