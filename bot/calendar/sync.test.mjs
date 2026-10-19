import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { profileNames } from "./sync.mjs";

test("メンバー欄に載っている人のプロフィールの名前を主催者名に使う", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "members-"));
  const write = (file, data) => fs.writeFileSync(path.join(dir, file), JSON.stringify(data));
  write("1.json", { discordId: "1", name: "ゆうげつ(26部長)", public: true });
  write("2.json", { discordId: "2", name: "非公開の人", public: false });
  write("_example.json", { discordId: "0", name: "例", public: true });
  fs.writeFileSync(path.join(dir, "3.json"), "{ 壊れたファイル");
  assert.deepEqual([...profileNames(dir)], [["1", "ゆうげつ"]]);
  assert.equal(profileNames(path.join(dir, "ない")).size, 0);
});

test("実際の content/members も読める", () => {
  for (const [id, name] of profileNames()) {
    assert.match(id, /^\d+$/);
    assert.ok(name.length > 0 && name.length <= 40);
  }
});
