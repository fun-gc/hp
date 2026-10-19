import assert from "node:assert/strict";
import test from "node:test";
import { memberSchema } from "../../src/lib/schema.ts";
import { admissionYearOptions, applyInput, avatarUrl, EDIT_MODAL, editModal, LINKS_MODAL, modalValues, normalizeLink } from "./profile.mjs";

const now = new Date("2026-10-19T03:00:00Z");
const discordId = "123456789012345678";
const avatar = "https://cdn.discordapp.com/avatars/123456789012345678/abc.png?size=256";

test("入学年度の選択肢は今年度から 12 年分で、学年が分かる", () => {
  const options = admissionYearOptions(now);
  assert.equal(options.length, 12);
  assert.deepEqual(options[0], { label: "2026 年度に入学", value: "2026", description: "今年度は 1年" });
  assert.equal(options[3].description, "今年度は OB・OG");
  // 選択肢より古い年度で登録済みなら、それも出して選んでおく
  assert.deepEqual(admissionYearOptions(now, 2010).at(-1), {
    label: "2010 年度に入学",
    value: "2010",
    description: "今年度は OB・OG",
    default: true,
  });
});

test("登録済みの内容をフォームに入れておく", () => {
  const modal = editModal({
    existing: { name: "ふぐ太郎", admissionYear: 2025, roles: ["artist"], favoriteGames: ["A", "B"] },
    name: "fugu",
    now,
  });
  assert.equal(modal.components.length, 5);
  assert.equal(modal.components[0].component.value, "ふぐ太郎");
  assert.equal(modal.components[1].component.options.find((o) => o.default).value, "2025");
  assert.deepEqual(
    modal.components[2].component.options.filter((o) => o.default).map((o) => o.value),
    ["artist"],
  );
  assert.equal(modal.components[4].component.value, "A\nB");
  // 未登録なら Discord の名前を入れる
  assert.equal(editModal({ name: "fugu", now }).components[0].component.value, "fugu");
});

test("モーダルの送信内容を読む(Label と古い Action Row の両方)", () => {
  const data = {
    components: [
      { type: 18, component: { type: 4, custom_id: "name", value: "ふぐ太郎" } },
      { type: 18, component: { type: 3, custom_id: "roles", values: ["programmer"] } },
      { type: 1, components: [{ type: 4, custom_id: "bio", value: "よろしく" }] },
    ],
  };
  assert.deepEqual(modalValues(data), { name: "ふぐ太郎", roles: ["programmer"], bio: "よろしく" });
});

test("新しく登録する", () => {
  const { member, error } = applyInput(null, {
    kind: EDIT_MODAL,
    discordId,
    avatar,
    values: {
      name: " ふぐ太郎 ",
      admissionYear: ["2025"],
      roles: ["planner", "programmer"],
      bio: "",
      favoriteGames: "Hollow Knight\n\nCeleste、 Undertale",
    },
  });
  assert.equal(error, undefined);
  assert.deepEqual(member, {
    discordId,
    name: "ふぐ太郎",
    avatarUrl: avatar,
    roles: ["programmer", "planner"],
    admissionYear: 2025,
    favoriteGames: ["Hollow Knight", "Celeste", "Undertale"],
    medals: [],
    public: true,
  });
  assert.ok(memberSchema.safeParse(member).success);
  // ファイルの項目の並びは _example.json と同じ
  assert.deepEqual(Object.keys(member), ["discordId", "name", "avatarUrl", "roles", "admissionYear", "favoriteGames", "medals", "public"]);
});

test("編集しても運営が入れた項目(メダル・作品・学年の上書き)は残る", () => {
  const existing = {
    discordId,
    name: "旧名",
    roles: ["artist"],
    admissionYear: 2022,
    bio: "前の自己紹介",
    works: ["2021-tourou"],
    links: { github: "https://github.com/fun-gc" },
    medals: ["first-game"],
    public: true,
    order: 1,
    override: { gradeLabel: "M1", alumni: false },
  };
  const { member } = applyInput(existing, {
    kind: EDIT_MODAL,
    discordId,
    avatar,
    values: { name: "新名", admissionYear: ["2022"], roles: [], bio: "", favoriteGames: "" },
  });
  assert.equal(member.name, "新名");
  assert.deepEqual(member.roles, []);
  assert.equal(member.bio, undefined);
  assert.equal(member.avatarUrl, avatar);
  assert.deepEqual(member.works, ["2021-tourou"]);
  assert.deepEqual(member.links, { github: "https://github.com/fun-gc" });
  assert.deepEqual(member.medals, ["first-game"]);
  assert.deepEqual(member.override, { gradeLabel: "M1", alumni: false });
  assert.equal(member.order, 1);
});

test("好きなゲームが多すぎるとエラー", () => {
  const { error } = applyInput(null, {
    kind: EDIT_MODAL,
    discordId,
    avatar,
    values: { name: "a", admissionYear: ["2025"], roles: [], favoriteGames: "1\n2\n3\n4\n5\n6" },
  });
  assert.match(error, /5 つまで/);
});

test("リンクは @名前 や https:// なしでも受け付ける", () => {
  assert.equal(normalizeLink("x", "@fungc_official"), "https://x.com/fungc_official");
  assert.equal(normalizeLink("github", "fun-gc"), "https://github.com/fun-gc");
  assert.equal(normalizeLink("website", "fungc.org"), "https://fungc.org/");
  assert.equal(normalizeLink("website", "http://example.com/a"), "http://example.com/a");
  assert.equal(normalizeLink("website", ""), undefined);
  assert.equal(normalizeLink("website", "なにか"), null);
});

test("リンクの登録は先にプロフィールがあるときだけ", () => {
  assert.match(applyInput(null, { kind: LINKS_MODAL, discordId, avatar, values: {} }).error, /先に/);
  const existing = { discordId, name: "a", roles: [], admissionYear: 2025, medals: [], public: true };
  const { member } = applyInput(existing, {
    kind: LINKS_MODAL,
    discordId,
    avatar,
    values: { x: "", github: "fun-gc", website: "" },
  });
  assert.deepEqual(member.links, { github: "https://github.com/fun-gc" });
  assert.match(applyInput(existing, { kind: LINKS_MODAL, discordId, avatar, values: { website: "a b" } }).error, /Web サイト/);
});

test("アバターの URL", () => {
  const user = { id: discordId, avatar: "abc" };
  assert.equal(avatarUrl(null, user, "1"), avatar);
  assert.equal(
    avatarUrl({ avatar: "def" }, user, "999"),
    "https://cdn.discordapp.com/guilds/999/users/123456789012345678/avatars/def.png?size=256",
  );
  assert.match(avatarUrl(null, { id: discordId, avatar: null }, "1"), /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
});
