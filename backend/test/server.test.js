'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');

let server;
let baseUrl;
let tempDir;

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamevault-test-'));
  server = createServer({
    dataFile: path.join(tempDir, 'leaderboard.json'),
    allowedOrigins: ['http://localhost:5173'],
    rateLimit: 200,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('health endpoint reports the API is running', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.service, 'gamevault-api');
  assert.equal(result.ok, true);
});

test('score submissions validate data, sanitize names and persist entries', async () => {
  const invalid = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'snake', score: -1 }),
  });
  assert.equal(invalid.status, 400);

  const nullBody = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null',
  });
  assert.equal(nullBody.status, 400);

  const wrongType = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello',
  });
  assert.equal(wrongType.status, 415);

  const response = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'snake', score: 120, name: '<Player>' }),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.entry.score, 120);
  assert.equal(result.entry.name, 'Player');

  const leaderboard = await fetch(`${baseUrl}/api/leaderboard?game=snake&limit=5`);
  assert.equal(leaderboard.status, 200);
  const data = await leaderboard.json();
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].score, 120);
  assert.equal(data.entries[0].rank, 1);
});

test('leaderboard rejects unknown games and CORS rejects unknown origins', async () => {
  const invalidGame = await fetch(`${baseUrl}/api/leaderboard?game=not-a-game`);
  assert.equal(invalidGame.status, 400);
  const blocked = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://malicious.example' } });
  assert.equal(blocked.status, 403);

  const preflight = await fetch(`${baseUrl}/api/scores`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,idempotency-key' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(preflight.headers.get('access-control-allow-headers'), /Idempotency-Key/i);
});

test('concurrent submissions are not lost', async () => {
  const requests = Array.from({ length: 24 }, (_, index) => fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: '2048', score: index, name: `Player ${index}` }),
  }));
  const responses = await Promise.all(requests);
  assert.ok(responses.every((response) => response.status === 201));
  const response = await fetch(`${baseUrl}/api/leaderboard?game=2048&limit=50`);
  const data = await response.json();
  assert.equal(data.entries.length, 24);
  assert.equal(data.entries[0].score, 23);
  assert.equal(data.entries.at(-1).score, 0);
});

test('oversized request bodies are rejected', async () => {
  const response = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'snake', score: 1, name: 'x'.repeat(20_000) }),
  });
  assert.equal(response.status, 413);
});


test('concurrent retries with one idempotency key create a single score', async () => {
  const submissionId = 'sub-test-duplicate-001';
  const requests = Array.from({ length: 12 }, () => fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionId },
    body: JSON.stringify({ submissionId, game: 'minesweeper', score: 9500, name: 'Retry Player' }),
  }));
  const responses = await Promise.all(requests);
  assert.ok(responses.every((response) => response.status === 200 || response.status === 201));
  const leaderboardResponse = await fetch(`${baseUrl}/api/leaderboard?game=minesweeper&limit=50`);
  const data = await leaderboardResponse.json();
  assert.equal(data.entries.filter((entry) => entry.submissionId === submissionId).length, 1);
  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  const conflictingRetry = await fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionId },
    body: JSON.stringify({ submissionId, game: 'minesweeper', score: 9501, name: 'Retry Player' }),
  });
  assert.equal(conflictingRetry.status, 409);
});

test('leaderboard data survives an API server restart', async () => {
  const restarted = createServer({
    dataFile: path.join(tempDir, 'leaderboard.json'),
    allowedOrigins: ['http://localhost:5173'],
    rateLimit: 200,
  });
  await new Promise((resolve) => restarted.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${restarted.address().port}/api/leaderboard?game=snake&limit=10`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.entries.some((entry) => entry.score === 120));
  } finally {
    await new Promise((resolve, reject) => restarted.close((error) => error ? reject(error) : resolve()));
  }
});

test('health check reports corrupted persistence data as unavailable', async () => {
  const corruptFile = path.join(tempDir, 'corrupt.json');
  await fs.writeFile(corruptFile, '{not valid json', 'utf8');
  const corruptServer = createServer({ dataFile: corruptFile, allowedOrigins: [] });
  await new Promise((resolve) => corruptServer.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${corruptServer.address().port}/api/health`);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.storage, 'error');
  } finally {
    await new Promise((resolve, reject) => corruptServer.close((error) => error ? reject(error) : resolve()));
  }
});
