import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import matter from "gray-matter";
import { memberSchema, newsSchema, scheduleEventSchema, workSchema } from "../../src/lib/schema.ts";
import { buildFile, checkKey, frontmatter, imageExt, ownThumbnailPath, parseMarkdown, readSnapshot } from "./content.mjs";

const contentDir = path.join(import.meta.dirname, "../../content");

function repoFiles() {
  const files = {};
  for (const kind of ["news", "works", "members"]) {
    files[kind] = fs
      .readdirSync(path.join(contentDir, kind))
      .map((name) => ({ name, oid: `oid-${name}`, text: fs.readFileSync(path.join(contentDir, kind, name), "utf8") }));
  }
  files.schedule = { oid: "oid-schedule", text: fs.readFileSync(path.join(contentDir, "schedule.json"), "utf8") };
  return files;
}

test("今のファイルを読み込んで、そのまま書き戻しても 1 文字も変わらない", () => {
  const files = repoFiles();
  const snapshot = readSnapshot(files);
  assert.ok(snapshot.news.length > 0 && snapshot.works.length > 0 && snapshot.members.length > 0);
  // _example.json のような _ で始まるファイルは、サイトと同じく出さない
  assert.ok(snapshot.members.every((m) => !m.key.startsWith("_")));
  for (const kind of ["news", "works", "members"]) {
    for (const item of snapshot[kind]) {
      assert.equal(item.broken, undefined, `${kind}/${item.key}`);
      const original = files[kind].find((f) => f.name.startsWith(`${item.key}.`)).text;
      const built = buildFile({ kind, key: item.key, data: item.data, body: item.body }, original);
      assert.equal(built.error, undefined, `${kind}/${item.key}: ${built.error}`);
      assert.equal(built.content, original, `${kind}/${item.key}`);
    }
  }
  const schedule = buildFile({ kind: "schedule", data: snapshot.schedule.items }, files.schedule.text);
  assert.equal(schedule.content, files.schedule.text);
});

test("お知らせ: サイトのビルド(gray-matter)で、入れたとおりに読める", () => {
  const titles = ["12:30 から説明会", "タイトル: 副題", "#1 ゲームジャム", "- 箇条書きみたい", "yes", "null", "[告知] 新歓", "最後に空白 ", '"引用"', "改行\nあり"];
  for (const title of titles) {
    const built = buildFile({ kind: "news", key: "2026-11-17-test", data: { title, date: "2026-11-17", tags: ["a, b", "C#", "2026"] }, body: "本文" }, null);
    assert.equal(built.error, undefined, title);
    const read = matter(built.content);
    const meta = newsSchema.parse(read.data);
    assert.equal(meta.title, title.trim());
    assert.deepEqual(meta.tags, ["a, b", "C#", "2026"]);
    assert.equal(meta.date.toISOString().slice(0, 10), "2026-11-17");
    assert.equal(read.content, "本文\n");
  }
});

test("お知らせ: 日付は囲まずに、タグは [] で書く", () => {
  const built = buildFile({ kind: "news", key: "2026-11-17-test", data: { title: "Miraive で展示します", date: "2026-11-17", tags: ["イベント"] }, body: "## 見出し\r\n\r\n本文\n\n\n" }, null);
  assert.equal(built.content, "---\ntitle: Miraive で展示します\ndate: 2026-11-17\ntags: [イベント]\n---\n## 見出し\n\n本文\n");
  assert.equal(built.path, "content/news/2026-11-17-test.md");
  assert.equal(built.label, "Miraive で展示します");
});

test("お知らせ: 入力のまちがいは日本語で返す", () => {
  const news = (data) => buildFile({ kind: "news", key: "2026-11-17-test", data: { title: "a", date: "2026-11-17", ...data }, body: "" }, null).error;
  assert.match(news({ title: "  " }), /タイトルを入れてください/);
  assert.match(news({ date: "2026/11/17" }), /YYYY-MM-DD/);
  assert.match(news({ date: "2026-02-30" }), /ない日付/);
  assert.match(news({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }), /10 個まで/);
});

test("作品: CONTRIBUTING.md と同じ並びで書き、空の項目は書かない", () => {
  const data = {
    tags: ["パズル"],
    title: "キラキラ七夕伝説",
    authors: "ゆうげつ ほか".split(","),
    year: 2025,
    month: 12,
    event: "P2HACKS2025",
    order: "",
    playUrl: "https://unityroom.com/games/yugetu_p2hacks2025",
    playLabel: "unityroom で遊ぶ",
    youtubeId: "",
    thumbnail: "/works/2025-kirakira-tanabata.png",
  };
  const built = buildFile({ kind: "works", key: "2025-kirakira-tanabata", data, body: "説明" }, null);
  assert.equal(
    built.content,
    [
      "---",
      "title: キラキラ七夕伝説",
      "authors: [ゆうげつ ほか]",
      "year: 2025",
      "month: 12",
      "event: P2HACKS2025",
      "playUrl: https://unityroom.com/games/yugetu_p2hacks2025",
      "playLabel: unityroom で遊ぶ",
      "thumbnail: /works/2025-kirakira-tanabata.png",
      "tags: [パズル]",
      "---",
      "説明",
      "",
    ].join("\n"),
  );
  assert.deepEqual(workSchema.parse(matter(built.content).data).authors, ["ゆうげつ ほか"]);
});

test("作品: 入力のまちがい", () => {
  const work = (data) => buildFile({ kind: "works", key: "2026-x", data: { title: "x", authors: ["a"], year: 2026, ...data }, body: "" }, null).error;
  assert.match(work({ authors: [] }), /作者を 1 人以上/);
  assert.match(work({ playUrl: "unityroom" }), /^遊べるページの URL: /);
  assert.match(work({ youtubeId: "https://youtu.be/abc" }), /YouTube/);
  assert.match(work({ month: 13 }), /^月: /);
});

test("手で足した項目は、編集画面から保存しても消えない", () => {
  const current = "---\ntitle: 前のタイトル\ndate: 2026-10-01\ndraft: true\nupdated: 2026-10-02\n---\n本文\n";
  const built = buildFile({ kind: "news", key: "2026-10-01-x", data: { title: "新しいタイトル", date: "2026-10-01", tags: [] }, body: "本文" }, current);
  assert.equal(built.content, "---\ntitle: 新しいタイトル\ndate: 2026-10-01\ndraft: true\nupdated: 2026-10-02\n---\n本文\n");

  const member = { discordId: "123456789012345678", name: "ふぐ", admissionYear: 2025, public: true, roles: ["artist"] };
  const builtMember = buildFile({ kind: "members", key: member.discordId, data: member }, JSON.stringify({ ...member, note: "運営のメモ" }));
  assert.equal(JSON.parse(builtMember.content).note, "運営のメモ");
});

test("メンバー: _example.json と同じ並びで書き、スキーマで確かめる", () => {
  const data = {
    public: true,
    name: " ふぐ太郎 ",
    discordId: "123456789012345678",
    admissionYear: 2025,
    roles: ["programmer"],
    bio: "",
    favoriteGames: ["Hollow Knight", ""],
    links: { x: "", github: "https://github.com/fun-gc" },
    override: { gradeLabel: "", alumni: false },
    order: 1,
  };
  const built = buildFile({ kind: "members", key: "123456789012345678", data }, null);
  assert.equal(
    built.content,
    `${JSON.stringify(
      {
        discordId: "123456789012345678",
        name: "ふぐ太郎",
        roles: ["programmer"],
        admissionYear: 2025,
        favoriteGames: ["Hollow Knight"],
        links: { github: "https://github.com/fun-gc" },
        medals: [],
        public: true,
        order: 1,
        override: { alumni: false },
      },
      null,
      2,
    )}\n`,
  );
  memberSchema.parse(JSON.parse(built.content));
  assert.match(buildFile({ kind: "members", key: "999999", data }, null).error, /ファイル名/);
  assert.match(buildFile({ kind: "members", key: "123456789012345678", data: { ...data, admissionYear: 1990 } }, null).error, /^入学年度: .*2000/);
});

test("予定: 日付順に並べ、空の項目は書かない", () => {
  const data = [
    { date: "2026-12-01", title: "後の予定", kind: "event", place: "", start: "" },
    { date: "2026-11-20", start: "18:00", end: "19:30", title: "Unity 講座 第2回", kind: "course", place: "学内", host: "ふぐ太郎" },
  ];
  const built = buildFile({ kind: "schedule", data }, "[]\n");
  const events = JSON.parse(built.content);
  assert.deepEqual(
    events.map((e) => e.title),
    ["Unity 講座 第2回", "後の予定"],
  );
  assert.deepEqual(Object.keys(events[0]), ["date", "start", "end", "title", "kind", "place", "host"]);
  assert.deepEqual(events[1], { date: "2026-12-01", title: "後の予定", kind: "event" });
  events.forEach((e) => scheduleEventSchema.parse(e));
  assert.equal(built.label, "2026-11-20 Unity 講座 第2回、2026-12-01 後の予定");
  // コミットの題には、前のファイルから変わった予定だけを出す
  const moved = buildFile({ kind: "schedule", data: [{ ...events[0], start: "17:00" }, events[1]] }, built.content);
  assert.equal(moved.label, "2026-11-20 Unity 講座 第2回");
  assert.equal(buildFile({ kind: "schedule", data: events }, built.content).label, "予定");
  assert.match(buildFile({ kind: "schedule", data: [{ date: "2026-11-31", title: "x" }] }, null).error, /ない日付/);
  assert.match(buildFile({ kind: "schedule", data: [{ date: "2026-11-30", title: "x", start: "18時" }] }, null).error, /^1 件目の開始の時刻: /);
});

test("新しく作るときのファイル名", () => {
  assert.equal(checkKey("news", "2026-11-17-miraive", true), null);
  assert.match(checkKey("news", "miraive", true), /日付/);
  assert.match(checkKey("news", "2026-11-17-ミライブ", true), /半角/);
  assert.equal(checkKey("works", "2026-hitofuri-golf", true), null);
  assert.match(checkKey("works", "2026_golf", true), /半角/);
  assert.equal(checkKey("members", "123456789012345678", true), null);
  // 今あるファイルは、手で付けた名前でも開ける。/ や .. は通さない
  assert.equal(checkKey("news", "2026-10-15-Website_v2", false), null);
  assert.match(checkKey("news", "../schema", false), /正しくありません/);
  assert.match(checkKey("news", ".hidden", false), /正しくありません/);
  assert.match(checkKey("other", "x", false), /種類/);
});

test("YAML の書き方", () => {
  assert.equal(frontmatter({ a: "https://example.com/a:b", b: "x: y", c: ["1", "two"], d: 3, e: "" }, ["a", "b"]), 'a: https://example.com/a:b\nb: "x: y"\nc: ["1", two]\nd: 3');
  assert.deepEqual(parseMarkdown("---\ntitle: a\n---\n\n本文\n\n"), { data: { title: "a" }, body: "本文" });
  assert.deepEqual(parseMarkdown("本文だけ"), { data: {}, body: "本文だけ" });
});

test("サムネイル画像", () => {
  assert.equal(imageExt(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
  assert.equal(imageExt(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(imageExt(new TextEncoder().encode("GIF89a")), "gif");
  assert.equal(imageExt(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(imageExt(new TextEncoder().encode("<svg>")), null);
  assert.equal(ownThumbnailPath("2026-x", "/works/2026-x.gif"), "public/works/2026-x.gif");
  assert.equal(ownThumbnailPath("2026-x", "/works/2026-y.gif"), null);
  assert.equal(ownThumbnailPath("2026-x", undefined), null);
});

test("お知らせの本文: HTML のタグと javascript: などのリンクは通さない", () => {
  const news = (body) => buildFile({ kind: "news", key: "2026-11-17-x", data: { title: "a", date: "2026-11-17" }, body }, null).error;
  assert.equal(news("## 見出し\n\n[入部案内](/join/) と [フォーム](https://example.com) と <https://fungc.org> と <contact@fungc.org>\n\n`<b>` はコードなので通す\n\n1 < 2 > 0"), undefined);
  assert.match(news("<script>alert(1)</script>"), /HTML のタグ/);
  assert.match(news("文中の <img src=x onerror=alert(1)> も"), /HTML のタグ/);
  assert.match(news("<!-- コメント -->"), /HTML のタグ/);
  assert.match(news("[x](javascript:alert(1))"), /使えないリンク/);
  assert.match(news("[x](JavaScript:alert(1))"), /使えないリンク/);
  assert.match(news("<javascript:alert(1)>"), /使えないリンク/);
  assert.match(news("[x][1]\n\n[1]: vbscript:x"), /使えないリンク/);
  assert.match(news("![x](data:image/svg+xml,abc)"), /使えないリンク/);
  assert.match(news("[x](jav&#x61;script:alert(1))"), /文字参照/);
});

test("URL は http(s) だけ", () => {
  const work = buildFile({ kind: "works", key: "2026-x", data: { title: "x", authors: ["a"], year: 2026, playUrl: "javascript:alert(1)" }, body: "" }, null);
  assert.match(work.error, /^遊べるページの URL: .*https:\/\//);
  const member = { discordId: "123456789012345678", name: "ふぐ", admissionYear: 2025, public: true };
  assert.match(buildFile({ kind: "members", key: member.discordId, data: { ...member, links: { website: "javascript:alert(1)" } } }, null).error, /^Web サイト: /);
  assert.match(buildFile({ kind: "members", key: member.discordId, data: { ...member, avatarUrl: "data:image/png;base64,AAAA" } }, null).error, /^アイコンの URL: /);
});
