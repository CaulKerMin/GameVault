(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GameVaultSnakeLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIRECTIONS = Object.freeze({
    up: Object.freeze([0, -1]),
    down: Object.freeze([0, 1]),
    left: Object.freeze([-1, 0]),
    right: Object.freeze([1, 0])
  });

  function opposite(a, b) {
    return Boolean(a && b && a[0] === -b[0] && a[1] === -b[1]);
  }

  function canChangeDirection(current, queued, candidate) {
    if (!Array.isArray(candidate) || candidate.length !== 2) return false;
    if (!Array.isArray(current) || !Array.isArray(queued)) return false;
    return !opposite(candidate, current) && !opposite(candidate, queued);
  }

  function getEmptyCells(snake, size = 20) {
    const occupied = new Set(snake.map(([x, y]) => `${x},${y}`));
    const empty = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!occupied.has(`${x},${y}`)) empty.push([x, y]);
      }
    }
    return empty;
  }

  function spawnFood(snake, size = 20, random = Math.random) {
    const empty = getEmptyCells(snake, size);
    if (!empty.length) return null;
    const sample = Number(random());
    const safeSample = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0;
    return empty[Math.floor(safeSample * empty.length)];
  }

  function step(snake, direction, food, size = 20) {
    if (!Array.isArray(snake) || !snake.length) throw new TypeError("Snake must contain at least one segment");
    if (!Array.isArray(direction) || direction.length !== 2) throw new TypeError("Direction must be a coordinate pair");
    const head = [snake[0][0] + direction[0], snake[0][1] + direction[1]];
    const eating = Boolean(food && head[0] === food[0] && head[1] === food[1]);
    // Moving into the current tail is safe when the tail moves away this tick.
    const collisionBody = eating ? snake : snake.slice(0, -1);
    const collision = head[0] < 0 || head[1] < 0 || head[0] >= size || head[1] >= size ||
      collisionBody.some(([x, y]) => x === head[0] && y === head[1]);
    if (collision) return { collision: true, head, eating: false, snake: snake.slice(), won: false };
    const nextSnake = [head, ...(eating ? snake : snake.slice(0, -1))];
    return { collision: false, head, eating, snake: nextSnake, won: nextSnake.length === size * size };
  }

  return { DIRECTIONS, canChangeDirection, getEmptyCells, spawnFood, step };
});
