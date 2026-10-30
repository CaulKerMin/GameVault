const test = require("node:test");
const assert = require("node:assert/strict");
const Logic = require("../logic.js");

test("snake blocks direct reversal but permits perpendicular turns", () => {
  const right = Logic.DIRECTIONS.right;
  const left = Logic.DIRECTIONS.left;
  const up = Logic.DIRECTIONS.up;
  assert.equal(Logic.canChangeDirection(right, right, left), false);
  assert.equal(Logic.canChangeDirection(right, up, left), false);
  assert.equal(Logic.canChangeDirection(right, right, up), true);
});

test("snake moves one cell without growing when it misses food", () => {
  const snake = [[2, 2], [1, 2], [0, 2]];
  const result = Logic.step(snake, [1, 0], [7, 7], 8);
  assert.equal(result.collision, false);
  assert.equal(result.eating, false);
  assert.deepEqual(result.snake, [[3, 2], [2, 2], [1, 2]]);
});

test("snake grows when it eats food", () => {
  const snake = [[2, 2], [1, 2], [0, 2]];
  const result = Logic.step(snake, [1, 0], [3, 2], 8);
  assert.equal(result.eating, true);
  assert.equal(result.snake.length, 4);
  assert.deepEqual(result.snake[0], [3, 2]);
});

test("snake can move into the tail cell when the tail moves away", () => {
  const snake = [[1, 1], [1, 2], [2, 2], [2, 1]];
  const result = Logic.step(snake, [1, 0], [7, 7], 4);
  assert.equal(result.collision, false);
  assert.deepEqual(result.snake[0], [2, 1]);
});

test("snake detects wall and body collisions", () => {
  assert.equal(Logic.step([[3, 1], [2, 1]], [1, 0], [0, 0], 4).collision, true);
  assert.equal(Logic.step([[1, 1], [2, 1], [2, 2]], [1, 0], [7, 7], 4).collision, true);
});

test("snake food always occupies an empty cell and returns null on a full board", () => {
  const snake = [[0, 0], [1, 0], [0, 1]];
  const food = Logic.spawnFood(snake, 2, () => 0.99);
  assert.deepEqual(food, [1, 1]);
  assert.equal(Logic.spawnFood([[0, 0], [1, 0], [0, 1], [1, 1]], 2), null);
});

test("snake reports a win when its body fills the board", () => {
  const snake = [[1, 1], [0, 1], [0, 0]];
  const result = Logic.step(snake, [0, -1], [1, 0], 2);
  assert.equal(result.collision, false);
  assert.equal(result.won, true);
  assert.equal(result.snake.length, 4);
});
