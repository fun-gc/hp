// Discord の募集投稿から、カレンダーに載せる予定(content/schedule.json と同じ形)を取り出す。
// 形式は自由だが、「日時:」「場所:」のような見出しがあれば優先して読む(書き方は docs/discord-bot.md)。

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_MS = 9 * 60 * 60 * 1000;

const LABELS = {
  title: ["タイトル", "イベント名", "企画名", "件名", "名前", "イベント", "企画"],
  date: ["開催日時", "日時", "日程", "日付", "開催日", "期間", "いつ"],
  time: ["時間", "時刻", "開始"],
  place: ["開催場所", "場所", "会場", "集合場所", "集合", "どこ"],
  note: ["内容", "概要", "詳細", "説明", "やること"],
};
const labelList = Object.entries(LABELS)
  .flatMap(([kind, words]) => words.map((w) => [kind, w]))
  .sort((a, b) => b[1].length - a[1].length);

// 見出しのない投稿で、締切などの日付を予定と取り違えないようにする
const NOT_EVENT_DATE = /締切|締め切り|〆切|期限|まで募集|までに/;
const RANGE = String.raw`\s*(?:-|~|〜|ー|−|–|—|から)\s*`;
const DATE_RE =
  /(?<![\d/])(?:(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})日?|(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s*月\s*(\d{1,2})\s*日)(?![\d/])(?:\s*[((][月火水木金土日祝・]+[))])?/g;
const TIME = String.raw`(\d{1,2})(?::(\d{2})|時(?:(\d{1,2})分|(半))?)`;
const TIME_RE = new RegExp(`(?<![\\d/])${TIME}(?:${RANGE}(?:${TIME})?)?`);

const pad = (n) => String(n).padStart(2, "0");

function jstDate(ms) {
  const d = new Date(ms + JST_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/** Discord の書式(メンション、絵文字、太字、<t:…> の日時)を素の文字に直す */
export function normalize(text) {
  return text
    .replace(/<t:(\d+)(?::[a-zA-Z])?>/g, (_, sec) => {
      const d = new Date(Number(sec) * 1000 + JST_MS);
      return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    })
    .replace(/<a?:(\w+):\d+>/g, "")
    .replace(/<(?:@[!&]?|#)\d+>/g, "")
    .replace(/https:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/[\d/]+/g, "")
    .replace(/@(?:everyone|here)/g, "")
    .normalize("NFKC")
    .replace(/\*\*|__|~~|\|\||`/g, "")
    .replace(/\r/g, "");
}

function cleanLine(line) {
  return line
    .replace(/^\s*(?:#{1,3}\s|>\s?|[-*・●○■□◆◇▶▷►※✅☑️📅🗓️📍⏰🕒]+\s*)*/u, "")
    .trim();
}

function matchLabel(line) {
  for (const [kind, word] of labelList) {
    const bracket = line.match(new RegExp(`^[【\\[\\(<]\\s*${word}\\s*[】\\]\\)>]\\s*(.*)$`));
    const colon = line.match(new RegExp(`^${word}\\s*(?::|=|\\s)\\s*(.*)$`));
    const value = (bracket ?? colon)?.[1]?.trim();
    // 「【日時】」だけの行は、値が次の行に書かれている
    if (value !== undefined && (value !== "" || bracket || line.endsWith(":"))) return { kind, value };
  }
  return null;
}

function toTime(h, mm, min, half) {
  const hour = Number(h);
  const minute = mm !== undefined ? Number(mm) : min !== undefined ? Number(min) : half ? 30 : 0;
  if (hour > 23 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}

function findTime(text) {
  const m = text.match(TIME_RE);
  if (!m) return {};
  const start = toTime(m[1], m[2], m[3], m[4]);
  const end = m[5] !== undefined ? toTime(m[5], m[6], m[7], m[8]) : undefined;
  if (!start) return {};
  return end && end > start ? { start, end } : { start };
}

function validDate(y, m, d) {
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  return back.getUTCMonth() === m - 1 && back.getUTCDate() === d ? t : null;
}

/** 年のない日付は投稿日から決める。投稿日より 60 日以上前になるなら翌年とみなす */
function findDates(text, posted) {
  const base = Date.UTC(posted.y, posted.m - 1, posted.d);
  const found = [];
  for (const m of text.matchAll(DATE_RE)) {
    let y, mon, day;
    if (m[1]) [y, mon, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    else {
      [mon, day] = m[4] ? [Number(m[4]), Number(m[5])] : [Number(m[6]), Number(m[7])];
      y = posted.y;
      const t = validDate(y, mon, day);
      if (t !== null && t < base - 60 * DAY_MS) y += 1;
    }
    const t = validDate(y, mon, day);
    if (t === null) continue;
    found.push({ t, index: m.index, end: m.index + m[0].length });
  }
  return found;
}

/** 「11/1〜11/3」のような期間は、間の日も埋める(最大 31 日) */
function expandRanges(text, dates) {
  const out = [];
  dates.forEach((cur, i) => {
    out.push(cur.t);
    const next = dates[i + 1];
    if (!next) return;
    const between = text.slice(cur.end, next.index);
    if (new RegExp(`^${RANGE}$`).test(between) && next.t > cur.t && next.t - cur.t <= 31 * DAY_MS) {
      for (let t = cur.t + DAY_MS; t < next.t; t += DAY_MS) out.push(t);
    }
  });
  return [...new Set(out)];
}

function stripDateTime(line) {
  return line
    .replace(DATE_RE, " ")
    .replace(new RegExp(TIME_RE.source, "g"), " ")
    .replace(new RegExp(`^(?:${RANGE}|[\\s:/|])+|(?:${RANGE}|[\\s:/|])+$`, "g"), "")
    .trim();
}

function titleFrom(line) {
  const tagged = line.match(/^[【\[](.+?)[】\]]\s*(.*)$/);
  const text = tagged ? (tagged[2] || tagged[1]) : line;
  return stripDateTime(text);
}

function kindOf(text) {
  // 「【第3回】」のような通し番号つきの会も講座とみなす
  if (/講座|勉強会|もくもく|ハンズオン|第[\d.]+回/.test(text)) return "course";
  if (/展示|未来祭|Miraive|ミライブ|展覧/i.test(text)) return "exhibition";
  return "event";
}

const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * 1 件の投稿から予定を取り出す。予定と読めなければ空配列。
 * @param {{ content: string, postedAt: string, threadName?: string, tags?: string[] }} post
 *   tags はフォーラムのタグ名。種類(講座・展示など)の判定にだけ使う
 */
// 主催者名に使うプロフィールの名前。後ろの括弧書き(「ゆうげつ(26部長)」の役職など)は外す
export function hostName(name) {
  const base = String(name).replace(/\s*[(（][^()（）]*[)）]\s*$/, "").trim();
  return (base || String(name).trim()).slice(0, 40);
}

export function parsePost({ content, postedAt, threadName, tags = [] }) {
  const text = normalize(content);
  if (/非掲載/.test(text)) return [];
  const lines = text.split("\n").map(cleanLine).filter(Boolean);
  const fields = { title: [], date: [], time: [], place: [], note: [] };
  const others = [];
  let pending = null;
  for (const line of lines) {
    const label = matchLabel(line);
    if (label) {
      if (label.value) fields[label.kind].push(label.value);
      pending = label.value ? null : label.kind;
    } else if (pending) {
      fields[pending].push(line);
      pending = null;
    } else others.push(line);
  }
  // 「#チャンネル と同じ」のようにリンクを消すと意味をなさない内容は載せない
  fields.note = fields.note.filter((n) => !/^[とのにをはがでも]/.test(n));

  const posted = jstDate(Date.parse(postedAt));
  let dateText;
  if (fields.date.length) dateText = fields.date.join("\n");
  else {
    // 見出しがないときは、日付を含む最初の行だけを見る。1 行だけの雑談は拾わない
    if (lines.length < 2 && !threadName) return [];
    dateText = lines.find((l) => !NOT_EVENT_DATE.test(l) && findDates(l, posted).length) ?? "";
  }
  const dates = findDates(dateText, posted);
  if (!dates.length) return [];
  const days = expandRanges(dateText, dates);
  const time = findTime([dateText.slice(dates.at(-1).end), dateText, ...fields.time].join("\n"));

  const title = cut(
    normalize(fields.title[0] ?? threadName ?? "").trim() ||
      others.map(titleFrom).find((t) => t.length > 0) ||
      "",
    60,
  );
  if (!title) return [];

  const event = {
    title,
    // スレッド名に「イベント」とあれば、本文やチラシの内容より優先してイベントにする
    kind: /イベント/.test(threadName ?? "") ? "event" : kindOf([title, ...tags, ...lines].join("\n")),
    ...time,
    ...(fields.place[0] && { place: cut(fields.place[0], 60) }),
    ...(fields.note.length && { note: cut(fields.note.join(" "), 120) }),
  };
  return days.slice(0, 31).map((t) => {
    const d = new Date(t);
    return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, ...event };
  });
}
