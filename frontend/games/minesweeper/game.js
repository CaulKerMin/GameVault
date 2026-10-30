(() => {
  const boardNode = document.getElementById("mine-board");
  if (!boardNode) return;
  const Logic = window.GameVaultMinesweeperLogic;
  if (!Logic) throw new Error("Minesweeper logic module failed to load");
  const SIZE = 8;
  const MINE_COUNT = 10;
  const flagsNode = document.getElementById("flags-left");
  const timerNode = document.getElementById("timer");
  const bestTimeNode = document.getElementById("best-time");
  const statusNode = document.getElementById("status-pill");
  const messageNode = document.getElementById("game-message");
  const flagModeButton = document.getElementById("flag-mode-button");
  const leaderboardNode = document.getElementById("leaderboard");
  let cells = [];
  let started = false;
  let gameOver = false;
  let flagMode = false;
  let elapsed = 0;
  let timerId = null;
  let bestTime = null;
  let hitMine = -1;
  let focusIndex = 0;

  try {
    const rawBestTime = localStorage.getItem("gamevault.bestTime.minesweeper");
    const stored = rawBestTime === null ? NaN : Number(rawBestTime);
    bestTime = Number.isFinite(stored) && stored >= 0 ? stored : null;
  } catch { bestTime = null; }
  bestTimeNode.textContent = bestTime !== null ? formatTime(bestTime) : "—";

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }
  function setStatus(label, state) {
    statusNode.textContent = label;
    statusNode.dataset.state = state;
  }
  function newGame() {
    clearInterval(timerId);
    cells = Logic.createEmptyBoard(SIZE);
    started = false;
    gameOver = false;
    flagMode = false;
    elapsed = 0;
    hitMine = -1;
    focusIndex = 0;
    timerNode.textContent = "00:00";
    flagsNode.textContent = String(MINE_COUNT);
    flagModeButton.setAttribute("aria-pressed", "false");
    flagModeButton.textContent = "🚩 插旗模式：关闭";
    setStatus("等待第一次点击", "ready");
    messageNode.textContent = "第一步会自动避开雷区，放心点开任意格子。";
    renderBoard();
  }
  function neighbors(index) {
    return Logic.neighbors(index, SIZE);
  }
  function initializeMines(firstIndex) {
    cells = Logic.createBoard(SIZE, MINE_COUNT, firstIndex);
    started = true;
    window.GameVaultApi?.recordPlay("minesweeper");
    setStatus("正在扫雷", "playing");
    timerId = setInterval(() => {
      if (gameOver) return;
      elapsed += 1;
      timerNode.textContent = formatTime(elapsed);
    }, 1000);
  }
  function reveal(index) {
    if (gameOver || cells[index].revealed || cells[index].flagged) return;
    if (!started) initializeMines(index);
    const cell = cells[index];
    if (cell.mine) {
      hitMine = index;
      endGame(false);
      renderBoard();
      return;
    }
    Logic.revealArea(cells, index, SIZE);
    renderBoard();
    if (Logic.isWon(cells, MINE_COUNT)) endGame(true);
  }
  function toggleFlag(index) {
    if (gameOver || cells[index].revealed) return;
    const currentFlagCount = Logic.countFlags(cells);
    if (!cells[index].flagged && currentFlagCount >= MINE_COUNT) {
      messageNode.textContent = `最多标记 ${MINE_COUNT} 个格子；先取消一面旗帜再继续。`;
      return;
    }
    cells[index].flagged = !cells[index].flagged;
    const flagCount = Logic.countFlags(cells);
    flagsNode.textContent = String(MINE_COUNT - flagCount);
    if (messageNode.textContent.startsWith("最多标记")) {
      messageNode.textContent = flagMode ? "插旗模式已开启：点击格子标记或取消标记地雷。" : "点击格子揭开区域。";
    }
    renderBoard();
  }
  async function endGame(won) {
    if (gameOver) return;
    gameOver = true;
    clearInterval(timerId);
    if (won) {
      setStatus("成功通关！", "won");
      messageNode.textContent = `漂亮！你用了 ${formatTime(elapsed)} 找出所有安全区域。`;
      if (bestTime === null || elapsed < bestTime) {
        bestTime = elapsed;
        bestTimeNode.textContent = formatTime(bestTime);
        try { localStorage.setItem("gamevault.bestTime.minesweeper", String(bestTime)); } catch { /* optional */ }
      }
      const score = Math.max(100, 10000 - elapsed * 25);
      const result = await window.GameVaultApi?.submitScore("minesweeper", score);
      renderLeaderboard(result?.synced ? "通关成绩已同步到排行榜" : "通关成绩已保存到本机");
    } else {
      setStatus("踩到地雷", "over");
      messageNode.textContent = "轰！这次踩到地雷了。观察数字线索，再来挑战一次吧。";
    }
    renderBoard();
  }
  function renderBoard() {
    const restoreFocus = boardNode.contains(document.activeElement);
    boardNode.replaceChildren();
    const flagCount = Logic.countFlags(cells);
    flagsNode.textContent = String(MINE_COUNT - flagCount);
    cells.forEach((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mine-cell";
      button.dataset.index = String(index);
      button.tabIndex = index === focusIndex ? 0 : -1;
      button.setAttribute("aria-label", describeCell(cell, index));
      if (cell.revealed) {
        button.classList.add("revealed");
        if (cell.mine) {
          button.textContent = "💣";
          if (index === hitMine) button.classList.add("mine-hit");
        } else if (cell.count > 0) {
          button.textContent = String(cell.count);
          button.classList.add(`n${cell.count}`);
        } else button.textContent = "";
      } else if (cell.flagged) {
        button.textContent = "🚩";
        button.classList.add("flagged");
        button.setAttribute("aria-label", `第 ${Math.floor(index / SIZE) + 1} 行第 ${index % SIZE + 1} 列，已插旗`);
      } else if (gameOver && cell.mine) {
        button.textContent = "💣";
        button.classList.add("revealed");
        button.disabled = true;
      } else {
        button.textContent = "";
        if (gameOver) button.disabled = true;
      }
      if (gameOver) button.disabled = true;
      boardNode.append(button);
    });
    if (restoreFocus) boardNode.querySelector(`[data-index="${focusIndex}"]`)?.focus();
  }
  function describeCell(cell, index) {
    const row = Math.floor(index / SIZE) + 1;
    const col = index % SIZE + 1;
    if (cell.flagged) return `第 ${row} 行第 ${col} 列，已插旗`;
    if (!cell.revealed) return `第 ${row} 行第 ${col} 列，未揭开`;
    if (cell.mine) return `第 ${row} 行第 ${col} 列，地雷`;
    return `第 ${row} 行第 ${col} 列，周围 ${cell.count} 个地雷`;
  }
  async function renderLeaderboard(note = "") {
    if (!leaderboardNode || !window.GameVaultApi) return;
    const entries = await window.GameVaultApi.getLeaderboard("minesweeper", 8);
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
      const empty = document.createElement("p"); empty.className = "muted small-copy"; empty.textContent = "还没有通关记录，来拿下第一名吧！"; leaderboardNode.append(empty); return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement("div"); row.className = "leaderboard-row";
      const name = document.createElement("span"); name.textContent = `${index + 1}. ${entry.name || "匿名玩家"}`;
      const score = document.createElement("strong"); score.textContent = Number(entry.score || 0).toLocaleString("zh-CN");
      row.append(name, score); leaderboardNode.append(row);
    });
  }
  boardNode.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    const index = Number(button.dataset.index);
    focusIndex = index;
    if (flagMode) toggleFlag(index); else reveal(index);
  });
  boardNode.addEventListener("contextmenu", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    event.preventDefault();
    focusIndex = Number(button.dataset.index);
    toggleFlag(focusIndex);
  });
  boardNode.addEventListener("keydown", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    let target = index;
    if (event.key === "ArrowUp" && row > 0) target -= SIZE;
    else if (event.key === "ArrowDown" && row < SIZE - 1) target += SIZE;
    else if (event.key === "ArrowLeft" && col > 0) target -= 1;
    else if (event.key === "ArrowRight" && col < SIZE - 1) target += 1;
    else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      focusIndex = index;
      toggleFlag(index);
      return;
    } else return;
    event.preventDefault();
    focusIndex = target;
    boardNode.querySelector(`[data-index="${target}"]`)?.focus();
  });
  flagModeButton.addEventListener("click", () => {
    if (gameOver) return;
    flagMode = !flagMode;
    flagModeButton.setAttribute("aria-pressed", String(flagMode));
    flagModeButton.textContent = flagMode ? "🚩 插旗模式：开启" : "🚩 插旗模式：关闭";
    messageNode.textContent = flagMode ? "插旗模式已开启：点击格子标记或取消标记地雷。" : "插旗模式已关闭：点击格子揭开区域。";
  });
  document.getElementById("new-game-button").addEventListener("click", newGame);
  document.getElementById("reset-button").addEventListener("click", newGame);
  newGame();
  renderLeaderboard();
})();
