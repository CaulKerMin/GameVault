(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GameVaultMinesweeperLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createEmptyBoard(size = 8) {
    return Array.from({ length: size * size }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }));
  }

  function neighbors(index, size = 8) {
    if (!Number.isInteger(index) || index < 0 || index >= size * size) return [];
    const row = Math.floor(index / size);
    const col = index % size;
    const result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = row + dr;
        const cc = col + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) result.push(rr * size + cc);
      }
    }
    return result;
  }

  function createBoard(size = 8, mineCount = 10, firstIndex = 0, random = Math.random) {
    if (!Number.isInteger(size) || size < 2) throw new RangeError("Board size must be an integer greater than 1");
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount >= size * size) throw new RangeError("Mine count is out of range");
    if (!Number.isInteger(firstIndex) || firstIndex < 0 || firstIndex >= size * size) throw new RangeError("First cell is out of range");

    const cells = createEmptyBoard(size);
    const safe = new Set([firstIndex, ...neighbors(firstIndex, size)]);
    const available = cells.map((_, index) => index).filter((index) => !safe.has(index));
    if (mineCount > available.length) throw new RangeError("Mine count is too large to guarantee a safe first click");
    for (let i = available.length - 1; i > 0; i--) {
      const sample = Number(random());
      const safeSample = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0;
      const j = Math.floor(safeSample * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    available.slice(0, mineCount).forEach((index) => { cells[index].mine = true; });
    cells.forEach((cell, index) => {
      if (!cell.mine) cell.count = neighbors(index, size).filter((neighbor) => cells[neighbor].mine).length;
    });
    return cells;
  }

  function revealArea(cells, index, size = 8) {
    if (!Array.isArray(cells) || cells.length !== size * size) throw new TypeError("Board dimensions do not match");
    if (!Number.isInteger(index) || index < 0 || index >= cells.length) return 0;
    const first = cells[index];
    if (first.revealed || first.flagged || first.mine) return 0;
    const queue = [index];
    const queued = new Set(queue);
    let revealed = 0;
    while (queue.length) {
      const current = queue.pop();
      const target = cells[current];
      if (target.revealed || target.flagged || target.mine) continue;
      target.revealed = true;
      revealed++;
      if (target.count === 0) {
        neighbors(current, size).forEach((neighbor) => {
          const cell = cells[neighbor];
          if (!cell.revealed && !cell.flagged && !cell.mine && !queued.has(neighbor)) {
            queued.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
    return revealed;
  }

  function countFlags(cells) {
    return cells.reduce((total, cell) => total + (cell.flagged ? 1 : 0), 0);
  }

  function isWon(cells, mineCount) {
    return cells.filter((cell) => cell.revealed && !cell.mine).length === cells.length - mineCount;
  }

  return { createEmptyBoard, neighbors, createBoard, revealArea, countFlags, isWon };
});
