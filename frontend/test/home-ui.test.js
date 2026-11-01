'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8');
const common = fs.readFileSync(path.join(ROOT, 'frontend/assets/js/common.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/styles.css'), 'utf8');
const homeCss = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/home-stage2.css'), 'utf8');

test('homepage game cards expose clear start actions for all three games', () => {
  assert.equal((html.match(/class="game-card"/g) || []).length, 3);
  assert.equal((html.match(/class="card-action"/g) || []).length, 3);
  assert.equal((html.match(/立即开玩/g) || []).length, 3);
});

test('recent-play panel is hidden until a known game is available', () => {
  assert.match(html, /data-recent-wrap hidden/);
  assert.match(html, /data-recent-game-icon/);
  assert.match(html, /data-recent-game-time/);
  assert.match(common, /gamevault\.lastGameAt/);
  assert.match(common, /recentWrap\.hidden = false/);
});

test('homepage game navigation updates local recent-play metadata', () => {
  assert.match(common, /localStorage\.setItem\("gamevault\.lastGameAt", new Date\(\)\.toISOString\(\)\)/);
  assert.match(common, /recentNode\.addEventListener\("click"/);
});

test('homepage leaderboard renders status, top-three ranks and a designed empty state', () => {
  assert.match(common, /leaderboard-status/);
  assert.match(common, /leaderboard-empty/);
  assert.match(common, /rank-\$\{index \+ 1\}/);
  assert.match(common, /getLeaderboard\(game, 3\)/);
  assert.match(homeCss, /\.home-leaderboard \.leaderboard-rank/);
  assert.match(css, /\.leaderboard-row \{ display: flex/);
  assert.match(homeCss, /\.leaderboard-status\.is-server/);
});

test('homepage enhancements retain responsive and reduced-motion rules', () => {
  assert.match(homeCss, /@media \(max-width: 700px\)/);
  assert.match(homeCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.game-card:focus-visible/);
});
