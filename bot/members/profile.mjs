// /profile コマンドの入力フォーム(モーダル)と、送られた内容から content/members/<ID>.json を組み立てる処理。
// Discord や GitHub には触らないので、node --test でそのまま確かめられる。
// 形のチェックはサイトのビルドと同じ zod スキーマ(src/lib/schema.ts)で行う。

import { z } from "zod";
import { academicYear, memberStanding } from "../../src/lib/grade.ts";
import { memberSchema, roleIds, roleLabels } from "../../src/lib/schema.ts";

// Discord のコンポーネントの種類(https://discord.com/developers/docs/components/reference)
const ACTION_ROW = 1;
const STRING_SELECT = 3;
const TEXT_INPUT = 4;
const LABEL = 18;
const SHORT = 1;
const PARAGRAPH = 2;

export const EDIT_MODAL = "profile:edit";
export const LINKS_MODAL = "profile:links";
const YEAR_CHOICES = 12;

export function displayName(member, user) {
  return String(member?.nick || user.global_name || user.username).slice(0, 32);
}

// サーバー用のアバターがあればそれ、なければ Discord のアバター、どちらもなければ既定の画像
export function avatarUrl(member, user, guildId) {
  if (member?.avatar && guildId) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.png?size=256`;
  }
  if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
  return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

function label(text, component, description) {
  return { type: LABEL, label: text, ...(description ? { description } : {}), component };
}

function textInput(customId, { style = SHORT, value, maxLength, required = false, placeholder }) {
  return {
    type: TEXT_INPUT,
    custom_id: customId,
    style,
    required,
    ...(maxLength ? { max_length: maxLength } : {}),
    ...(value ? { value } : {}),
    ...(placeholder ? { placeholder } : {}),
  };
}

export function admissionYearOptions(now, current) {
  const latest = academicYear(now);
  const years = Array.from({ length: YEAR_CHOICES }, (_, i) => latest - i);
  if (current && !years.includes(current)) years.push(current);
  return years.map((year) => ({
    label: `${year} 年度に入学`,
    value: String(year),
    description: `今年度は ${memberStanding(year, now).label}`,
    ...(year === current ? { default: true } : {}),
  }));
}

/** /profile edit で開くフォーム。登録済みなら今の内容を入れておく */
export function editModal({ existing, name, now }) {
  return {
    custom_id: EDIT_MODAL,
    title: "プロフィールの登録・編集",
    components: [
      label(
        "名前",
        textInput("name", { value: existing?.name ?? name, maxLength: 32, required: true }),
        "サイトに公開されるよ。本名じゃなくても大丈夫だからね",
      ),
      label("入学年度", {
        type: STRING_SELECT,
        custom_id: "admissionYear",
        placeholder: "入学した年度を選んでね(学年は自動で計算するよ)",
        options: admissionYearOptions(now, existing?.admissionYear),
      }),
      label("担当", {
        type: STRING_SELECT,
        custom_id: "roles",
        placeholder: "いくつでも選べるよ",
        required: false,
        min_values: 0,
        max_values: roleIds.length,
        options: roleIds.map((id) => ({
          label: roleLabels[id],
          value: id,
          ...(existing?.roles?.includes(id) ? { default: true } : {}),
        })),
      }),
      label("自己紹介", textInput("bio", { style: PARAGRAPH, value: existing?.bio, maxLength: 200 })),
      label(
        "好きなゲーム",
        textInput("favoriteGames", {
          style: PARAGRAPH,
          value: existing?.favoriteGames?.join("\n"),
          maxLength: 260,
          placeholder: "1 行に 1 つ、5 つまで書いてね",
        }),
      ),
    ],
  };
}

/** /profile links で開くフォーム */
export function linksModal({ existing }) {
  const links = existing?.links ?? {};
  return {
    custom_id: LINKS_MODAL,
    title: "リンクの登録",
    components: [
      label("X", textInput("x", { value: links.x, maxLength: 200, placeholder: "@fungc や https://x.com/… の形で書いてね" })),
      label("GitHub", textInput("github", { value: links.github, maxLength: 200, placeholder: "ユーザー名か URL を書いてね" })),
      label("Web サイト", textInput("website", { value: links.website, maxLength: 200, placeholder: "https://…" })),
    ],
  };
}

/** モーダルの送信内容を { custom_id: 値 } にする。値は文字列か、選択式なら文字列の配列 */
export function modalValues(data) {
  const values = {};
  const visit = (c) => {
    if (!c) return;
    if (c.type === LABEL) return visit(c.component);
    if (c.type === ACTION_ROW) return c.components?.forEach(visit);
    if (c.custom_id) values[c.custom_id] = c.values ?? c.value ?? "";
  };
  data.components?.forEach(visit);
  return values;
}

const clean = (s) => String(s ?? "").trim();

// 「@名前」やユーザー名だけ、https:// を省いた URL も受け付ける
export function normalizeLink(kind, input) {
  const value = clean(input);
  if (!value) return undefined;
  const handle = value.replace(/^@/, "");
  if (kind === "x" && /^\w{1,15}$/.test(handle)) return `https://x.com/${handle}`;
  if (kind === "github" && /^[A-Za-z0-9-]{1,39}$/.test(handle)) return `https://github.com/${handle}`;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * 今の登録内容(なければ null)にフォームの入力を重ねて、メンバーのデータを作る。
 * メダル・作品・学年の上書きなど、運営が手で入れた項目はそのまま残す。
 * 戻り値は { member } か、入力に問題があれば { error }(本人に見せる文)。
 */
export function applyInput(existing, { kind, values, discordId, avatar }) {
  const next = { ...(existing ?? {}), discordId, avatarUrl: avatar };
  if (kind === EDIT_MODAL) {
    next.name = clean(values.name);
    next.admissionYear = Number([values.admissionYear].flat()[0]);
    next.roles = roleIds.filter((id) => [values.roles ?? []].flat().includes(id));
    next.bio = clean(values.bio) || undefined;
    const games = clean(values.favoriteGames)
      .split(/\r?\n|[、,]/)
      .map(clean)
      .filter(Boolean);
    if (games.length > 5) return { error: "好きなゲームは 5 つまでにしてね。" };
    const long = games.find((g) => g.length > 50);
    if (long) return { error: `好きなゲームは 1 つ 50 文字までにしてね(「${long.slice(0, 20)}…」)。` };
    next.favoriteGames = games.length ? games : undefined;
  } else if (kind === LINKS_MODAL) {
    if (!existing) return { error: "先に `/profile edit` でプロフィールを登録してね。" };
    const links = {};
    for (const [key, name] of [
      ["x", "X"],
      ["github", "GitHub"],
      ["website", "Web サイト"],
    ]) {
      const url = normalizeLink(key, values[key]);
      if (url === null) return { error: `${name} のリンクが URL として読めなかったみたい。` };
      if (url) links[key] = url;
    }
    next.links = Object.keys(links).length ? links : undefined;
  }
  // /profile から登録した人はサイトに載せる。載せたくないときは /profile delete でファイルごと消す
  next.public = true;

  const result = memberSchema.safeParse(next);
  if (!result.success) return { error: `入力をもう一度見てみてね。\n${z.prettifyError(result.error)}` };
  return { member: ordered(next) };
}

// content/members/_example.json と同じ並びで書く(空の項目は書かない)
const KEY_ORDER = [
  "discordId",
  "name",
  "avatarUrl",
  "roles",
  "admissionYear",
  "bio",
  "favoriteGames",
  "works",
  "links",
  "medals",
  "public",
  "override",
];

function ordered(member) {
  const filled = { medals: [], ...member };
  const out = {};
  const keys = [...KEY_ORDER, ...Object.keys(filled).filter((k) => !KEY_ORDER.includes(k))];
  for (const key of keys) if (filled[key] !== undefined) out[key] = filled[key];
  return out;
}

export function memberJson(member) {
  return `${JSON.stringify(member, null, 2)}\n`;
}

/** /profile show などで本人に見せる要約 */
export function describe(member, now) {
  const lines = [
    `**${member.name}**(${memberStanding(member.admissionYear, now, member.override).label}・${member.admissionYear} 年度入学)`,
  ];
  if (member.roles?.length) lines.push(`担当: ${member.roles.map((r) => roleLabels[r] ?? r).join("、")}`);
  if (member.bio) lines.push(`自己紹介: ${member.bio}`);
  if (member.favoriteGames?.length) lines.push(`好きなゲーム: ${member.favoriteGames.join("、")}`);
  const links = Object.entries(member.links ?? {}).map(([k, v]) => `${k}: <${v}>`);
  if (links.length) lines.push(`リンク: ${links.join(" ")}`);
  return lines.join("\n");
}
