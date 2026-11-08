import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discordStatsSchema } from "../../src/lib/schema.ts";
import { countHumanMembers, syncMemberCount } from "./count.mjs";

const member = (id, bot = false) => ({ user: { id: String(id), ...(bot && { bot: true }) } });

test("Bot(アプリ)を除いて数え、1000 人を超えるサーバーは続きも読む", async () => {
  const all = Array.from({ length: 1500 }, (_, i) => member(i + 1, i % 100 === 0));
  const routes = [];
  const fake = async (_token, route) => {
    routes.push(route);
    const after = Number(new URL(route, "https://x").searchParams.get("after"));
    return all.filter((m) => Number(m.user.id) > after).slice(0, 1000);
  };
  assert.equal(await countHumanMembers("t", "g", fake), 1485);
  assert.deepEqual(routes, ["/guilds/g/members?limit=1000&after=0", "/guilds/g/members?limit=1000&after=1000"]);
});

test("数えた人数をスキーマに合う形で書き出す", async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "count-")), "discord-stats.json");
  const n = await syncMemberCount({ token: "t", guildId: "g", out, log: () => {}, discord: async () => [member(1), member(2, true), member(3)] });
  assert.equal(n, 2);
  assert.deepEqual(discordStatsSchema.parse(JSON.parse(fs.readFileSync(out, "utf8"))), { memberCount: 2 });
});

test("読めなかったら(Server Members Intent が OFF など)古いファイルを消し、ビルドは止めない", async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "count-")), "discord-stats.json");
  fs.writeFileSync(out, '{ "memberCount": 9 }\n');
  const logs = [];
  const n = await syncMemberCount({
    token: "t",
    guildId: "g",
    out,
    log: (s) => logs.push(s),
    discord: async () => {
      throw new Error("Discord API GET /guilds/g/members が 403 を返しました");
    },
  });
  assert.equal(n, null);
  assert.equal(fs.existsSync(out), false);
  assert.match(logs[0], /Server Members Intent/);
});
