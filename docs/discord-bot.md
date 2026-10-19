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
- **種類**: 「講座」「勉強会」「もくもく」を含むと講座(赤)、「展示」「未来祭」「Miraive」を含むと展示(緑)、それ以外はイベント(黄)。
- **載せない**: 本文に「非掲載」と書いた投稿、返信、Bot の投稿、日付のない投稿、見出しのない 1 行だけの投稿は載りません。

サイトは誰でも見られるので、載るのはタイトル・日時・場所・内容だけにしています(投稿者の名前は載せません)。

### 初回の設定(管理者が 1 回だけ)

1. [Discord Developer Portal](https://discord.com/developers/applications) で **New Application**(名前は「FUN GC Bot」など)。
   - **Bot** タブ → **Reset Token** でトークンをコピーしておく。同じ画面の **Message Content Intent** を ON にして **Save Changes**。
   - **General Information** の **Application ID** をコピーする。
2. 次の URL の `<Application ID>` を置き換えて開き、FUN GC のサーバーに追加する(権限はチャンネルを見る・メッセージ履歴を読む・リアクションを付けるの 3 つ)。
   `https://discord.com/oauth2/authorize?client_id=<Application ID>&scope=bot&permissions=66624`
   チャンネルが非公開なら、チャンネルの権限で Bot を追加する。
3. Discord の **ユーザー設定 → 詳細設定 → 開発者モード** を ON にし、メンバー募集チャンネルを右クリック → **チャンネル ID をコピー**。
4. GitHub の `fun-gc/hp` → **Settings → Secrets and variables → Actions**
   - **Secrets** に `DISCORD_BOT_TOKEN`(1 のトークン)。`CF_PAGES_DEPLOY_HOOK` がまだなら [deploy-cloudflare.md](./deploy-cloudflare.md) の 3 を見て登録する。
   - **Variables** に `DISCORD_CHANNEL_ID`(3 の ID)。Secrets に入れても動きます。
5. Cloudflare の Pages プロジェクト → **Settings → Variables and Secrets** に、本番とプレビューの両方で `DISCORD_BOT_TOKEN`(Secret)と `DISCORD_CHANNEL_ID`(Text)を追加する。

設定したら GitHub の **Actions → Discord の予定を反映 → Run workflow** で一度動かすと、すぐ反映されます。

公開リポジトリの定期実行は、リポジトリに 60 日間変更がないと GitHub に止められます。止まったときはメールが来るので、Actions の画面から再開してください。

## プロフィールとメダル(これから作る)

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

- カレンダー用に作った Discord のアプリ(Bot)をそのまま使う。スラッシュコマンド用に、Developer Portal の **Interactions Endpoint URL** に Worker の URL を入れ、招待 URL の scope に `applications.commands` を足す
- GitHub App「FUN GC Bot」を `fun-gc` 組織に作成し、`hp` リポジトリに Contents と Pull requests の書き込み権限で入れる
- Worker のシークレット: Discord の公開鍵・Bot トークン、GitHub App の秘密鍵

## 決めること

- 運営ロールの名前
- `/profile` の入力項目の最終版
