'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const gamePages = ['snake/index.html', '2048/index.html', 'minesweeper/index.html'].map((game) =>
  fs.readFileSync(path.join(ROOT, 'frontend/games', game), 'utf8')
);
const baseCss = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/styles.css'), 'utf8');
const responsiveCss = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/responsive-stage3.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(ROOT, 'frontend/assets/css/game-layout-stage6.css'), 'utf8');
const packageVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

test('all game pages load the surrounding-layout stylesheet after the shared responsive styles', () => {
  for (const page of gamePages) {
    assert.match(page, /styles\.css[\s\S]*responsive-stage3\.css[\s\S]*game-layout-stage6\.css/);
    assert.doesNotMatch(page, /game-stage4\.css/);
  }
});

test('all game status indicators expose polite live status semantics', () => {
  for (const page of gamePages) {
    assert.match(page, /id="status-pill" role="status" aria-live="polite" aria-atomic="true"/);
  }
});

test('the original 480px playable surfaces are restored without viewport-height shrinking', () => {
  assert.match(baseCss, /\.board-stage\s*\{[^}]*width:\s*min\(100%,\s*480px\)/s);
  assert.match(baseCss, /\.puzzle-wrap\s*\{[^}]*width:\s*min\(100%,\s*480px\)/s);
  assert.match(baseCss, /\.mine-board-wrap\s*\{[^}]*width:\s*min\(100%,\s*480px\)/s);
  assert.doesNotMatch(layoutCss, /calc\(100svh\s*-|\.board-stage|\.puzzle-wrap|\.mine-board-wrap/);
});

test('2048 and Minesweeper boards and every playable cell preserve a square aspect ratio', () => {
  assert.match(baseCss, /#snake-canvas\s*\{[^}]*aspect-ratio:\s*1/s);
  assert.match(baseCss, /\.puzzle-board\s*\{[^}]*grid-auto-rows:\s*minmax\(0,\s*1fr\);[^}]*aspect-ratio:\s*1/s);
  assert.match(baseCss, /\.tile\s*\{[^}]*aspect-ratio:\s*1/s);
  assert.match(baseCss, /\.mine-board\s*\{[^}]*grid-auto-rows:\s*minmax\(0,\s*1fr\);[^}]*aspect-ratio:\s*1/s);
  assert.match(baseCss, /\.mine-cell\s*\{[^}]*aspect-ratio:\s*1/s);
});

test('the new stylesheet changes only page framing and the surrounding sidebar layout', () => {
  assert.match(layoutCss, /\.game-page-heading\s*\{[^}]*width:\s*calc\(100%\s*-\s*320px\)/s);
  assert.match(layoutCss, /\.game-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+300px/s);
  assert.match(layoutCss, /\.game-layout\s*>\s*aside\s*\{[^}]*position:\s*static/s);
  assert.doesNotMatch(layoutCss, /\.puzzle-board|\.tile\b|\.mine-board|\.mine-cell|#snake-canvas|\.canvas-wrap/);
});

test('tablet and phone layouts reflow the sidebar without resizing the board', () => {
  assert.match(layoutCss, /@media\s*\(max-width:\s*900px\)/);
  assert.match(layoutCss, /@media\s*\(max-width:\s*820px\)/);
  assert.match(layoutCss, /@media\s*\(max-width:\s*700px\)/);
  assert.match(layoutCss, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(layoutCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('game interaction details retain keyboard focus and reduced-motion support', () => {
  assert.match(baseCss, /#snake-canvas:focus-visible|\.puzzle-board:focus-visible/);
  assert.match(responsiveCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(baseCss, /\.dpad button/);
  assert.match(baseCss, /\.mobile-controls button/);
});

test('game-page home navigation labels do not include a decorative left arrow', () => {
  for (const page of gamePages) {
    assert.match(page, />返回首页<\/a>/);
    assert.doesNotMatch(page, />← 返回首页<\/a>/);
  }
});

test('all three game pages expose the release version and request matching cache-busted layout CSS', () => {
  const cacheVersions = [];
  for (const [index, game] of ['snake', '2048', 'minesweeper'].entries()) {
    const page = gamePages[index];
    assert.match(page, new RegExp('data-game="' + game + '"'));
    assert.ok(page.includes('<meta name="gamevault-ui-version" content="' + packageVersion + '">'));
    const responsiveStylesheetIndex = page.indexOf('responsive-stage3.css');
    const layoutStylesheetPrefix = 'game-layout-stage6.css?v=';
    const layoutStylesheetIndex = page.indexOf(layoutStylesheetPrefix);
    assert.ok(responsiveStylesheetIndex >= 0 && layoutStylesheetIndex > responsiveStylesheetIndex,
      game + ' must load the surrounding-layout stylesheet after responsive styles');
    const cacheVersion = page.slice(layoutStylesheetIndex + layoutStylesheetPrefix.length).split('"')[0];
    cacheVersions.push(cacheVersion);
  }
  assert.deepEqual(cacheVersions, [packageVersion, packageVersion, packageVersion]);
});
