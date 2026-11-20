import assert from "node:assert/strict";
import test from "node:test";
import { COLS, ROWS, Runner } from "./runner.ts";

// 画面の中身から走者の位置を読む。走者は左から 8〜14 列目、地面の線は 25 行目
const RUNNER_COLS = [8, 14];
const FLOOR = 25;
/** 走ってるときの足の先の行 */
const ON_GROUND = FLOOR - 1;

/** 実際の画面と同じく 1/60 秒ずつ進める */
function advance(runner, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) runner.step(1 / 60);
}

function screen(runner) {
  const s = new Uint8Array(COLS * ROWS);
  runner.draw(s);
  return s;
}

/** 走者の絵のいちばん下の行(地面より上だけを見る)。見えなければ -1 */
function runnerBottom(runner) {
  const s = screen(runner);
  for (let r = FLOOR - 1; r >= 0; r--) {
    for (let c = RUNNER_COLS[0]; c <= RUNNER_COLS[1]; c++) if (s[r * COLS + c]) return r;
  }
  return -1;
}

/** 箱に当たるまで(長くても 20 秒)進める */
function untilOver(runner) {
  for (let i = 0; i < 20 * 60 && runner.phase !== "over"; i++) runner.step(1 / 60);
}

/** タイトルまで進めて、ボタンで走り始めた状態 */
function started(random = () => 0, hi = 0) {
  const runner = new Runner(hi, random);
  advance(runner, 1.3);
  runner.press();
  return runner;
}

test("起動の演出のあと、ボタンを押すまでタイトルで待つ", () => {
  const runner = new Runner();
  assert.equal(runner.phase, "boot");
  advance(runner, 1.2);
  assert.equal(runner.phase, "boot");
  advance(runner, 0.1);
  assert.equal(runner.phase, "title");
  advance(runner, 5);
  assert.equal(runner.phase, "title");
  runner.press();
  assert.equal(runner.phase, "run");
});

test("走り始めのボタンでそのまま跳び、0.65 秒ほどで着地する", () => {
  const runner = started();
  advance(runner, 0.3);
  assert.ok(runnerBottom(runner) < ON_GROUND - 8, "跳んでいる最中は地面から離れている");
  advance(runner, 0.5);
  assert.equal(runnerBottom(runner), ON_GROUND);
});

test("着地の直前に押したぶんは、着地してすぐの踏み切りに回す", () => {
  const buffered = started();
  advance(buffered, 0.6); // 着地の 0.05 秒ほど前
  buffered.press();
  advance(buffered, 0.2);
  assert.ok(runnerBottom(buffered) < ON_GROUND, "着地してすぐ跳び直している");

  const tooEarly = started();
  advance(tooEarly, 0.3); // 着地の 0.35 秒前は早すぎる
  tooEarly.press();
  advance(tooEarly, 0.5);
  assert.equal(runnerBottom(tooEarly), ON_GROUND);
});

test("跳ばずにいると箱に当たって GAME OVER になり、最高点を塗り替える", () => {
  const runner = started();
  untilOver(runner);
  assert.equal(runner.phase, "over");
  assert.ok(runner.score > 0);
  assert.equal(runner.hi, runner.score);
  assert.equal(runner.record, true);
});

test("最高点に届かなければ、最高点はそのまま", () => {
  const runner = started(() => 0, 99999);
  untilOver(runner);
  assert.equal(runner.phase, "over");
  assert.equal(runner.hi, 99999);
  assert.equal(runner.record, false);
});

test("GAME OVER のすぐあとの押しまちがいでは始め直さない", () => {
  const runner = started();
  untilOver(runner);
  assert.equal(runner.phase, "over");
  const score = runner.score;

  advance(runner, 0.3);
  runner.press();
  assert.equal(runner.phase, "over");
  assert.equal(runner.score, score);

  advance(runner, 0.4);
  runner.press();
  assert.equal(runner.phase, "run");
  assert.equal(runner.score, 0);
});

test("やめると画面が「人」の絵に戻り、done で止まる", () => {
  const runner = started();
  advance(runner, 1);
  runner.leave();
  assert.equal(runner.phase, "exit");
  advance(runner, 0.7);
  assert.equal(runner.phase, "done");
  runner.leave();
  assert.equal(runner.phase, "done");

  // 「人」の絵はパネルの右端の 36 列に収まる
  const s = screen(runner);
  const lit = [...s.keys()].filter((i) => s[i]);
  assert.ok(lit.length > 0);
  assert.ok(lit.every((i) => i % COLS >= COLS - 36));
});

test("画面は COLS × ROWS 個の 0 か 1 だけ", () => {
  const runner = new Runner(0, () => 0.5);
  for (const seconds of [0.5, 1, 1.5, 3, 6]) {
    advance(runner, seconds);
    if (runner.phase === "title" || runner.phase === "over") runner.press();
    const s = screen(runner);
    assert.equal(s.length, COLS * ROWS);
    assert.ok(s.every((v) => v === 0 || v === 1));
  }
});
