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
const stage3Css = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/responsive-stage3.css'), 'utf8');
const gamePages = ['snake/index.html', '2048/index.html', 'minesweeper/index.html'].map((game) =>
  fs.readFileSync(path.join(ROOT, 'frontend/games', game), 'utf8')
);

test('homepage game cards expose clear start actions for all three games', () => {
  assert.equal((html.match(/class="game-card"/g) || []).length, 3);
  assert.equal((html.match(/class="card-action"/g) || []).length, 3);
  assert.equal((html.match(/立即开玩/g) || []).length, 3);
});

test('homepage search keeps an accurate visible-card count', () => {
  assert.match(common, /if \(match\) visible \+= 1;/);
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


test('stage-three responsive stylesheet is loaded on the homepage and all game pages', () => {
  assert.match(html, /assets\/css\/responsive-stage3\.css/);
  for (const page of gamePages) assert.match(page, /assets\/css\/responsive-stage3\.css/);
});

test('stage-three compact layouts prevent narrow-screen content from forcing overflow', () => {
  assert.match(stage3Css, /@media \(max-width: 480px\)/);
  assert.match(stage3Css, /\.stats-strip\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/s);
  assert.match(stage3Css, /\.game-card-bottom\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(stage3Css, /\.game-meta\s*\{[^}]*min-width:\s*0/s);
  assert.match(stage3Css, /overflow-wrap:\s*anywhere/);
  assert.match(stage3Css, /@media \(max-width: 380px\)/);
});

test('stage-three touch targets and keyboard focus have consistent affordances', () => {
  assert.match(stage3Css, /\.icon-button\s*\{[^}]*width:44px;[^}]*height:44px;/s);
  assert.match(stage3Css, /\.mobile-controls button\s*\{[^}]*min-width:44px;[^}]*min-height:44px;/s);
  assert.match(stage3Css, /\[tabindex="0"\]:focus-visible/);
  assert.match(stage3Css, /@media \(prefers-reduced-motion:reduce\)/);
});

test('touch devices receive pressed feedback without hover-only movement', () => {
  assert.match(stage3Css, /@media \(hover:none\), \(pointer:coarse\)/);
  assert.match(stage3Css, /\.game-card:active/);
  assert.match(stage3Css, /\.recent-game-card:active/);
});
