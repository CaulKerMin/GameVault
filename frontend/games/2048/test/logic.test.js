const test = require("node:test");
const assert = require("node:assert/strict");
const Logic = require("../logic.js");

test("2048 merges each pair only once in a move", () => {
  const board = [2, 2, 2, 2, ...Array(12).fill(0)];
  const result = Logic.moveBoard(board, "left");
  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.equal(result.gained, 8);
  assert.equal(result.changed, true);
});

test("2048 does not cascade a newly merged tile during the same move", () => {
  const board = [2, 2, 4, 0, ...Array(12).fill(0)];
  const result = Logic.moveBoard(board, "left");
  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.equal(result.gained, 4);
});

test("2048 supports all four directions", () => {
  const board = [2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(Logic.moveBoard(board, "up").board.slice(0, 4), [4, 0, 0, 0]);
  assert.deepEqual(Logic.moveBoard(board, "down").board.slice(12, 16), [4, 0, 0, 0]);
  assert.deepEqual(Logic.moveBoard([2, 0, 0, 2, ...Array(12).fill(0)], "right").board.slice(0, 4), [0, 0, 0, 4]);
});

test("2048 leaves a board unchanged for a no-op move", () => {
  const board = [2, 4, 8, 16, ...Array(12).fill(0)];
  const result = Logic.moveBoard(board, "left");
  assert.equal(result.changed, false);
  assert.deepEqual(result.board, board);
  assert.equal(result.gained, 0);
});

test("2048 detects full boards with and without legal merges", () => {
  assert.equal(Logic.isGameOver(Array.from({ length: 16 }, (_, i) => 2 ** (i + 1))), true);
  assert.equal(Logic.isGameOver([2, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]), false);
  assert.equal(Logic.isGameOver([2, ...Array(15).fill(0)]), false);
});

test("2048 spawns 2 or 4 independently of the chosen cell", () => {
  const board = Array(16).fill(0);
  const samples = [0.99, 0.1];
  const result = Logic.spawnTile(board, () => samples.shift());
  assert.equal(result.spawned, true);
  assert.equal(result.index, 15);
  assert.equal(result.value, 2);
  assert.equal(result.board.filter(Boolean).length, 1);
  const four = Logic.spawnTile(board, (() => { const values = [0, 0.99]; return () => values.shift(); })());
  assert.equal(four.value, 4);
});

test("2048 does not spawn a tile on a full board", () => {
  const board = Array(16).fill(2);
  const result = Logic.spawnTile(board, () => 0);
  assert.equal(result.spawned, false);
  assert.deepEqual(result.board, board);
});
