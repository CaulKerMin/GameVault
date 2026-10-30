(() => {
  const LOCAL_KEY = "gamevault.scores.v1";
  const PLAY_KEY = "gamevault.plays.v1";
  const validGames = new Set(["snake", "2048", "minesweeper"]);
  const MAX_SCORE = 10_000_000;
  const MAX_LOCAL_PER_GAME = 100;
  const MAX_PENDING_PER_GAME = 100;
  const configuredBase = (window.GAMEVAULT_CONFIG?.apiBaseUrl || "").trim().replace(/\/+$/, "");
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const apiBase = configuredBase || (localHost ? "http://localhost:3001/api" : "");
  const connection = {
    mode: apiBase ? "unknown" : "local",
    lastError: "",
    lastSuccessAt: null,
  };
  let syncPromise = null;
  let retryTimer = null;
  let nextRetryAt = 0;
  let retryAttempt = 0;

  function makeSubmissionId() {
    try {
      if (window.crypto?.randomUUID) return `sub-${window.crypto.randomUUID()}`;
    } catch { /* fall back for older or restricted browsers */ }
    return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }

  function readLocalScores() {
    try {
      const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      if (!Array.isArray(value)) return [];
      return value.filter((item) => item && validGames.has(item.game)
        && Number.isSafeInteger(item.score) && item.score >= 0 && item.score <= MAX_SCORE)
        .map((item) => ({
          ...item,
          name: cleanName(item.name),
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
          syncStatus: ["pending", "synced", "local"].includes(item.syncStatus)
            ? item.syncStatus : (item.local ? "local" : "synced"),
        }));
    } catch {
      return [];
    }
  }

  function cleanName(name) {
    return String(name || "匿名玩家").replace(/[<>\u0000-\u001f\u007f]/g, "").trim().slice(0, 20) || "匿名玩家";
  }

  function retainScores(scores) {
    const retained = [];
    for (const game of validGames) {
      const entries = scores.filter((item) => item && item.game === game);
      const pending = entries.filter((item) => item.syncStatus === "pending")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, MAX_PENDING_PER_GAME);
      const topScores = entries.filter((item) => item.syncStatus !== "pending")
        .sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, MAX_LOCAL_PER_GAME);
      const seen = new Set();
      for (const item of [...pending, ...topScores]) {
        const identity = item.submissionId || item.id;
        if (seen.has(identity)) continue;
        seen.add(identity);
        retained.push(item);
      }
    }
    return retained;
  }

  function saveLocalScores(scores) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(retainScores(scores)));
      return true;
    } catch {
      // Private browsing or a full storage quota should never prevent a game from working.
      return false;
    }
  }

  function writeLocalScore(entry, syncStatus) {
    const localEntry = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      submissionId: entry.submissionId,
      game: entry.game,
      name: cleanName(entry.name),
      score: entry.score,
      createdAt: new Date().toISOString(),
      local: true,
      syncStatus,
    };
    const scores = readLocalScores();
    scores.push(localEntry);
    localEntry.storedLocally = saveLocalScores(scores);
    return localEntry;
  }

  function updateLocalScore(submissionId, changes) {
    if (!submissionId) return false;
    const scores = readLocalScores();
    let found = false;
    const updated = scores.map((item) => {
      if (item.submissionId !== submissionId) return item;
      found = true;
      return { ...item, ...changes };
    });
    return found ? saveLocalScores(updated) : false;
  }

  function getPendingScores() {
    return readLocalScores().filter((item) => item.syncStatus === "pending" && item.submissionId);
  }

  async function request(path, options = {}) {
    if (!apiBase) return { ok: false, reason: "not-configured", error: "No API URL is configured." };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2200);
    try {
      const headers = { ...(options.headers || {}) };
      const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
      if (options.body !== undefined && !hasContentType) headers["Content-Type"] = "application/json";
      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      let data = null;
      try { data = await response.json(); } catch { /* empty or non-JSON error response */ }
      if (!response.ok || data?.ok === false) {
        return {
          ok: false,
          status: response.status,
          error: data?.error || `API request failed (${response.status}).`,
        };
      }
      connection.mode = "server";
      connection.lastError = "";
      connection.lastSuccessAt = new Date().toISOString();
      return { ok: true, status: response.status, data };
    } catch (error) {
      return {
        ok: false,
        reason: error?.name === "AbortError" ? "timeout" : "network",
        error: error?.name === "AbortError" ? "API request timed out." : "API is unavailable.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function syncOne(entry) {
    if (!apiBase) return false;
    const result = await request("/scores", {
      method: "POST",
      headers: { "Idempotency-Key": entry.submissionId },
      body: JSON.stringify({
        submissionId: entry.submissionId,
        game: entry.game,
        score: entry.score,
        name: cleanName(entry.name),
      }),
    });
    if (result.ok && result.data?.entry) {
      updateLocalScore(entry.submissionId, {
        syncStatus: "synced",
        serverId: result.data.entry.id,
        syncedAt: new Date().toISOString(),
      });
      connection.mode = "server";
      connection.lastError = "";
      return result.data.entry;
    }
    connection.mode = "offline";
    connection.lastError = result.error || "API is unavailable.";
    return null;
  }

  function scheduleSyncRetry(delayMs) {
    if (!apiBase || retryTimer || getPendingScores().length === 0) return;
    nextRetryAt = Date.now() + delayMs;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      nextRetryAt = 0;
      void syncPendingScores();
    }, delayMs);
    // Node-based tests should not be kept alive by a background browser retry timer.
    retryTimer?.unref?.();
  }

  async function syncPendingScores({ force = false } = {}) {
    if (!apiBase) {
      connection.mode = "local";
      return { synced: 0, pending: 0 };
    }
    if (force && retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
      nextRetryAt = 0;
    }
    if (!force && retryTimer && Date.now() < nextRetryAt) {
      return { synced: 0, pending: getPendingScores().length, retryScheduled: true };
    }
    if (syncPromise) return syncPromise;
    syncPromise = (async () => {
      let synced = 0;
      const pending = getPendingScores().slice(0, 10);
      for (const entry of pending) {
        const savedEntry = await syncOne(entry);
        if (!savedEntry) break; // Avoid hammering a down or rate-limited API.
        synced += 1;
      }
      const pendingCount = getPendingScores().length;
      if (pendingCount === 0) {
        retryAttempt = 0;
      } else if (synced > 0) {
        // Continue in batches with a pause to stay below the default per-IP rate limit.
        retryAttempt = 0;
        scheduleSyncRetry(25_000);
      } else {
        // If the API itself is down, back off progressively and retry without requiring
        // a full page reload. The browser's `online` event also triggers an immediate retry.
        retryAttempt += 1;
        scheduleSyncRetry(Math.min(15_000 * (2 ** (retryAttempt - 1)), 300_000));
      }
      return { synced, pending: pendingCount };
    })();
    try {
      return await syncPromise;
    } finally {
      syncPromise = null;
    }
  }

  function sortEntries(entries, limit) {
    const seen = new Set();
    return entries
      .filter((entry) => entry && Number.isSafeInteger(entry.score) && entry.score >= 0)
      .filter((entry) => {
        const identity = entry.submissionId || entry.id;
        if (!identity || seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
      .sort((a, b) => b.score - a.score || new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async function submitScore(game, score, name = "匿名玩家") {
    if (!validGames.has(game) || !Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE) {
      return { synced: false, invalid: true, queued: false };
    }
    const submissionId = makeSubmissionId();
    const payload = { submissionId, game, score, name: cleanName(name) };
    const localEntry = writeLocalScore(payload, apiBase ? "pending" : "local");
    if (!apiBase) {
      connection.mode = "local";
      return { synced: false, queued: false, entry: localEntry, storedLocally: localEntry.storedLocally };
    }
    const serverEntry = await syncOne(payload);
    const synced = Boolean(serverEntry);
    if (!synced && localEntry.storedLocally) {
      retryAttempt += 1;
      scheduleSyncRetry(Math.min(15_000 * (2 ** (retryAttempt - 1)), 300_000));
    } else if (synced) {
      retryAttempt = 0;
    }
    return {
      synced,
      queued: !synced && localEntry.storedLocally,
      entry: serverEntry || localEntry,
      storedLocally: localEntry.storedLocally,
    };
  }

  async function getLeaderboard(game, limit = 10) {
    if (!validGames.has(game)) return [];
    const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(50, limit)) : 10;
    // Retry pending uploads in the background so a slow/offline API does not block
    // local leaderboard rendering.
    void syncPendingScores();
    const result = await request(`/leaderboard?game=${encodeURIComponent(game)}&limit=${safeLimit}`);
    if (result.ok && Array.isArray(result.data?.entries)) {
      connection.mode = "server";
      const pendingLocal = getPendingScores().filter((entry) => entry.game === game);
      return sortEntries([...result.data.entries, ...pendingLocal], safeLimit);
    }
    connection.mode = apiBase ? "offline" : "local";
    if (apiBase) connection.lastError = result.error || "API is unavailable.";
    return sortEntries(readLocalScores().filter((entry) => entry.game === game), safeLimit);
  }

  function getSyncStatus() {
    return {
      mode: connection.mode,
      apiConfigured: Boolean(apiBase),
      pending: getPendingScores().length,
      lastError: connection.lastError,
      lastSuccessAt: connection.lastSuccessAt,
    };
  }

  function recordPlay(game) {
    if (!validGames.has(game)) return;
    try {
      const counts = JSON.parse(localStorage.getItem(PLAY_KEY) || "{}");
      counts[game] = (Number(counts[game]) || 0) + 1;
      localStorage.setItem(PLAY_KEY, JSON.stringify(counts));
    } catch {
      // Ignore unavailable storage.
    }
  }

  function getPlayStats() {
    try {
      const counts = JSON.parse(localStorage.getItem(PLAY_KEY) || "{}");
      return {
        total: Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0),
        counts,
      };
    } catch {
      return { total: 0, counts: {} };
    }
  }

  if (apiBase && window.addEventListener) {
    window.addEventListener("online", () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      nextRetryAt = 0;
      retryAttempt = 0;
      void syncPendingScores({ force: true });
    });
    if (typeof navigator === "undefined" || navigator.onLine !== false) void syncPendingScores();
  }

  window.GameVaultApi = {
    submitScore,
    getLeaderboard,
    recordPlay,
    getPlayStats,
    syncPendingScores,
    getSyncStatus,
    apiBase,
  };
})();
