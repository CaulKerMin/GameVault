const test = require("node:test");
const assert = require("node:assert/strict");
const Logic = require("../logic.js");

test("minesweeper neighbor calculation respects edges and corners", () => {
  assert.deepEqual(Logic.neighbors(0, 3), [1, 3, 4]);
  assert.deepEqual(Logic.neighbors(4, 3), [0, 1, 2, 3, 5, 6, 7, 8]);
  assert.deepEqual(Logic.neighbors(8, 3), [4, 5, 7]);
  assert.deepEqual(Logic.neighbors(-1, 3), []);
});

test("first click and its surrounding cells are guaranteed safe", () => {
  const first = 27;
  const cells = Logic.createBoard(8, 10, first, () => 0.5);
  const safe = [first, ...Logic.neighbors(first, 8)];
  for (const index of safe) assert.equal(cells[index].mine, false);
  assert.equal(cells.filter((cell) => cell.mine).length, 10);
});

test("mine counts match the actual neighboring mines", () => {
  const cells = Logic.createBoard(8, 10, 0, Math.random);
  cells.forEach((cell, index) => {
    if (!cell.mine) {
      const expected = Logic.neighbors(index, 8).filter((neighbor) => cells[neighbor].mine).length;
      assert.equal(cell.count, expected);
    }
  });
});

test("flood reveal opens connected safe cells but never mines or flags", () => {
  const cells = Logic.createEmptyBoard(3);
  cells[8].mine = true;
  cells[0].count = 0;
  cells[1].count = 1;
  cells[3].count = 1;
  cells[4].count = 1;
  cells[4].flagged = true;
  const revealed = Logic.revealArea(cells, 0, 3);
  assert.ok(revealed > 0);
  assert.equal(cells[0].revealed, true);
  assert.equal(cells[4].revealed, false);
  assert.equal(cells[8].revealed, false);
});

test("flag counts and win detection use safe revealed cells", () => {
  const cells = Logic.createEmptyBoard(2);
  cells[0].mine = true;
  cells[1].revealed = true;
  cells[2].revealed = true;
  cells[3].revealed = true;
  cells[0].flagged = true;
  assert.equal(Logic.countFlags(cells), 1);
  assert.equal(Logic.isWon(cells, 1), true);
  cells[3].revealed = false;
  assert.equal(Logic.isWon(cells, 1), false);
});

test("minesweeper rejects impossible board configurations", () => {
  assert.throws(() => Logic.createBoard(2, 4, 0), RangeError);
  assert.throws(() => Logic.createBoard(2, 2, 0), RangeError);
  assert.throws(() => Logic.createBoard(8, 10, 64), RangeError);
});
