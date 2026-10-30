'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStaticServer } = require('../dev-server');

let server;
let baseUrl;
let appServer;
let appBaseUrl;
let rootDir;
let outsideDir;

test.before(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamevault-static-'));
  outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamevault-outside-'));
  await fs.writeFile(path.join(rootDir, 'index.html'), '<h1>GameVault test</h1>');
  await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'outside-root-secret');
  await fs.symlink(path.join(outsideDir, 'secret.txt'), path.join(rootDir, 'leak.txt'));

  server = createStaticServer({ root: rootDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  appServer = createStaticServer({ root: path.resolve(__dirname, '..') });
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  appBaseUrl = `http://127.0.0.1:${appServer.address().port}`;
});

test.after(async () => {
  await Promise.all([server, appServer].map((instance) => new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve()))));
  await fs.rm(rootDir, { recursive: true, force: true });
  await fs.rm(outsideDir, { recursive: true, force: true });
});

test('static server serves index files and sets basic security headers', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /GameVault test/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('static server handles HEAD and rejects unsupported methods', async () => {
  const head = await fetch(`${baseUrl}/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  const post = await fetch(`${baseUrl}/`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('static server does not expose files through symlinks or path traversal', async () => {
  const symlink = await fetch(`${baseUrl}/leak.txt`);
  assert.equal(symlink.status, 403);

  const traversal = await fetch(`${baseUrl}/%2e%2e%2foutside-secret.txt`);
  assert.ok([403, 404].includes(traversal.status));
  assert.doesNotMatch(await traversal.text(), /outside-root-secret/);
});

test('static server returns a clean 404 for missing files', async () => {
  const response = await fetch(`${baseUrl}/missing.js`);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not found');
});


test('actual GameVault pages and assets are served from the frontend root', async () => {
  const paths = [
    ['/', 'text/html'],
    ['/assets/css/styles.css', 'text/css'],
    ['/assets/js/api.js', 'javascript'],
    ['/games/snake/index.html', 'text/html'],
    ['/games/snake/logic.js', 'javascript'],
    ['/games/snake/game.js', 'javascript'],
    ['/games/2048/index.html', 'text/html'],
    ['/games/2048/logic.js', 'javascript'],
    ['/games/2048/game.js', 'javascript'],
    ['/games/minesweeper/index.html', 'text/html'],
    ['/games/minesweeper/logic.js', 'javascript'],
    ['/games/minesweeper/game.js', 'javascript'],
  ];
  for (const [route, expectedType] of paths) {
    const response = await fetch(`${appBaseUrl}${route}`);
    assert.equal(response.status, 200, `${route} should be available`);
    assert.ok(response.headers.get('content-type').includes(expectedType), `${route} should have a suitable content type`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${route} should not be empty`);
  }
});
