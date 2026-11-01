'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const gamePages = ['snake/index.html', '2048/index.html', 'minesweeper/index.html'].map((game) =>
  fs.readFileSync(path.join(ROOT, 'frontend/games', game), 'utf8')
);
const stage4Css = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/game-stage4.css'), 'utf8');

test('all game pages load the stage-four stylesheet after the shared responsive styles', () => {
  for (const page of gamePages) {
    assert.match(page, /responsive-stage3\.css[\s\S]*game-stage4\.css/);
  }
});

test('all game status indicators expose polite live status semantics', () => {
  for (const page of gamePages) {
    assert.match(page, /id="status-pill" role="status" aria-live="polite" aria-atomic="true"/);
  }
});

test('desktop game layout aligns the primary action with the main game column', () => {
  assert.match(stage4Css, /\.game-page-heading\s*\{[^}]*width:\s*calc\(100%\s*-\s*320px\)/s);
  assert.match(stage4Css, /\.game-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+300px/s);
  assert.match(stage4Css, /\.game-layout\s*>\s*aside\s*\{[^}]*position:\s*sticky/s);
});

test('game HUD, status states and leaderboard receive consistent visual hierarchy', () => {
  assert.match(stage4Css, /\.game-stat:first-child strong/);
  assert.match(stage4Css, /\.status-pill\[data-state="playing"\]/);
  assert.match(stage4Css, /\.status-pill\[data-state="paused"\]/);
  assert.match(stage4Css, /\.status-pill\[data-state="over"\]/);
  assert.match(stage4Css, /\.leaderboard-list \.leaderboard-row:first-of-type/);
  assert.match(stage4Css, /\.game-instructions/);
});

test('2048, snake and minesweeper board surfaces receive dedicated refinements', () => {
  assert.match(stage4Css, /\.puzzle-board/);
  assert.match(stage4Css, /\.tile:not\(\.tile-empty\)/);
  assert.match(stage4Css, /\.canvas-wrap/);
  assert.match(stage4Css, /\.mine-board/);
  assert.match(stage4Css, /\.mine-cell/);
});

test('tablet and phone layouts reflow the sidebar and heading without overflow', () => {
  assert.match(stage4Css, /@media \(max-width: 820px\)/);
  assert.match(stage4Css, /@media \(max-width: 700px\)/);
  assert.match(stage4Css, /\.game-layout > aside\s*\{[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.match(stage4Css, /@media \(max-width: 380px\)/);
});

test('game interaction details respect reduced-motion preferences', () => {
  assert.match(stage4Css, /\.dpad button, \.mobile-controls button/);
  assert.match(stage4Css, /:focus-visible|focus-visible/);
  assert.match(stage4Css, /@media \(prefers-reduced-motion: reduce\)/);
});


test('game-page home navigation labels do not include a decorative left arrow', () => {
  for (const page of gamePages) {
    assert.match(page, />返回首页<\/a>/);
    assert.doesNotMatch(page, />← 返回首页<\/a>/);
  }
});

test('all three game pages load a cache-versioned shared game stylesheet', () => {
  for (const [index, game] of ['snake', '2048', 'minesweeper'].entries()) {
    assert.match(gamePages[index], new RegExp('data-game="' + game + '"'));
    assert.match(gamePages[index], /responsive-stage3\.css[\s\S]*game-stage4\.css\?v=2\.6\.2/);
  }
});

test('all three game pages share a centered, viewport-fitted desktop first view', () => {
  assert.match(stage4Css, /@media \(min-width: 821px\)/);
  assert.match(stage4Css, /body\[data-game\]\s*\{[^}]*min-height:\s*100svh;[^}]*display:\s*flex/s);
  assert.match(stage4Css, /body\[data-game\]\s*>\s*\.game-page\s*\{[^}]*justify-content:\s*center/s);
  assert.match(stage4Css, /body\[data-game\]\s+\.game-layout\s*\{[^}]*align-items:\s*center/s);
  assert.match(stage4Css, /body\[data-game\]\s+\.board-stage,[\s\S]*?width:\s*min\(100%,\s*clamp\(220px,\s*calc\(100svh - 660px\),\s*360px\)\)/);
  assert.match(stage4Css, /body\[data-game\]\s+\.puzzle-wrap/);
  assert.match(stage4Css, /body\[data-game\]\s+\.mine-board-wrap/);
  assert.match(stage4Css, /@media \(min-width: 821px\) and \(max-height: 760px\)/);
  assert.match(stage4Css, /body\[data-game\]\s+\.game-instructions\s*\{\s*display:\s*none;/);
});

