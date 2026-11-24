import assert from "node:assert/strict";
import test from "node:test";
import { PageRun } from "./pagerun.ts";

const DOT = 4;
const BOUNDS = { w: 800, h: 3000 };

/** 1/60 秒ずつ進める */
function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.step(1 / 60);
}

/** (x, y) から、ほぼ真下へ落ちる走者 */
function dropAt(x, y, ledges) {
  const game = new PageRun({ x, y, vx: 0, vy: 0, scale: DOT }, DOT, BOUNDS);
  game.setLedges(ledges);
  return game;
}

const ledge = (id, x, y, w, kind = "ledge") => ({ id, kind, x, y, w, h: 20 });

test("落ちて足場に乗り、その上を走る", () => {
  const game = dropAt(400, 100, [ledge(1, 0, 300, 800)]);
  advance(game, 1);
  assert.equal(game.air, false);
  assert.equal(game.y, 300);
  const x = game.x;
  advance(game, 0.2);
  assert.notEqual(game.x, x, "走りつづけている");
});

test("足場は下から突き抜けて跳び上がれる", () => {
  const game = dropAt(400, 400, [ledge(1, 0, 400, 800), ledge(2, 0, 330, 800)]);
  advance(game, 0.1);
  assert.equal(game.y, 400);
  game.jump();
  advance(game, 1);
  assert.equal(game.y, 330, "上の足場に乗っている");
});

test("↓ で足場をすり抜けて、下の足場へ下りる", () => {
  const game = dropAt(400, 100, [ledge(1, 0, 200, 800), ledge(2, 0, 500, 800)]);
  advance(game, 0.5);
  assert.equal(game.y, 200);
  game.drop();
  advance(game, 1);
  assert.equal(game.y, 500);
});

test("画面の端で向きを変える", () => {
  const game = dropAt(780, 100, [ledge(1, 0, 200, 800)]);
  game.turn(1);
  advance(game, 1);
  assert.equal(game.dir, -1);
  assert.ok(game.x <= BOUNDS.w - game.width / 2);
});

test("作品カードに乗ると集めたことになり、ゴールに乗るとクリアで時間が止まる", () => {
  const game = dropAt(400, 100, [ledge(1, 300, 200, 200, "card"), ledge(2, 0, 300, 800, "goal")]);
  const landed = [];
  game.onLand = (l) => landed.push(l.id);
  advance(game, 0.5);
  assert.deepEqual([...game.cards], [1]);
  assert.equal(game.cardCount, 1);
  game.drop(); // カードはすり抜けられる
  advance(game, 1);
  assert.equal(game.phase, "clear");
  const time = game.time;
  advance(game, 1);
  assert.equal(game.time, time);
  assert.equal(game.y, 300);
  assert.deepEqual(landed.slice(0, 2), [1, 2]);
});

test("トランポリンに落ちると、ゴールより上まで跳ね上がる", () => {
  const game = dropAt(100, 1000, [ledge(1, 600, 1500, 100, "goal"), ledge(2, 0, 2000, 800, "bounce")]);
  advance(game, 0.6);
  let top = Infinity;
  for (let i = 0; i < 120; i++) {
    game.step(1 / 60);
    top = Math.min(top, game.y);
  }
  assert.ok(top < 1500 - game.height, `ゴールの上まで届く(最高 ${top})`);
});

test("着地の直前に押したぶんは、着地してすぐ跳ぶ", () => {
  const game = dropAt(400, 290, [ledge(1, 0, 300, 800)]); // 着地の 0.1 秒ほど前
  game.jump();
  advance(game, 0.5);
  assert.ok(game.air || game.y < 300, "跳び直している");
});

test("飛び出した直後はパネルの大きさで、少しずつページの大きさに縮む", () => {
  const game = new PageRun({ x: 400, y: 300, vx: 700, vy: -900, scale: 13 }, DOT, BOUNDS);
  assert.equal(game.scale, 13);
  advance(game, 0.25);
  assert.ok(game.scale < 13 && game.scale > DOT);
  advance(game, 0.5);
  assert.equal(game.scale, DOT);
  assert.equal(game.phase, "run");
});
