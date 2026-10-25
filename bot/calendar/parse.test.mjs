import assert from "node:assert/strict";
import test from "node:test";
import { hostName, parsePost } from "./parse.mjs";

const postedAt = "2026-10-19T03:00:00Z"; // 日本時間 10/19 12:00

test("見出し付きの投稿", () => {
  const content = [
    "【イベント】Unity 講座 第2回",
    "日時:11/5(水)18:00〜19:30",
    "場所:3階 アトリウム",
    "内容:2D アクションの当たり判定を作ります",
  ].join("\n");
  assert.deepEqual(parsePost({ content, postedAt }), [
    {
      date: "2026-11-05",
      title: "Unity 講座 第2回",
      kind: "course",
      start: "18:00",
      end: "19:30",
      place: "3階 アトリウム",
      note: "2D アクションの当たり判定を作ります",
    },
  ]);
});

test("見出しのない自由な投稿", () => {
  const content = "**ゲームジャム参加者募集!**\n11月22日(土) 13時から 部室でやります\n参加したい人はリアクションください";
  assert.deepEqual(parsePost({ content, postedAt }), [
    { date: "2026-11-22", title: "ゲームジャム参加者募集!", kind: "event", start: "13:00" },
  ]);
});

test("タイトルの行に日付が入っていても取り除く", () => {
  const [e] = parsePost({ content: "11/8 もくもく会 18:30-\n途中参加 OK", postedAt });
  assert.equal(e.title, "もくもく会");
  assert.equal(e.kind, "course");
  assert.equal(e.start, "18:30");
});

test("期間は 1 日ずつ埋める", () => {
  const events = parsePost({ content: "未来祭 展示\n期間: 11/1〜11/3", postedAt });
  assert.deepEqual(
    events.map((e) => [e.date, e.kind]),
    [
      ["2026-11-01", "exhibition"],
      ["2026-11-02", "exhibition"],
      ["2026-11-03", "exhibition"],
    ],
  );
});

test("複数の日付を並べた投稿", () => {
  const events = parsePost({ content: "Blender 講座\n日程: 11/4, 11/11, 11/18 19:00〜", postedAt });
  assert.deepEqual(
    events.map((e) => e.date),
    ["2026-11-04", "2026-11-11", "2026-11-18"],
  );
  assert.equal(events[0].start, "19:00");
});

test("年をまたぐ日付は翌年にする", () => {
  const [e] = parsePost({ content: "新年ゲーム会\n日時: 1/10 14:00", postedAt: "2026-12-20T03:00:00Z" });
  assert.equal(e.date, "2027-01-10");
});

test("年付き・全角・Discord のタイムスタンプも読める", () => {
  assert.equal(parsePost({ content: "合宿\n日付:2027年3月2日", postedAt })[0].date, "2027-03-02");
  assert.equal(parsePost({ content: "LT 会\n日時:11/6 18:00", postedAt })[0].start, "18:00");
  // 1793955600 = 日本時間 2026-11-06 18:00
  const [e] = parsePost({ content: "LT 会\n日時: <t:1793955600:F>", postedAt });
  assert.deepEqual([e.date, e.start], ["2026-11-06", "18:00"]);
});

test("フォーラムのスレッド名をタイトルにする", () => {
  const [e] = parsePost({ content: "日時: 11/30 10:00〜17:00\n場所: 函館市内", postedAt, threadName: "Global Game Jam 説明会" });
  assert.equal(e.title, "Global Game Jam 説明会");
  assert.equal(e.end, "17:00");
});

test("予定ではない投稿は拾わない", () => {
  assert.deepEqual(parsePost({ content: "11/5 空いてます", postedAt }), []);
  assert.deepEqual(parsePost({ content: "チームメンバー募集\nジャンルは未定です", postedAt }), []);
  assert.deepEqual(parsePost({ content: "作品募集\n応募締切 10/30 まで", postedAt }), []);
  assert.deepEqual(parsePost({ content: "内輪の会\n日時: 11/5\n非掲載", postedAt }), []);
  assert.deepEqual(parsePost({ content: "テスト\n日時: 2/30", postedAt }), []);
});

test("メンションやカスタム絵文字は消す", () => {
  const [e] = parsePost({ content: "<:fugu:123456> 交流会 <@&987654>\n日時: 11/12 18:00", postedAt });
  assert.equal(e.title, "交流会");
});

test("見出しの次の行に値を書くフォーラムの投稿", () => {
  const content = [
    "<@&123456789012345678>",
    "【内容】",
    "<#987654321098765432> と同じ",
    "",
    "【日時】",
    "**4/27(月)18:00~19:30**",
    "",
    "【場所】",
    "**365予定**",
    "",
    "【持ち物】",
    "PC(必須)",
    "",
    "【備考】",
    "参加希望の方はリアクションお願いします",
  ].join("\n");
  assert.deepEqual(
    parsePost({ content, postedAt: "2026-04-24T02:34:00Z", threadName: "【第1.5回】続・Unityで3Dジャンプアクションゲームを作ってみよう" }),
    [
      {
        date: "2026-04-27",
        title: "【第1.5回】続・Unityで3Dジャンプアクションゲームを作ってみよう",
        kind: "course",
        start: "18:00",
        end: "19:30",
        place: "365予定",
      },
    ],
  );
});

test("フォーラムのタグで種類を決める", () => {
  const [e] = parsePost({ content: "日時: 11/30", postedAt, threadName: "作品展", tags: ["展示"] });
  assert.equal(e.kind, "exhibition");
});

test("スレッド名に「イベント」とあればイベントにする", () => {
  // チラシから読んだ予定は「講座」のタグが付くが、スレッド名を優先する
  const [e] = parsePost({ content: "【日時】11月7日(土) 12:00〜18:00\n【場所】Discord", postedAt, threadName: "256モデルをつくろう【イベント】", tags: ["講座"] });
  assert.equal(e.kind, "event");
  const [f] = parsePost({ content: "日時: 11/30", postedAt, threadName: "第3回 もくもく会", tags: [] });
  assert.equal(f.kind, "course");
});

test("主催者名はプロフィールの名前から後ろの括弧書きを外す", () => {
  assert.equal(hostName("ゆうげつ(26部長)"), "ゆうげつ");
  assert.equal(hostName("ゆうげつ (副部長)"), "ゆうげつ");
  assert.equal(hostName("iuchico"), "iuchico");
  assert.equal(hostName("(仮)ふぐ"), "(仮)ふぐ");
  assert.equal(hostName("(部長)"), "(部長)");
});
