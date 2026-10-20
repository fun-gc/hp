// メンバー募集チャンネルの投稿を Discord の REST API で読み、予定を content/discord-events.json に書き出す。
// サイトのビルド時(next.config.ts)と、変更を見張る GitHub Actions(.github/workflows/discord-calendar.yml)から呼ぶ。
//
//   DISCORD_BOT_TOKEN   Bot のトークン。未設定なら何もしない(CI や手元のビルド用)
//   DISCORD_CHANNEL_ID  読むチャンネルの ID。カンマ区切りで複数指定できる
//
//   node bot/calendar/sync.mjs [--out <path>] [--react]
//     --react  予定として読めた投稿に 📅 のリアクションを付け、投稿者に伝わるようにする

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discord } from "./discord.mjs";
import { createFlyerReader, looksLikeFlyer } from "./flyer.mjs";
import { hostName, parsePost } from "./parse.mjs";

const REACTION = encodeURIComponent("📅");
// これより古い投稿は読まない
const MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 10;

export const defaultOut = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../content/discord-events.json");
const membersDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../content/members");

/** サイトに載っているメンバーの { Discord のユーザー ID: 主催者として出す名前 } */
export function profileNames(dir = membersDir) {
  const names = new Map();
  if (!fs.existsSync(dir)) return names;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    try {
      const member = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (member.public && member.discordId && member.name) names.set(member.discordId, hostName(member.name));
    } catch {
      // 形の崩れたファイルはサイトのビルドで止まるので、ここでは飛ばす
    }
  }
  return names;
}

// 返信や Bot の投稿は予定として扱わない(type 0 が通常の投稿)
const isPost = (m) => m && m.type === 0 && !m.author?.bot;

async function textChannelPosts(token, channelId, since) {
  const posts = [];
  let before = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await discord(token, `/channels/${channelId}/messages?limit=100${before}`);
    if (!batch?.length) break;
    for (const m of batch) if (isPost(m)) posts.push({ channelId, message: m });
    const last = batch.at(-1);
    if (batch.length < 100 || Date.parse(last.timestamp) < since) break;
    before = `&before=${last.id}`;
  }
  return posts;
}

// フォーラムでは 1 スレッドが 1 投稿。スレッド名をタイトルに使う
async function forumPosts(token, channel, since) {
  const active = await discord(token, `/guilds/${channel.guild_id}/threads/active`);
  const threads = (active?.threads ?? []).filter((t) => t.parent_id === channel.id);
  let before = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await discord(token, `/channels/${channel.id}/threads/archived/public?limit=100${before}`);
    const batch = res?.threads ?? [];
    threads.push(...batch);
    const last = batch.at(-1);
    if (!res?.has_more || !last || Date.parse(last.thread_metadata.archive_timestamp) < since) break;
    before = `&before=${encodeURIComponent(last.thread_metadata.archive_timestamp)}`;
  }
  const posts = [];
  for (const t of threads) {
    const message = await discord(token, `/channels/${t.id}/messages/${t.id}`);
    const tags = (t.applied_tags ?? []).map((id) => channel.available_tags?.find((tag) => tag.id === id)?.name).filter(Boolean);
    if (isPost(message)) posts.push({ channelId: t.id, message, threadName: t.name, tags, archived: t.thread_metadata?.archived, thread: true });
  }
  return posts;
}

export async function syncDiscordEvents({ out = defaultOut, react = false, log = console.log } = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelIds = (process.env.DISCORD_CHANNEL_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !channelIds.length) {
    log("[discord] DISCORD_BOT_TOKEN か DISCORD_CHANNEL_ID が未設定なので、Discord の予定は読み込みません");
    return null;
  }

  const since = Date.now() - MAX_AGE_MS;
  const posts = [];
  for (const id of channelIds) {
    let channel = await discord(token, `/channels/${id}`);
    if (!channel) throw new Error(`チャンネル ${id} が見つかりません(ID か、Bot がサーバーにいるかを確認してください)`);
    // フォーラムの投稿(スレッド)の ID が指定されたときは、親のフォーラムごと読む
    if ([11, 12].includes(channel.type) && channel.parent_id) {
      const parent = await discord(token, `/channels/${channel.parent_id}`);
      if (parent && [15, 16].includes(parent.type)) channel = parent;
    }
    log(`[discord] チャンネル ${channel.id}(種類 ${channel.type})を読みます`);
    // 15: フォーラム、16: メディア。それ以外はテキストチャンネルとして読む
    const found = [15, 16].includes(channel.type) ? await forumPosts(token, channel, since) : await textChannelPosts(token, channel.id, since);
    posts.push(...found.map((p) => ({ ...p, guildId: channel.guild_id })));
  }

  // 主催者名は、メンバー欄に載っている人ならプロフィールの名前を使う。
  // 載っていなければサーバーでのニックネーム、Discord の表示名、ユーザー名の順で使う
  const hosts = profileNames();
  async function hostOf(guildId, author) {
    if (!hosts.has(author.id)) {
      const member = guildId ? await discord(token, `/guilds/${guildId}/members/${author.id}`).catch(() => null) : null;
      hosts.set(author.id, String(member?.nick ?? author.global_name ?? author.username).slice(0, 40));
    }
    return hosts.get(author.id);
  }

  // 本文から日時が読めない投稿は、講座のお知らせのチラシ画像が付いていればそこから読む
  const flyers = createFlyerReader();
  const flyerCount = { read: 0, found: 0 };
  async function fromFlyer(message, threadName, tags) {
    const image = message.attachments?.find(looksLikeFlyer);
    if (!image) return [];
    try {
      const res = await fetch(image.url);
      if (!res.ok) throw new Error(`画像を取得できませんでした(${res.status})`);
      const text = await flyers.read(Buffer.from(await res.arrayBuffer()));
      flyerCount.read++;
      // テンプレートは講座のお知らせなので、色は講座にする
      const found = text ? parsePost({ content: `${message.content ?? ""}\n${text}`, postedAt: message.timestamp, threadName, tags: [...tags, "講座"] }) : [];
      if (found.length) flyerCount.found++;
      return found;
    } catch (err) {
      log(`[discord] チラシ画像を読めませんでした: ${err.message}`);
      return [];
    }
  }

  const seen = new Set();
  const events = [];
  try {
    for (const { channelId, guildId, message, threadName, tags = [], archived, thread } of posts) {
      if (Date.parse(message.timestamp) < since) continue;
      let found = parsePost({ content: message.content ?? "", postedAt: message.timestamp, threadName, tags });
      if (!found.length) found = await fromFlyer(message, threadName, tags);
      const host = found.length && message.author ? await hostOf(guildId, message.author) : undefined;
      // フォーラムの投稿は、Discord に掲示するときにスレッドへのリンクを付けられるよう ID を残す
      const extra = { ...(host && { host }), ...(thread && { discordThreadId: channelId }) };
      for (const e of found.map((e) => ({ ...e, ...extra }))) {
        const key = `${e.date} ${e.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push(e);
      }
      // アーカイブ済みのスレッドにはリアクションを付けられない。付けられなくても予定の反映は止めない
      if (react && found.length && !archived && !message.reactions?.some((r) => r.me && r.emoji.name === "📅")) {
        await discord(token, `/channels/${channelId}/messages/${message.id}/reactions/${REACTION}/@me`, "PUT").catch((err) =>
          log(`[discord] リアクションを付けられませんでした: ${err.message}`),
        );
      }
    }
  } finally {
    await flyers.close();
  }
  events.sort((a, b) => (a.date + (a.start ?? "") + a.title).localeCompare(b.date + (b.start ?? "") + b.title));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(events, null, 2)}\n`);
  log(`[discord] ${posts.length} 件の投稿から ${events.length} 件の予定を読み込みました`);
  // Actions のログは公開されるので、本文や読み取った文字は出さず件数だけ出す
  if (flyerCount.read) log(`[discord] チラシ画像 ${flyerCount.read} 枚を読み、${flyerCount.found} 枚から予定を見つけました`);
  const empty = posts.filter(({ message }) => !message.content && !message.attachments?.length).length;
  if (empty) {
    log(`[discord] 本文が空の投稿が ${empty} 件あります(Developer Portal の Message Content Intent が OFF だと本文が読めません)`);
  }
  return events;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  syncDiscordEvents({
    out: outIndex >= 0 ? path.resolve(args[outIndex + 1]) : defaultOut,
    react: args.includes("--react"),
  }).catch((err) => {
    console.error(`[discord] ${err.message}`);
    process.exit(1);
  });
}
