(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector("[data-theme-toggle]");
  let savedTheme = "dark";
  try { savedTheme = localStorage.getItem("gamevault.theme") || "dark"; } catch { /* storage optional */ }
  root.dataset.theme = savedTheme === "light" ? "light" : "dark";

  function updateThemeButton() {
    if (!themeButton) return;
    const light = root.dataset.theme === "light";
    themeButton.textContent = light ? "☾" : "☼";
    themeButton.setAttribute("aria-label", light ? "切换深色主题" : "切换浅色主题");
    themeButton.title = light ? "切换深色主题" : "切换浅色主题";
  }
  updateThemeButton();
  themeButton?.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("gamevault.theme", root.dataset.theme); } catch { /* storage optional */ }
    updateThemeButton();
  });

  document.querySelectorAll("[data-year]").forEach((node) => node.textContent = String(new Date().getFullYear()));
  const search = document.querySelector("[data-game-search]");
  const cards = [...document.querySelectorAll("[data-game-card]")];
  const emptyState = document.querySelector("[data-empty-state]");
  search?.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const haystack = `${card.dataset.gameCard} ${card.textContent}`.toLocaleLowerCase();
      const match = haystack.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    });
    if (emptyState) emptyState.hidden = visible !== 0;
  });

  const playsNode = document.querySelector("[data-total-plays]");
  if (playsNode) playsNode.textContent = String(window.GameVaultApi?.getPlayStats().total || 0);

  const recentNode = document.querySelector("[data-recent-game]");
  if (recentNode) {
    let recent = "";
    try { recent = localStorage.getItem("gamevault.lastGame") || ""; } catch { /* optional */ }
    const destinations = {
      snake: { label: "继续贪吃蛇", href: "games/snake/index.html" },
      "2048": { label: "继续挑战 2048", href: "games/2048/index.html" },
      minesweeper: { label: "继续扫雷", href: "games/minesweeper/index.html" }
    };
    if (destinations[recent]) {
      const recentTitle = recentNode.querySelector("[data-recent-game-title]");
      if (recentTitle) recentTitle.textContent = destinations[recent].label;
      else recentNode.textContent = destinations[recent].label;
      recentNode.href = destinations[recent].href;
      recentNode.hidden = false;
    }
  }

  const leaderboard = document.querySelector("[data-home-leaderboard]");
  if (leaderboard && window.GameVaultApi) {
    const gameNames = { snake: "贪吃蛇", "2048": "2048", minesweeper: "扫雷" };
    Promise.all(Object.keys(gameNames).map(async (game) => ({
      game,
      entries: await window.GameVaultApi.getLeaderboard(game, 3)
    }))).then((groups) => {
      leaderboard.replaceChildren();
      const syncStatus = window.GameVaultApi.getSyncStatus?.();
      const statusNote = document.createElement("p");
      statusNote.className = "muted small-copy";
      statusNote.textContent = syncStatus?.mode === "server"
        ? `共享排行榜已连接${syncStatus.pending ? `，${syncStatus.pending} 条记录待同步` : ""}`
        : syncStatus?.mode === "offline"
          ? `排行榜 API 暂不可用，正在显示本机记录${syncStatus.pending ? `（${syncStatus.pending} 条待同步）` : ""}`
          : "本机排行榜；部署并配置 API 后可跨设备共享成绩";
      leaderboard.append(statusNote);
      const any = groups.some((group) => group.entries.length);
      if (!any) {
        const empty = document.createElement("p");
        empty.className = "muted small-copy";
        empty.textContent = "开始一局游戏，你的成绩就会显示在这里。";
        leaderboard.append(empty);
        return;
      }
      groups.forEach(({ game, entries }) => {
        if (!entries.length) return;
        const section = document.createElement("section");
        section.className = "mini-leaderboard-group";
        const heading = document.createElement("h3");
        heading.textContent = gameNames[game];
        section.append(heading);
        entries.forEach((entry, index) => {
          const row = document.createElement("div");
          row.className = "leaderboard-row";
          const name = document.createElement("span");
          name.textContent = `${index + 1}. ${entry.name || "匿名玩家"}`;
          const score = document.createElement("strong");
          score.textContent = Number(entry.score || 0).toLocaleString("zh-CN");
          row.append(name, score);
          section.append(row);
        });
        leaderboard.append(section);
      });
    });
  }

  document.querySelectorAll("[data-last-game]").forEach((node) => {
    node.addEventListener("click", () => {
      const game = node.dataset.lastGame;
      try { localStorage.setItem("gamevault.lastGame", game); } catch { /* optional */ }
    });
  });
})();
