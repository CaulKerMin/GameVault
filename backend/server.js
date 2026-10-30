'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const VALID_GAMES = new Set(['snake', '2048', 'minesweeper']);
const MAX_SCORE = 10_000_000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ENTRIES = 1000;
const RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 30;
const SUBMISSION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(body);
}

function cleanName(value) {
  return String(value ?? '匿名玩家')
    .replace(/[<>\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 20) || '匿名玩家';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let settled = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (settled) return;
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        settled = true;
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.resume();
      }
    });
    req.on('end', () => {
      if (settled) return;
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
    req.on('aborted', () => {
      if (!settled) reject(Object.assign(new Error('Request body was interrupted.'), { statusCode: 400 }));
    });
  });
}

function createServer(options = {}) {
  const dataFile = options.dataFile || process.env.DATA_FILE || path.join(__dirname, 'data', 'leaderboard.json');
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  const configuredOrigins = options.allowedOrigins ?? (envOrigins.length ? envOrigins : DEFAULT_ALLOWED_ORIGINS);
  const allowedOrigins = new Set(configuredOrigins);
  const envRateLimit = Number.parseInt(process.env.RATE_LIMIT || '', 10);
  const rateLimit = Number.isInteger(options.rateLimit) && options.rateLimit > 0
    ? options.rateLimit
    : (Number.isInteger(envRateLimit) && envRateLimit > 0 ? envRateLimit : DEFAULT_RATE_LIMIT);
  const requestsByIp = new Map();
  // Serialize score writes so concurrent submissions cannot overwrite each other.
  let writeQueue = Promise.resolve();

  async function readEntries() {
    try {
      const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Leaderboard data must be a JSON array.');
      return parsed.filter((entry) => entry && typeof entry === 'object'
        && VALID_GAMES.has(entry.game) && Number.isSafeInteger(entry.score)
        && entry.score >= 0 && entry.score <= MAX_SCORE
        && typeof entry.createdAt === 'string')
        .map((entry) => ({
          ...entry,
          name: cleanName(entry.name),
        }));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function writeEntries(entries) {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    const tempFile = `${dataFile}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(tempFile, JSON.stringify(entries, null, 2), { encoding: 'utf8', flag: 'wx' });
      await fs.rename(tempFile, dataFile);
    } finally {
      await fs.rm(tempFile, { force: true }).catch(() => {});
    }
  }

  async function appendEntry(entry) {
    const task = writeQueue.then(async () => {
      const entries = await readEntries();
      // Idempotency is checked inside the serialized write queue, so simultaneous retries
      // with the same key cannot create duplicate leaderboard entries.
      if (entry.submissionId) {
        const existing = entries.find((item) => item.submissionId === entry.submissionId);
        if (existing) {
          const samePayload = existing.game === entry.game
            && existing.score === entry.score && existing.name === entry.name;
          return { entry: existing, duplicate: samePayload, conflict: !samePayload };
        }
      }
      entries.push(entry);
      entries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      await writeEntries(entries.slice(0, MAX_ENTRIES));
      return { entry, duplicate: false };
    });
    // Keep the queue usable after a failed write; the caller still receives the error.
    writeQueue = task.catch(() => {});
    return task;
  }

  function checkRateLimit(ip) {
    const now = Date.now();
    for (const [key, value] of requestsByIp) {
      if (now - value.startedAt >= RATE_WINDOW_MS) requestsByIp.delete(key);
    }
    const current = requestsByIp.get(ip);
    if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
      requestsByIp.set(ip, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= rateLimit;
  }

  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');

    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      json(res, 403, { ok: false, error: 'Origin is not allowed by CORS configuration.' });
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { json(res, 400, { ok: false, error: 'Invalid request URL.' }); return; }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      try {
        await readEntries();
        json(res, 200, { ok: true, service: 'gamevault-api', storage: 'ok', timestamp: new Date().toISOString() });
      } catch {
        json(res, 503, { ok: false, service: 'gamevault-api', storage: 'error', error: 'Leaderboard storage is unavailable.', timestamp: new Date().toISOString() });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
      const game = url.searchParams.get('game');
      if (!VALID_GAMES.has(game)) {
        json(res, 400, { ok: false, error: 'A valid game is required.', allowedGames: [...VALID_GAMES] });
        return;
      }
      const rawLimit = url.searchParams.get('limit');
      const requestedLimit = rawLimit === null ? 10 : Number(rawLimit);
      const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 10;
      try {
        const entries = await readEntries();
        const ranked = entries
          .filter((entry) => entry && entry.game === game && Number.isSafeInteger(entry.score))
          .sort((a, b) => b.score - a.score || String(a.createdAt).localeCompare(String(b.createdAt)))
          .slice(0, limit)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));
        json(res, 200, { ok: true, game, entries: ranked });
      } catch {
        json(res, 500, { ok: false, error: 'Could not read leaderboard data.' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/scores') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        json(res, 429, { ok: false, error: 'Too many score submissions. Please try again later.' });
        return;
      }
      if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
        json(res, 415, { ok: false, error: 'Content-Type must be application/json.' });
        return;
      }
      let body;
      try { body = await readJsonBody(req); }
      catch (error) {
        json(res, error.statusCode || 400, { ok: false, error: error.message || 'Could not read request body.' });
        return;
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        json(res, 400, { ok: false, error: 'Request body must be a JSON object.' });
        return;
      }
      const { game, score } = body;
      if (!VALID_GAMES.has(game)) {
        json(res, 400, { ok: false, error: 'A valid game is required.', allowedGames: [...VALID_GAMES] });
        return;
      }
      if (!Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE) {
        json(res, 400, { ok: false, error: `Score must be an integer from 0 to ${MAX_SCORE}.` });
        return;
      }
      const headerSubmissionId = req.headers['idempotency-key'];
      if (body.submissionId && headerSubmissionId
        && String(body.submissionId).trim() !== String(headerSubmissionId).trim()) {
        json(res, 400, { ok: false, error: 'submissionId and Idempotency-Key must match.' });
        return;
      }
      const rawSubmissionId = body.submissionId ?? headerSubmissionId;
      let submissionId;
      if (rawSubmissionId !== undefined && rawSubmissionId !== null && rawSubmissionId !== '') {
        submissionId = String(rawSubmissionId).trim();
        if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
          json(res, 400, { ok: false, error: 'submissionId must be 8–128 characters using letters, numbers, underscores or hyphens.' });
          return;
        }
      }
      const entry = {
        id: randomUUID(),
        ...(submissionId ? { submissionId } : {}),
        game,
        name: cleanName(body.name),
        score,
        createdAt: new Date().toISOString(),
      };
      try {
        const saved = await appendEntry(entry);
        if (saved.conflict) {
          json(res, 409, { ok: false, error: 'This submissionId was already used for a different score.' });
          return;
        }
        json(res, saved.duplicate ? 200 : 201, { ok: true, entry: saved.entry, duplicate: saved.duplicate });
      } catch {
        json(res, 500, { ok: false, error: 'Could not save score.' });
      }
      return;
    }

    json(res, 404, { ok: false, error: 'Route not found.' });
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || '3001', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535.');
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.listen(port, '0.0.0.0', () => {
      console.log(`GameVault API listening on http://localhost:${port}`);
      console.log('Health check: /api/health');
    });
  }
}

module.exports = { createServer, VALID_GAMES, cleanName };
