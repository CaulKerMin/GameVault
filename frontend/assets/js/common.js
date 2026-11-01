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
  const recentWrap = document.querySelector("[data-recent-wrap]");
  if (recentNode && recentWrap) {
    let recent = "";
    let recentAt = "";
    try {
      recent = localStorage.getItem("gamevault.lastGame") || "";
      recentAt = localStorage.getItem("gamevault.lastGameAt") || "";
    } catch { /* optional storage */ }
    const destinations = {
      snake: { label: "继续贪吃蛇", href: "games/snake/index.html", icon: "🐍", className: "is-snake" },
      "2048": { label: "继续挑战 2048", href: "games/2048/index.html", icon: "🔢", className: "is-2048" },
      minesweeper: { label: "继续扫雷", href: "games/minesweeper/index.html", icon: "💣", className: "is-minesweeper" }
    };
    const destination = destinations[recent];
    if (destination) {
      const recentTitle = recentNode.querySelector("[data-recent-game-title]");
      const recentIcon = recentNode.querySelector("[data-recent-game-icon]");
      const recentTime = recentNode.querySelector("[data-recent-game-time]");
      if (recentTitle) recentTitle.textContent = destination.label;
      if (recentIcon) {
        recentIcon.textContent = destination.icon;
        recentIcon.classList.add(destination.className);
      }
      if (recentTime) {
        const date = new Date(recentAt);
        if (recentAt && Number.isFinite(date.getTime())) {
          const clock = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const dayLabel = date.toDateString() === today.toDateString()
            ? "今天"
            : date.toDateString() === yesterday.toDateString()
              ? "昨天"
              : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
          recentTime.textContent = `上次游玩：${dayLabel} ${clock}`;
        } else {
          recentTime.textContent = "回到上次游玩的游戏，继续挑战新纪录";
        }
      }
      recentNode.href = destination.href;
      recentNode.addEventListener("click", () => {
        try {
          localStorage.setItem("gamevault.lastGame", recent);
          localStorage.setItem("gamevault.lastGameAt", new Date().toISOString());
        } catch { /* optional storage */ }
      });
      recentWrap.hidden = false;
    }
  }

  const leaderboard = document.querySelector("[data-home-leaderboard]");
  if (leaderboard && window.GameVaultApi) {
    const gameMeta = {
      snake: { label: "贪吃蛇", icon: "🐍" },
      "2048": { label: "2048", icon: "🔢" },
      minesweeper: { label: "扫雷", icon: "💣" }
    };
    const appendStatus = (mode, pending = 0) => {
      const status = document.createElement("div");
      status.className = `leaderboard-status is-${mode}`;
      status.setAttribute("role", "status");
      const dot = document.createElement("span");
      dot.className = "leaderboard-status-dot";
      dot.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      copy.textContent = mode === "server"
        ? `共享排行榜已连接${pending ? ` · ${pending} 条记录待同步` : ""}`
        : mode === "offline"
          ? `API 暂不可用，当前显示本机记录${pending ? ` · ${pending} 条待同步` : ""}`
          : "当前显示本机记录 · 配置 API 后可跨设备共享";
      status.append(dot, copy);
      leaderboard.append(status);
    };
    const showEmpty = (title, description) => {
      const empty = document.createElement("div");
      empty.className = "leaderboard-empty";
      const icon = document.createElement("span");
      icon.className = "leaderboard-empty-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "🏆";
      const heading = document.createElement("strong");
      heading.textContent = title;
      const copy = document.createElement("p");
      copy.textContent = description;
      empty.append(icon, heading, copy);
      leaderboard.append(empty);
    };

    Promise.all(Object.keys(gameMeta).map(async (game) => ({
      game,
      entries: await window.GameVaultApi.getLeaderboard(game, 3)
    }))).then((groups) => {
      leaderboard.replaceChildren();
      const syncStatus = window.GameVaultApi.getSyncStatus?.();
      const mode = syncStatus?.mode === "server" ? "server" : syncStatus?.mode === "offline" ? "offline" : "local";
      appendStatus(mode, syncStatus?.pending || 0);
      const any = groups.some((group) => group.entries.length);
      if (!any) {
        showEmpty("还没有成绩", "完成一局游戏，你的最佳成绩就会出现在这里。 ");
        return;
      }
      groups.forEach(({ game, entries }) => {
        if (!entries.length) return;
        const section = document.createElement("section");
        section.className = "mini-leaderboard-group";
        const header = document.createElement("div");
        header.className = "leaderboard-group-heading";
        const gameIcon = document.createElement("span");
        gameIcon.className = "leaderboard-game-icon";
        gameIcon.setAttribute("aria-hidden", "true");
        gameIcon.textContent = gameMeta[game].icon;
        const heading = document.createElement("h3");
        heading.textContent = gameMeta[game].label;
        const tag = document.createElement("span");
        tag.className = "leaderboard-group-tag";
        tag.textContent = "TOP 3";
        header.append(gameIcon, heading, tag);
        section.append(header);
        entries.forEach((entry, index) => {
          const row = document.createElement("div");
          row.className = `leaderboard-row rank-${index + 1}`;
          const rank = document.createElement("span");
          rank.className = "leaderboard-rank";
          rank.textContent = String(index + 1).padStart(2, "0");
          const name = document.createElement("span");
          name.className = "leaderboard-player";
          name.textContent = entry.name || "匿名玩家";
          const score = document.createElement("strong");
          score.className = "leaderboard-score";
          const numericScore = Number(entry.score);
          score.textContent = (Number.isFinite(numericScore) ? numericScore : 0).toLocaleString("zh-CN");
          row.append(rank, name, score);
          section.append(row);
        });
        leaderboard.append(section);
      });
    }).catch(() => {
      leaderboard.replaceChildren();
      appendStatus("offline");
      showEmpty("暂时无法读取记录", "你的游戏仍可正常游玩，请稍后刷新查看排行榜。");
    }).finally(() => leaderboard.setAttribute("aria-busy", "false"));
  }

  document.querySelectorAll("[data-last-game]").forEach((node) => {
    node.addEventListener("click", () => {
      const game = node.dataset.lastGame;
      try {
        localStorage.setItem("gamevault.lastGame", game);
        localStorage.setItem("gamevault.lastGameAt", new Date().toISOString());
      } catch { /* optional */ }
    });
  });
})();
