'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const apiSource = fs.readFileSync(path.join(__dirname, '../assets/js/api.js'), 'utf8');

function loadApi({ hostname = 'gamevault.example', apiBaseUrl = '', fetchImpl } = {}) {
  const storage = new Map();
  const calls = [];
  const window = {
    location: { hostname },
    GAMEVAULT_CONFIG: { apiBaseUrl },
    addEventListener() {},
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  const context = {
    window,
    localStorage,
    fetch: fetchImpl || (async (...args) => {
      calls.push(args);
      return { ok: false, status: 503, json: async () => ({ ok: false }) };
    }),
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  };
  // Wrap fetch so tests can inspect outgoing requests without a browser.
  if (fetchImpl) {
    context.fetch = async (...args) => {
      calls.push(args);
      return fetchImpl(...args);
    };
  }
  vm.runInNewContext(apiSource, context, { filename: 'frontend/assets/js/api.js' });
  return { api: window.GameVaultApi, storage, calls };
}

test('static-hosting fallback retains a top-100 history per game', async () => {
  const { api, storage } = loadApi();
  for (const game of ['snake', '2048', 'minesweeper']) {
    for (let score = 0; score < 105; score++) {
      await api.submitScore(game, score, `Player ${score}`);
    }
  }
  const stored = JSON.parse(storage.get('gamevault.scores.v1'));
  for (const game of ['snake', '2048', 'minesweeper']) {
    const scores = stored.filter((entry) => entry.game === game);
    assert.equal(scores.length, 100);
    assert.equal(Math.max(...scores.map((entry) => entry.score)), 104);
    assert.equal(Math.min(...scores.map((entry) => entry.score)), 5);
  }
});

test('cross-origin leaderboard GET does not send an unnecessary JSON content type', async () => {
  const { api, calls } = loadApi({
    apiBaseUrl: 'https://api.example.com/api',
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, entries: [] }) }),
  });
  await api.getLeaderboard('snake');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.example.com/api/leaderboard?game=snake&limit=10');
  assert.equal(Object.keys(calls[0][1].headers).some((key) => key.toLowerCase() === 'content-type'), false);
});

test('score POST includes JSON content type and rejects invalid scores locally', async () => {
  const { api, calls } = loadApi({
    apiBaseUrl: 'https://api.example.com/api',
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, entry: { id: 'server-1' } }) }),
  });
  const invalid = await api.submitScore('snake', -1);
  assert.equal(invalid.invalid, true);
  assert.equal(calls.length, 0);

  const valid = await api.submitScore('snake', 42, 'Tester');
  assert.equal(valid.synced, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
});


test('offline score submissions stay queued and sync when the API recovers', async () => {
  let online = false;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'POST') {
      if (!online) return { ok: false, status: 503, json: async () => ({ ok: false, error: 'API down' }) };
      const body = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ ok: true, entry: { id: 'server-entry-1', ...body, createdAt: new Date().toISOString() } }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, entries: [] }) };
  };
  const { api, storage } = loadApi({ apiBaseUrl: 'https://api.example.com/api', fetchImpl });
  const result = await api.submitScore('snake', 42, 'Tester');
  assert.equal(result.synced, false);
  assert.equal(result.queued, true);
  let saved = JSON.parse(storage.get('gamevault.scores.v1'));
  assert.equal(saved[0].syncStatus, 'pending');
  assert.ok(saved[0].submissionId);

  online = true;
  const syncResult = await api.syncPendingScores({ force: true });
  assert.equal(syncResult.synced, 1);
  saved = JSON.parse(storage.get('gamevault.scores.v1'));
  assert.equal(saved[0].syncStatus, 'synced');
  assert.equal(saved[0].serverId, 'server-entry-1');
  assert.equal(api.getSyncStatus().pending, 0);
});

test('shared leaderboard includes pending local scores when the server has not received them yet', async () => {
  let online = false;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'POST') return { ok: false, status: 503, json: async () => ({ ok: false }) };
    if (String(url).includes('/leaderboard')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, entries: [{ id: 'remote-1', game: 'snake', name: 'Remote', score: 30, createdAt: '2026-01-01T00:00:00.000Z' }] }) };
    }
    return { ok: online, status: online ? 200 : 503, json: async () => ({ ok: online }) };
  };
  const { api } = loadApi({ apiBaseUrl: 'https://api.example.com/api', fetchImpl });
  await api.submitScore('snake', 42, 'Local pending');
  const entries = await api.getLeaderboard('snake', 10);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, 'Local pending');
  assert.equal(entries[1].name, 'Remote');
});
