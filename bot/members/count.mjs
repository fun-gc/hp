// Discord サーバーの参加人数(Bot などのアプリを除く)を数え、content/discord-stats.json に書き出す。
// トップの「MEMBERS」に出す数で、予定と同じくビルドのたび(bot/calendar/sync.mjs から)数え直す。
//
// メンバーの一覧を読むには、Developer Portal の Bot の設定で「Server Members Intent」を ON にしておく。
// OFF のときや読めなかったときはファイルを書かず、サイトはメンバー欄に載っている人数を出す(ビルドは止めない)。

import fs from "node:fs";
import path from "node:path";
import { discord as callDiscord } from "../calendar/discord.mjs";

// 1 回で読める最大の人数。これを超えるサーバーは続きを読む
const PAGE = 1000;
const MAX_PAGES = 50;

/** サーバーの参加者のうち、Bot(アプリ)ではない人の数 */
export async function countHumanMembers(token, guildId, discord = callDiscord) {
  let humans = 0;
  let after = "0";
  for (let page = 0; page < MAX_PAGES; page++) {
    const members = await discord(token, `/guilds/${guildId}/members?limit=${PAGE}&after=${after}`);
    if (!members?.length) break;
    humans += members.filter((m) => !m.user?.bot).length;
    if (members.length < PAGE) break;
    after = members[members.length - 1].user.id;
  }
  return humans;
}

/** 人数を数えて out に書き出す。数えられなかったら古いファイルを消して null を返す */
export async function syncMemberCount({ token, guildId, out, log = console.log, discord = callDiscord }) {
  try {
    const memberCount = await countHumanMembers(token, guildId, discord);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify({ memberCount }, null, 2)}\n`);
    log(`[discord] サーバーの参加人数(アプリを除く)は ${memberCount} 人です`);
    return memberCount;
  } catch (err) {
    fs.rmSync(out, { force: true });
    log(
      `[discord] サーバーの参加人数を数えられませんでした。メンバー欄の人数を出します(Developer Portal の Server Members Intent が ON か確認してください): ${err.message}`,
    );
    return null;
  }
}
