(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GameVault2048Logic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIRECTIONS = new Set(["left", "right", "up", "down"]);

  function positionsFor(direction, line) {
    if (!DIRECTIONS.has(direction)) throw new RangeError(`Unknown direction: ${direction}`);
    if (!Number.isInteger(line) || line < 0 || line > 3) throw new RangeError("Line must be between 0 and 3");
    const positions = [];
    for (let step = 0; step < 4; step++) {
      if (direction === "left") positions.push(line * 4 + step);
      else if (direction === "right") positions.push(line * 4 + (3 - step));
      else if (direction === "up") positions.push(step * 4 + line);
      else positions.push((3 - step) * 4 + line);
    }
    return positions;
  }

  function moveBoard(board, direction) {
    if (!Array.isArray(board) || board.length !== 16) throw new TypeError("A 2048 board must contain 16 cells");
    if (!DIRECTIONS.has(direction)) throw new RangeError(`Unknown direction: ${direction}`);
    const before = board.slice();
    const next = board.slice();
    let gained = 0;

    for (let line = 0; line < 4; line++) {
      const positions = positionsFor(direction, line);
      const values = positions.map((index) => before[index]).filter((value) => value > 0);
      const merged = [];
      for (let i = 0; i < values.length; i++) {
        if (values[i] === values[i + 1]) {
          const value = values[i] * 2;
          merged.push(value);
          gained += value;
          i++;
        } else merged.push(values[i]);
      }
      while (merged.length < 4) merged.push(0);
      positions.forEach((index, i) => { next[index] = merged[i]; });
    }

    return {
      board: next,
      gained,
      changed: next.some((value, index) => value !== before[index])
    };
  }

  function spawnTile(board, random = Math.random) {
    if (!Array.isArray(board) || board.length !== 16) throw new TypeError("A 2048 board must contain 16 cells");
    const next = board.slice();
    const empty = [];
    next.forEach((value, index) => { if (value === 0) empty.push(index); });
    if (!empty.length) return { board: next, spawned: false, index: -1, value: 0 };
    const indexSample = Number(random());
    const valueSample = Number(random());
    const safeIndexSample = Number.isFinite(indexSample) ? Math.min(Math.max(indexSample, 0), 0.999999999999) : 0;
    const safeValueSample = Number.isFinite(valueSample) ? Math.min(Math.max(valueSample, 0), 0.999999999999) : 0;
    const index = empty[Math.floor(safeIndexSample * empty.length)];
    const value = safeValueSample < 0.9 ? 2 : 4;
    next[index] = value;
    return { board: next, spawned: true, index, value };
  }

  function isGameOver(board) {
    if (!Array.isArray(board) || board.length !== 16) throw new TypeError("A 2048 board must contain 16 cells");
    if (board.some((value) => value === 0)) return false;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const value = board[row * 4 + col];
        if (col < 3 && value === board[row * 4 + col + 1]) return false;
        if (row < 3 && value === board[(row + 1) * 4 + col]) return false;
      }
    }
    return true;
  }

  return { positionsFor, moveBoard, spawnTile, isGameOver };
});
