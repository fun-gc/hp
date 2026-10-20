# サイトの更新方法

Git を使ったことがなくても、GitHub の Web 画面だけで更新できます。どの変更も Pull Request(PR)を通して、運営メンバー 1 人が確認してから公開されます。

## 共通の手順

1. https://github.com/fun-gc/hp を開き、直したいファイルを開く(新しく作るときはフォルダを開いて **Add file → Create new file**)
2. 右上の鉛筆マークで編集する
3. **Commit changes...** を押し、「Create a new branch for this commit and start a pull request」を選んで **Propose changes**
4. PR の画面で **Create pull request**
5. 数分すると Cloudflare のコメントにプレビュー URL が付くので、見た目を確認する
6. 運営メンバーが承認してマージすると、fungc.org に反映されます

データの書き方を間違えると PR のチェック(CI)が赤くなり、どこが違うかがログに出ます。赤いままではマージできないので、壊れたまま公開されることはありません。

## お知らせを追加する

`content/news/` に `2026-11-01-miraive.md` のような名前(日付-英数字)でファイルを作ります。

```markdown
---
title: Miraive で展示します
date: 2026-11-01
tags: [イベント]
---
本文を Markdown で書きます。

## 見出し

- 箇条書き
- [リンク](https://example.com)
```

## 講座やイベントの日程を追加する

Discord のメンバー募集チャンネルに投稿した予定は、自動でカレンダーに載ります(書き方は [docs/discord-bot.md](./docs/discord-bot.md#投稿の書き方))。Discord に投稿しない予定は、`content/schedule.json` に 1 件ずつ追加します。最後の項目のあとに `,` を付けないよう注意してください。

```json
[
  {
    "date": "2026-11-05",
    "start": "18:00",
    "end": "19:30",
    "title": "Unity 講座 第2回",
    "kind": "course",
    "place": "学内",
    "note": "ノート PC を持ってきてください",
    "host": "ふぐ太郎"
  }
]
```

`kind` は `course`(講座・赤)/ `exhibition`(展示・緑)/ `event`(イベント・黄)/ `other`(その他)のどれか。`host` は主催者の名前で、予定一覧の右端に出ます。`start`・`end`・`place`・`note`・`host` は省略できます。Discord から読んだ予定には、元のフォーラムのスレッドの ID(`discordThreadId`)も入ります。手で書く予定には要りません。

## 作品を追加する

`content/works/` に `2026-作品名.md` を作ります。

```markdown
---
title: 作品名
authors: [作者名]
year: 2026
month: 10
event: 未来祭 2026
playUrl: https://unityroom.com/games/xxxx
playLabel: unityroom で遊ぶ
youtubeId: 動画URLの v= の後ろの文字列(ショートなら shorts/ の後ろ)
thumbnail: /works/2026-作品名.gif
tags: [アクション]
---
作品の説明文。
```

- `month` は展示した月。同じ年の作品が新しい順に並びます。
- `order` を付けると、同じイベントの中で小さい数字ほど左に並びます(付けない作品はその後ろにタイトル順)。
- サムネイルは `thumbnail` に指定した画像・GIF(`public/works/` に置く)→ YouTube のサムネイルの順で使います。`youtubeId` があれば、サムネイルを押すと動画が再生されます。
- `month`・`order`・`playUrl`・`playLabel`・`youtubeId`・`thumbnail`・`tags` は省略できます。

## メンバーのプロフィール

Discord の `/profile edit` から登録できます(→ [docs/discord-bot.md](./docs/discord-bot.md#メンバー登録profile-コマンド))。送った内容は Bot が PR にするので、運営が確認してマージしてください。手で作るときは `content/members/_example.json` をまねて、`content/members/<DiscordのユーザーID>.json` を作ります。

- メダル(`medals`)、作品(`works`)、学年の上書き(`override`)、並び順(`order`)は運営が手で書き足します。本人が `/profile` で編集しても消えません。

- `admissionYear`(入学年度)を入れると学年が自動で計算され、毎年 4 月に繰り上がります。4 年生になると OB・OG の欄に移ります。
- 院生などで表示を変えたいときは `"override": { "gradeLabel": "M1", "alumni": false }` を付けます。
- `"public": false` のメンバーはサイトに表示されません。
- 部長などを先頭(左上)に出したいときは `"order": 1` を付けます。数字が小さいほど先に並び、付けていない人は学年の高い順に続きます。

## 連絡先やリンクを変える

`src/lib/site.ts` にまとまっています(問い合わせフォームの URL、講座資料の公開状態など)。

入部・見学フォームは `joinFormUrl` に設定します。入部・見学のどちらも、学内メールへの Discord 招待を Google 側で自動送信します。初回の設定と公開前の確認は [docs/join-form.md](./docs/join-form.md) を参照してください。
