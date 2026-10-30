(() => {
  const boardNode = document.getElementById("puzzle-board");
  if (!boardNode) return;
  const Logic = window.GameVault2048Logic;
  if (!Logic) throw new Error("2048 logic module failed to load");
  const scoreNode = document.getElementById("score");
  const bestNode = document.getElementById("best-score");
  const statusNode = document.getElementById("status-pill");
  const messageNode = document.getElementById("puzzle-message");
  const undoButton = document.getElementById("undo-button");
  const leaderboardNode = document.getElementById("leaderboard");
  let board = Array(16).fill(0);
  let score = 0;
  let best = 0;
  let snapshot = null;
  let hasReachedTarget = false;
  let submitted = false;
  let hasRecordedPlay = false;
  let gameOver = false;
  let touchStart = null;
  try { best = Number(localStorage.getItem("gamevault.best.2048")) || 0; } catch { best = 0; }
  bestNode.textContent = best.toLocaleString("zh-CN");

  function spawnTile() {
    const result = Logic.spawnTile(board);
    board = result.board;
    return result.spawned;
  }
  function reset() {
    board = Array(16).fill(0);
    score = 0;
    snapshot = null;
    hasReachedTarget = false;
    submitted = false;
    hasRecordedPlay = false;
    gameOver = false;
    spawnTile(); spawnTile();
    undoButton.disabled = true;
    statusNode.textContent = "游戏进行中";
    statusNode.dataset.state = "playing";
    messageNode.textContent = "使用方向键或 WASD 移动方块。";
    render();
  }
  function render() {
    boardNode.replaceChildren();
    board.forEach((value, index) => {
      const tile = document.createElement("div");
      tile.className = value ? `tile tile-${value <= 2048 ? value : "super"}` : "tile tile-empty";
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", value ? `第 ${Math.floor(index / 4) + 1} 行第 ${index % 4 + 1} 列，${value}` : "空格");
      tile.textContent = value ? String(value) : "";
      boardNode.append(tile);
    });
    scoreNode.textContent = score.toLocaleString("zh-CN");
    bestNode.textContent = best.toLocaleString("zh-CN");
  }
  function move(direction) {
    if (gameOver) return;
    const result = Logic.moveBoard(board, direction);
    if (!result.changed) return;
    const before = board.slice();
    const beforeScore = score;
    if (!hasRecordedPlay) {
      hasRecordedPlay = true;
      window.GameVaultApi?.recordPlay("2048");
    }
    snapshot = { board: before, score: beforeScore, hasReachedTarget };
    undoButton.disabled = false;
    board = result.board;
    score += result.gained;
    if (score > best) {
      best = score;
      try { localStorage.setItem("gamevault.best.2048", String(best)); } catch { /* optional */ }
    }
    spawnTile();
    render();
    let reachedTargetThisMove = false;
    if (!hasReachedTarget && board.some((value) => value >= 2048)) {
      hasReachedTarget = true;
      reachedTargetThisMove = true;
      messageNode.textContent = "🎉 达成 2048！你可以继续合并，冲击更高分数。";
    }
    if (isGameOver()) {
      finishGame();
    } else if (!reachedTargetThisMove && !hasReachedTarget) {
      messageNode.textContent = result.gained ? `本次合并 +${result.gained} 分，继续！` : "移动成功，继续寻找合并机会。";
    }
  }
  function isGameOver() {
    return Logic.isGameOver(board);
  }
  async function finishGame() {
    gameOver = true;
    statusNode.textContent = "棋盘已满";
    statusNode.dataset.state = "over";
    messageNode.textContent = `游戏结束！最终得分 ${score.toLocaleString("zh-CN")}。重新开始再挑战一次吧。`;
    undoButton.disabled = true;
    snapshot = null;
    if (!submitted) {
      submitted = true;
      const result = await window.GameVaultApi?.submitScore("2048", score);
      renderLeaderboard(result?.synced ? "成绩已同步到排行榜" : "成绩已保存到本机");
    }
  }
  function undo() {
    if (!snapshot || gameOver) return;
    board = snapshot.board;
    score = snapshot.score;
    hasReachedTarget = snapshot.hasReachedTarget;
    snapshot = null;
    undoButton.disabled = true;
    statusNode.textContent = "游戏进行中";
    statusNode.dataset.state = "playing";
    messageNode.textContent = "已撤销上一步。";
    render();
  }
  async function renderLeaderboard(note = "") {
    if (!leaderboardNode || !window.GameVaultApi) return;
    const entries = await window.GameVaultApi.getLeaderboard("2048", 8);
    leaderboardNode.replaceChildren();
    const syncStatus = window.GameVaultApi.getSyncStatus?.();
    const pendingText = syncStatus?.pending ? `（${syncStatus.pending} 条待同步）` : "";
    const statusNote = note || (syncStatus?.mode === "server"
      ? `已连接共享排行榜${pendingText}`
      : syncStatus?.mode === "offline"
        ? `API 暂不可用，当前显示本机记录${pendingText}`
        : "当前使用本机排行榜；部署 API 后可启用共享记录");
    if (statusNote) {
      const noteNode = document.createElement("p"); noteNode.className = "muted small-copy"; noteNode.textContent = statusNote; leaderboardNode.append(noteNode);
    }
    if (!entries.length) {
      const empty = document.createElement("p"); empty.className = "muted small-copy"; empty.textContent = "还没有成绩，来拿下第一名吧！"; leaderboardNode.append(empty); return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement("div"); row.className = "leaderboard-row";
      const name = document.createElement("span"); name.textContent = `${index + 1}. ${entry.name || "匿名玩家"}`;
      const scoreLabel = document.createElement("strong"); scoreLabel.textContent = Number(entry.score || 0).toLocaleString("zh-CN");
      row.append(name, scoreLabel); leaderboardNode.append(row);
    });
  }
  function handleKey(event) {
    if (event.target.closest?.("button, a, input, textarea, select, [contenteditable='true']")) return;
    const map = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    if (map[event.key]) { event.preventDefault(); move(map[event.key]); }
  }
  document.addEventListener("keydown", handleKey);
  document.querySelectorAll("[data-move]").forEach((button) => button.addEventListener("click", () => move(button.dataset.move)));
  document.getElementById("restart-button").addEventListener("click", reset);
  document.getElementById("restart-secondary").addEventListener("click", reset);
  undoButton.addEventListener("click", undo);
  boardNode.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0]; touchStart = [touch.clientX, touch.clientY];
  }, { passive: true });
  boardNode.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart[0];
    const dy = touch.clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }, { passive: true });
  reset();
  renderLeaderboard();
})();
