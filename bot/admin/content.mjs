// 編集画面(/admin)で扱うコンテンツ(content/ 以下のファイル)の読み書き。
// 形のチェックはサイトのビルドと同じ zod スキーマ(src/lib/schema.ts)で行い、CONTRIBUTING.md と同じ書き方で書き出す。
// GitHub や Discord には触らないので、node --test でそのまま確かめられる。

import { load } from "js-yaml";
import { marked } from "marked";
import { z } from "zod";
import { memberSchema, newsSchema, scheduleEventSchema, workSchema } from "../../src/lib/schema.ts";
import { memberJson, orderMember } from "../members/profile.mjs";

export const KINDS = ["news", "works", "members", "schedule"];
export const DIRS = { news: "content/news", works: "content/works", members: "content/members" };
export const SCHEDULE_PATH = "content/schedule.json";
const EXT = { news: ".md", works: ".md", members: ".json" };

// 新しく作るときのファイル名。CONTRIBUTING.md の「日付-英数字」「年-英数字」に合わせる
export const NEW_KEY = {
  news: /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/,
  works: /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/,
  members: /^\d{5,25}$/,
};
// 今あるファイルは、手で付けた名前のままでも編集できるようにする(/ や先頭の . は通さない)
const EXISTING_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function filePath(kind, key) {
  if (kind === "schedule") return SCHEDULE_PATH;
  return `${DIRS[kind]}/${key}${EXT[kind]}`;
}

export function checkKey(kind, key, isNew) {
  if (kind === "schedule") return null;
  if (!DIRS[kind]) return "編集できない種類です";
  if (isNew && !NEW_KEY[kind].test(String(key ?? ""))) {
    return {
      news: "ファイル名は「2026-11-01-miraive」のように、日付と半角英小文字・数字・ハイフンで付けてください",
      works: "ファイル名は「2026-hitofuri-golf」のように、年と半角英小文字・数字・ハイフンで付けてください",
      members: "Discord のユーザー ID(数字)を入れてください",
    }[kind];
  }
  if (!EXISTING_KEY.test(String(key ?? ""))) return "ファイル名が正しくありません";
  return null;
}

// ---- Markdown の先頭の --- の中(YAML)

const FRONT = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

export function parseMarkdown(text) {
  const m = FRONT.exec(String(text ?? ""));
  if (!m) return { data: {}, body: String(text ?? "").trim() };
  const data = load(m[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) throw new Error("先頭の --- の中が正しくありません");
  return { data, body: m[2].replace(/^(\r?\n)+/, "").replace(/\s+$/, "") };
}

// サイトのビルド(gray-matter の js-yaml 3)では、12:30 が 60 進数の数に、2026-11-01 が日付になる。
// 数字や記号で始まる文字と、「: 」「 #」を含む文字は、迷わず "" で囲む(URL の : や、-OqY のような - はそのままでよい)
const RISKY = /^[\s\d?:,[\]{}#&*!|>'"%@`<=~.+]|^-(?:[\s\d.]|$)|: |:$| #|\s$/;

function isPlainText(s, inFlow) {
  if (!s || RISKY.test(s) || /[\u0000-\u001f\u007f\u2028\u2029]/.test(s)) return false;
  if (inFlow && /[,[\]{}]/.test(s)) return false;
  try {
    const parsed = load(inFlow ? `[${s}]` : `v: ${s}`);
    return inFlow ? Array.isArray(parsed) && parsed.length === 1 && parsed[0] === s : parsed?.v === s;
  } catch {
    return false;
  }
}

function yamlValue(value, inFlow = false) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // JSON の文字列・配列・オブジェクトは、YAML としてもそのまま読める
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  return isPlainText(s, inFlow) ? s : JSON.stringify(s);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** order の順に、空の項目を飛ばして書く。order にない項目(手で足した項目)は後ろに残す */
export function frontmatter(data, order) {
  const keys = [...order.filter((k) => k in data), ...Object.keys(data).filter((k) => !order.includes(k))];
  const lines = [];
  for (const key of keys) {
    const value = data[key];
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) lines.push(`${key}: [${value.map((v) => yamlValue(v, true)).join(", ")}]`);
    } else if (key === "date" && typeof value === "string" && DATE.test(value)) {
      // 日付はほかのお知らせと同じく囲まずに書く(YAML の日付として読まれる)
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${yamlValue(value)}`);
    }
  }
  return lines.join("\n");
}

export function markdownFile(data, order, body) {
  const text = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+$/, "");
  return `---\n${frontmatter(data, order)}\n---\n${text ? `${text}\n` : ""}`;
}

// ---- 読み込み(GitHub から読んだファイルを、編集画面で使う形にする)

const NEWS_KEYS = ["title", "date", "tags"];
const WORK_KEYS = ["title", "authors", "year", "month", "event", "order", "playUrl", "playLabel", "youtubeId", "thumbnail", "tags"];
const EVENT_KEYS = ["date", "start", "end", "title", "kind", "place", "note", "host", "discordThreadId"];

const asDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value == null ? "" : String(value));
const asList = (value) => (Array.isArray(value) ? value.map(String) : value == null || value === "" ? [] : [String(value)]);
const pick = (data, keys) => Object.fromEntries(keys.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));

function readEntry(kind, { name, oid, text }) {
  const key = name.slice(0, -EXT[kind].length);
  try {
    if (kind === "members") return { key, oid, data: JSON.parse(text) };
    const { data, body } = parseMarkdown(text);
    if (kind === "news") return { key, oid, data: { title: String(data.title ?? ""), date: asDate(data.date), tags: asList(data.tags) }, body };
    return { key, oid, data: { ...pick(data, WORK_KEYS), authors: asList(data.authors), tags: asList(data.tags) }, body };
  } catch (err) {
    // 壊れたファイルも一覧には出す(編集画面では直せないので、GitHub で直してもらう)
    return { key, oid, broken: `読み込めませんでした: ${err.message}` };
  }
}

/**
 * GitHub から読んだファイル({ news: [{ name, oid, text }], works, members, schedule: { oid, text } | null })を、
 * 編集画面で使う形にする。_ で始まるファイル(_example.json など)はサイトと同じく飛ばす
 */
export function readSnapshot(files) {
  const list = (kind) =>
    (files[kind] ?? [])
      .filter((f) => f.name.endsWith(EXT[kind]) && !f.name.startsWith("_") && typeof f.text === "string")
      .map((f) => readEntry(kind, f));
  let schedule = { oid: files.schedule?.oid ?? null, items: [] };
  if (files.schedule?.text) {
    try {
      schedule.items = JSON.parse(files.schedule.text);
    } catch (err) {
      schedule = { ...schedule, broken: `読み込めませんでした: ${err.message}` };
    }
  }
  return {
    news: list("news").sort((a, b) => (b.data?.date ?? "").localeCompare(a.data?.date ?? "") || b.key.localeCompare(a.key)),
    works: list("works").sort((a, b) => b.key.localeCompare(a.key)),
    members: list("members").sort((a, b) => String(a.data?.name ?? "").localeCompare(String(b.data?.name ?? ""), "ja")),
    schedule,
  };
}

// ---- 書き出し(編集画面から届いた内容を確かめて、ファイルの中身にする)

/** 空の文字・null・NaN の項目を消す。入れ子のオブジェクト(links など)も中を消し、空になったら消す */
export function compact(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const c = compact(typeof v === "string" ? v.trim() : v);
      if (c === undefined || c === null || c === "" || (typeof c === "number" && Number.isNaN(c))) continue;
      if (c && typeof c === "object" && !Array.isArray(c) && !Object.keys(c).length) continue;
      out[k] = c;
    }
    return out;
  }
  return value;
}

const cleanList = (list) => (Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : []);
const required = (label, max) =>
  z.string({ error: `${label}を入れてください` }).trim().min(1, `${label}を入れてください`).max(max, `${label}は ${max} 文字までです`);
const realDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const BODY = z.string().max(20000, "本文は 20000 文字までです");
// サイトのスキーマの z.url() は javascript: なども通すので、編集画面からは http(s) だけにする
const httpUrl = (label) => z.url({ protocol: /^https?$/, error: `${label}は https:// で始まる URL にしてください` });

function linkProblem(href) {
  const raw = String(href ?? "");
  // &#x61; のような文字参照は、ブラウザが読むときに元の文字に戻るので通さない
  if (/&#?\w+;/.test(raw)) return "本文のリンクに、& で始まる文字参照は使えません";
  const bare = raw.replace(/[\u0000-\u0020\u007f]/g, "").toLowerCase();
  if (/^[a-z][a-z0-9+.-]*:/.test(bare) && !/^(https?|mailto):/.test(bare)) {
    return `本文に使えないリンクがあります(${raw.slice(0, 40)})。https:// か / で始まる URL にしてください`;
  }
  return null;
}

/**
 * お知らせの本文はサイトで HTML にして出す(src/lib/content.ts)。だれでも編集できるので、
 * HTML のタグと、javascript: などのリンクは通さない。サイトと同じ marked で読んで確かめる
 */
export function markdownProblem(body) {
  let problem = null;
  marked.walkTokens(marked.lexer(String(body ?? "")), (token) => {
    if (problem) return;
    if (token.type === "html") problem = "本文に HTML のタグは使えません。Markdown で書いてください";
    else if (token.type === "link" || token.type === "image") problem = linkProblem(token.href);
  });
  return problem;
}

const newsInput = newsSchema.extend({
  title: required("タイトル", 120),
  date: z.string().regex(DATE, "日付は YYYY-MM-DD の形で入れてください").refine(realDate, "ない日付です"),
  tags: z.array(z.string().max(30, "タグは 1 つ 30 文字までです")).max(10, "タグは 10 個までです").default([]),
});

const workInput = workSchema.extend({
  title: required("タイトル", 120),
  playUrl: httpUrl("遊べるページの URL").optional(),
  authors: z.array(z.string().max(60)).min(1, "作者を 1 人以上入れてください").max(20, "作者は 20 人までです"),
  year: z.number({ error: "年を数字で入れてください" }).int().min(2000).max(2100),
  event: z.string().max(60).optional(),
  playLabel: z.string().max(40).optional(),
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/, "YouTube の動画 ID が正しくありません").optional(),
  thumbnail: z.string().regex(/^\/[A-Za-z0-9._\-/]+$/, "サムネイルは /works/xxx.png のようなパスにしてください").optional(),
  tags: z.array(z.string().max(30, "タグは 1 つ 30 文字までです")).max(10, "タグは 10 個までです").default([]),
});

const memberInput = memberSchema.extend({
  avatarUrl: httpUrl("アイコンの URL").optional(),
  links: z
    .object({ x: httpUrl("X").optional(), github: httpUrl("GitHub").optional(), website: httpUrl("Web サイト").optional() })
    .optional(),
});

const eventInput = scheduleEventSchema.extend({
  title: required("タイトル", 120),
  date: z.string().regex(DATE, "日付は YYYY-MM-DD の形で入れてください").refine(realDate, "ない日付です"),
  place: z.string().max(80).optional(),
  note: z.string().max(200).optional(),
});

// 画面に出すときの項目の名前
const FIELD = {
  title: "タイトル",
  date: "日付",
  tags: "タグ",
  authors: "作者",
  year: "年",
  month: "月",
  event: "イベント",
  order: "並び順",
  playUrl: "遊べるページの URL",
  playLabel: "ボタンの文字",
  youtubeId: "YouTube の動画 ID",
  thumbnail: "サムネイル",
  discordId: "Discord のユーザー ID",
  name: "名前",
  avatarUrl: "アイコンの URL",
  roles: "担当",
  admissionYear: "入学年度",
  bio: "自己紹介",
  favoriteGames: "好きなゲーム",
  works: "作品",
  "links.x": "X",
  "links.github": "GitHub",
  "links.website": "Web サイト",
  medals: "メダル",
  public: "サイトに載せるか",
  "override.gradeLabel": "学年の表示",
  "override.alumni": "OB・OG の欄に出すか",
  start: "開始の時刻",
  end: "終了の時刻",
  kind: "種類",
  place: "場所",
  note: "内容",
  host: "主催",
};

// サイトのスキーマの英語のメッセージは、このときだけ日本語にする(z.config で全体を変えると /profile の返事も変わるため)
const japanese = z.locales.ja().localeError;

function check(schema, value) {
  const result = schema.safeParse(value, { error: japanese });
  if (result.success) return { value: result.data };
  const lines = result.error.issues.map((issue) => {
    const nth = typeof issue.path[0] === "number" ? `${issue.path[0] + 1} 件目の` : "";
    const keys = issue.path.filter((k) => typeof k === "string");
    const field = FIELD[keys.join(".")] ?? FIELD[keys[0]] ?? keys.join(".");
    return `${nth}${field ? `${field}: ` : ""}${issue.message}`;
  });
  return { error: [...new Set(lines)].join("\n") };
}

/** 手で足した項目(編集画面にない項目)は、今のファイルから引き継ぐ */
const extrasOf = (data, known) => Object.fromEntries(Object.entries(data ?? {}).filter(([k]) => !known.includes(k)));

/** 予定はファイルが 1 つなので、コミットの題には、前のファイルから増えた・消えた・変わった予定の日付とタイトルを出す */
function scheduleLabel(current, events) {
  let before = [];
  try {
    before = JSON.parse(current ?? "[]");
  } catch {
    // 読めないファイルを直したときは、題を「予定」にする
  }
  if (!Array.isArray(before)) before = [];
  const same = (e) => JSON.stringify(pick(e ?? {}, EVENT_KEYS));
  const was = new Set(before.map(same));
  const now = new Set(events.map(same));
  const changed = [...events.filter((e) => !was.has(same(e))), ...before.filter((e) => !now.has(same(e)))];
  const names = [...new Set(changed.map((e) => `${e?.date ?? ""} ${e?.title ?? ""}`.trim()))];
  if (!names.length) return "予定";
  return names.length > 3 ? `${names.slice(0, 3).join("、")} ほか ${names.length - 3} 件` : names.join("、");
}

/**
 * 編集画面から届いた 1 件({ kind, key, data, body })を確かめ、書き込むファイルの中身にする。
 * current は今のファイルの中身(新しく作るときは null)。
 * 戻り値は { path, content, label }(label はコミットの題に使う名前)か { error }(画面に出す文)
 */
export function buildFile({ kind, key, data, body }, current) {
  const path = filePath(kind, key);
  const input = compact(data ?? {});

  if (kind === "news") {
    const checked = check(newsInput, { ...input, tags: cleanList(input.tags) });
    if (checked.error) return checked;
    const bodyChecked = check(BODY, String(body ?? ""));
    if (bodyChecked.error) return bodyChecked;
    const problem = markdownProblem(bodyChecked.value);
    if (problem) return { error: problem };
    const { title, date, tags } = checked.value;
    const extras = current ? extrasOf(parseMarkdown(current).data, NEWS_KEYS) : {};
    return { path, label: title, content: markdownFile({ title, date, tags, ...extras }, NEWS_KEYS, bodyChecked.value) };
  }

  if (kind === "works") {
    const checked = check(workInput, { ...input, authors: cleanList(input.authors), tags: cleanList(input.tags) });
    if (checked.error) return checked;
    const bodyChecked = check(BODY, String(body ?? ""));
    if (bodyChecked.error) return bodyChecked;
    const extras = current ? extrasOf(parseMarkdown(current).data, WORK_KEYS) : {};
    return { path, label: checked.value.title, content: markdownFile({ ...pick(checked.value, WORK_KEYS), ...extras }, WORK_KEYS, bodyChecked.value) };
  }

  if (kind === "members") {
    const member = {
      ...input,
      roles: cleanList(input.roles),
      favoriteGames: cleanList(input.favoriteGames),
      works: cleanList(input.works),
      medals: cleanList(input.medals),
    };
    if (!member.favoriteGames.length) delete member.favoriteGames;
    if (!member.works.length) delete member.works;
    const checked = check(memberInput, member);
    if (checked.error) return checked;
    if (checked.value.discordId !== key) return { error: "Discord のユーザー ID とファイル名が合っていません" };
    let extras = {};
    if (current) {
      try {
        extras = extrasOf(JSON.parse(current), Object.keys(memberSchema.shape));
      } catch {
        // 今のファイルが壊れていれば、書き直して直す
      }
    }
    return { path, label: checked.value.name, content: memberJson(orderMember({ ...checked.value, ...extras })) };
  }

  if (kind === "schedule") {
    const events = Array.isArray(data) ? data.map((e) => compact(e ?? {})) : null;
    if (!events) return { error: "予定の一覧が届きませんでした" };
    const checked = check(z.array(eventInput).max(500, "予定は 500 件までです"), events);
    if (checked.error) return checked;
    const sorted = checked.value
      .map((e) => pick(e, EVENT_KEYS))
      .sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
    return { path, label: scheduleLabel(current, sorted), content: `${JSON.stringify(sorted, null, 2)}\n` };
  }

  return { error: "編集できない種類です" };
}

// ---- 作品のサムネイル画像

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const THUMBNAIL_EXTS = ["png", "jpg", "gif", "webp"];

/** 先頭のバイトから画像の種類を見分ける。対応していなければ null */
export function imageExt(bytes) {
  const starts = (...sig) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0xff, 0xd8, 0xff)) return "jpg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

/** 作品のサムネイルとして置いた画像(public/works/<作品のファイル名>.<拡張子>)のパス。ほかの場所の画像なら null */
export function ownThumbnailPath(key, thumbnail) {
  const m = /^\/works\/([^/]+)\.(png|jpg|gif|webp)$/.exec(String(thumbnail ?? ""));
  return m && m[1] === key ? `public${thumbnail}` : null;
}
