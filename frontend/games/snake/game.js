(() => {
  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;
  const Logic = window.GameVaultSnakeLogic;
  if (!Logic) throw new Error("Snake logic module failed to load");
  const ctx = canvas.getContext("2d");
  const SIZE = 20;
  const CELL = canvas.width / SIZE;
  const scoreNode = document.getElementById("score");
  const bestNode = document.getElementById("best-score");
  const lengthNode = document.getElementById("length");
  const statusNode = document.getElementById("status-pill");
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const overlayStart = document.getElementById("overlay-start");
  const startButton = document.getElementById("start-button");
  const restartButton = document.getElementById("restart-button");
  const pauseButton = document.getElementById("pause-button");
  const leaderboardNode = document.getElementById("leaderboard");
  let snake, direction, nextDirection, food, score, best, state, timer, pointerStart = null, lastSubmitted = -1;

  try { best = Number(localStorage.getItem("gamevault.best.snake")) || 0; } catch { best = 0; }
  bestNode.textContent = String(best);

  function setStatus(label, nextState) {
    statusNode.textContent = label;
    statusNode.dataset.state = nextState;
  }
  function placeFood() {
    food = Logic.spawnFood(snake, SIZE);
    return food !== null;
  }
  function reset() {
    clearInterval(timer);
    snake = [[10, 10], [9, 10], [8, 10]];
    direction = [1, 0];
    nextDirection = [1, 0];
    score = 0;
    state = "ready";
    lastSubmitted = -1;
    placeFood();
    scoreNode.textContent = "0";
    lengthNode.textContent = String(snake.length);
    pauseButton.disabled = true;
    pauseButton.textContent = "Ⅱ 暂停";
    setStatus("准备开始", "ready");
    showOverlay("准备好了吗？", "点击开始，使用方向键或 WASD 控制蛇的移动。", "开始这一局");
    draw();
  }
  function showOverlay(title, copy, buttonText) {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayStart.textContent = buttonText;
    overlay.hidden = false;
  }
  function hideOverlay() { overlay.hidden = true; }
  function start() {
    if (state === "running") return;
    if (state === "paused") { resume(); return; }
    if (state === "over") reset();
    if (state === "ready") window.GameVaultApi?.recordPlay("snake");
    state = "running";
    setStatus("游戏进行中", "playing");
    pauseButton.disabled = false;
    hideOverlay();
    clearInterval(timer);
    timer = setInterval(tick, 115);
    canvas.focus?.();
  }
  function pause() {
    if (state !== "running") return;
    clearInterval(timer);
    state = "paused";
    setStatus("已暂停", "paused");
    pauseButton.textContent = "▶ 继续";
    showOverlay("暂时休息一下", "准备好后继续你的挑战。", "继续游戏");
  }
  function resume() {
    if (state !== "paused") return;
    state = "running";
    setStatus("游戏进行中", "playing");
    pauseButton.textContent = "Ⅱ 暂停";
    hideOverlay();
    clearInterval(timer);
    timer = setInterval(tick, 115);
  }
  function chooseDirection(name) {
    const candidate = Logic.DIRECTIONS[name];
    if (!candidate || !Logic.canChangeDirection(direction, nextDirection, candidate)) return;
    nextDirection = candidate.slice();
    if (state === "ready") start();
  }
  function tick() {
    direction = nextDirection;
    const result = Logic.step(snake, direction, food, SIZE);
    if (result.collision) {
      endGame();
      return;
    }
    snake = result.snake;
    if (result.eating) {
      score += 10;
      scoreNode.textContent = String(score);
      if (score > best) {
        best = score;
        bestNode.textContent = String(best);
        try { localStorage.setItem("gamevault.best.snake", String(best)); } catch { /* optional */ }
      }
      if (result.won || !placeFood()) {
        food = null;
        lengthNode.textContent = String(snake.length);
        draw();
        endGame(true);
        return;
      }
    }
    lengthNode.textContent = String(snake.length);
    draw();
  }
  async function endGame(won = false) {
    clearInterval(timer);
    state = "over";
    setStatus(won ? "完美通关" : "本局结束", won ? "won" : "over");
    pauseButton.disabled = true;
    showOverlay(won ? "完美通关！" : "游戏结束", won ? `你填满了整个棋盘，得分 ${score}！` : `本局得分 ${score}，蛇身长度 ${snake.length}。再来一局刷新纪录吧！`, "再玩一局");
    draw();
    if (lastSubmitted !== score) {
      lastSubmitted = score;
      const result = await window.GameVaultApi?.submitScore("snake", score);
      renderLeaderboard(result?.synced ? "成绩已同步到排行榜" : "成绩已保存到本机");
    }
  }
  function roundRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#101629";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(154, 169, 210, .075)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
    }
    if (food) {
      ctx.fillStyle = "#ff9e6d";
      roundRect(food[0] * CELL + 4, food[1] * CELL + 4, CELL - 8, CELL - 8, 6);
      ctx.fillStyle = "rgba(255, 158, 109, .22)";
      ctx.beginPath(); ctx.arc(food[0] * CELL + CELL / 2, food[1] * CELL + CELL / 2, CELL * .65, 0, Math.PI * 2); ctx.fill();
    }
    snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? "#9b8cff" : `rgba(109, 226, 226, ${Math.max(.35, .88 - index * .015)})`;
      roundRect(part[0] * CELL + 2, part[1] * CELL + 2, CELL - 4, CELL - 4, index === 0 ? 6 : 5);
      if (index === 0) {
        ctx.fillStyle = "#161a30";
        const eyeX = direction[0] === 1 ? 13 : direction[0] === -1 ? 5 : 6;
        const eyeY = direction[1] === 1 ? 13 : direction[1] === -1 ? 5 : 6;
        ctx.beginPath(); ctx.arc(part[0] * CELL + eyeX, part[1] * CELL + eyeY, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(part[0] * CELL + (direction[0] === 0 ? 14 : eyeX), part[1] * CELL + (direction[1] === 0 ? 14 : eyeY), 1.6, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  async function renderLeaderboard(note = "") {
    if (!leaderboardNode || !window.GameVaultApi) return;
    const entries = await window.GameVaultApi.getLeaderboard("snake", 8);
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

  document.addEventListener("keydown", (event) => {
    if (event.target.closest?.("button, a, input, textarea, select, [contenteditable='true']")) return;
    const keyMap = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    if (keyMap[event.key]) { event.preventDefault(); chooseDirection(keyMap[event.key]); }
    if (event.code === "Space") { event.preventDefault(); if (state === "running") pause(); else if (state === "paused") resume(); else start(); }
  });
  document.querySelectorAll("[data-dir]").forEach((button) => button.addEventListener("click", () => chooseDirection(button.dataset.dir)));
  startButton.addEventListener("click", start);
  overlayStart.addEventListener("click", start);
  restartButton.addEventListener("click", () => { reset(); start(); });
  pauseButton.addEventListener("click", () => state === "running" ? pause() : resume());
  canvas.addEventListener("pointerdown", (event) => {
    pointerStart = [event.clientX, event.clientY];
    if (state === "ready") start();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart[0];
    const dy = event.clientY - pointerStart[1];
    pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  canvas.addEventListener("pointercancel", () => { pointerStart = null; });
  reset();
  renderLeaderboard();
})();
