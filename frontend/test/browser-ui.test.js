'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStaticServer } = require('../dev-server');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const games = [
  { id: '2048', route: '/games/2048/index.html', board: '.puzzle-board', cells: '.tile', expectedCells: 16, touch: '.mobile-controls button' },
  { id: 'snake', route: '/games/snake/index.html', board: '.canvas-wrap', touch: '.dpad button', overlay: '.overlay-card', boardStage: '.board-stage' },
  { id: 'minesweeper', route: '/games/minesweeper/index.html', board: '.mine-board', cells: '.mine-cell', expectedCells: 64, touch: '#flag-mode-button' },
];

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1600x900', width: 1600, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x740', width: 360, height: 740 },
];

const screenshotDir = path.resolve(process.cwd(), 'artifacts/browser-ui');

test('Chromium verifies all game pages across desktop and mobile viewports', {
  skip: !chromium ? 'Playwright is not installed; CI installs it before running npm test.' : false,
}, async (t) => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const server = createStaticServer({ root: path.resolve(__dirname, '..') });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const baseUrl = 'http://127.0.0.1:' + server.address().port;

    for (const game of games) {
      for (const viewport of viewports) {
        await t.test(game.id + ' at ' + viewport.name, async () => {
          const page = await browser.newPage({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: 1,
          });
          const pageErrors = [];
          page.setDefaultTimeout(5000);
          page.on('pageerror', (error) => pageErrors.push(error.message));

          try {
            await page.route('http://localhost:3001/api/**', (route) => route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ ok: true, entries: [] }),
            }));

            await page.goto(baseUrl + game.route, { waitUntil: 'networkidle' });
            await page.evaluate(() => document.fonts.ready);
            await page.locator(game.board).waitFor({ state: 'visible' });

            const screenshotPath = path.join(screenshotDir, game.id + '-' + viewport.name + '.png');
            await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' });

            const metrics = await page.evaluate((selectors) => {
              function box(selector) {
                if (!selector) return null;
                const element = document.querySelector(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return {
                  top: Math.round(rect.top * 10) / 10,
                  right: Math.round(rect.right * 10) / 10,
                  bottom: Math.round(rect.bottom * 10) / 10,
                  left: Math.round(rect.left * 10) / 10,
                  width: Math.round(rect.width * 10) / 10,
                  height: Math.round(rect.height * 10) / 10,
                  visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
                };
              }

              return {
                gameId: document.body.dataset.game,
                viewport: { width: innerWidth, height: innerHeight },
                documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
                header: box('.site-header'),
                heading: box('.game-page-heading'),
                mainPanel: box('.game-main-panel'),
                board: box(selectors.board),
                boardCells: selectors.cells ? [...document.querySelectorAll(selectors.cells)].map((element) => {
                  const rect = element.getBoundingClientRect();
                  return {
                    width: Math.round(rect.width * 10) / 10,
                    height: Math.round(rect.height * 10) / 10,
                  };
                }) : [],
                controls: box('.game-controls'),
                touch: box(selectors.touch),
                overlay: box(selectors.overlay),
                boardStage: box(selectors.boardStage),
                status: box('#status-pill'),
              };
            }, { board: game.board, cells: game.cells || null, touch: game.touch, overlay: game.overlay || null, boardStage: game.boardStage || null });

            const detail = JSON.stringify(metrics);
            assert.equal(metrics.gameId, game.id, 'The expected game page should load. ' + detail);
            assert.ok(metrics.mainPanel && metrics.mainPanel.visible, 'The main game panel should be visible. ' + detail);
            assert.ok(metrics.board && metrics.board.visible, 'The game board should be visible. ' + detail);
            assert.ok(metrics.controls && metrics.controls.visible, 'The game controls should be visible. ' + detail);
            assert.ok(metrics.documentWidth <= viewport.width + 1, 'Unexpected horizontal page overflow. ' + detail);
            assert.ok(metrics.board.left >= -1 && metrics.board.right <= viewport.width + 1,
              'The game board should fit horizontally. ' + detail);
            assert.ok(Math.abs(metrics.board.width - metrics.board.height) <= 1.5,
              'The playable surface must remain square. ' + detail);
            const minimumBoardSize = viewport.width > 820 ? 420 : 260;
            assert.ok(metrics.board.width >= minimumBoardSize,
              'The playable surface must not be shrunk to fit the viewport height. ' + detail);
            if (game.cells) {
              assert.equal(metrics.boardCells.length, game.expectedCells,
                'The expected number of playable cells should be present. ' + detail);
              assert.ok(metrics.boardCells.every((cell) => Math.abs(cell.width - cell.height) <= 1.5),
                'Every puzzle / minesweeper cell must remain square. ' + detail);
            }
            assert.deepEqual(pageErrors, [], 'The page should not throw JavaScript exceptions.');

            if (game.id === 'snake') {
              assert.ok(metrics.overlay && metrics.overlay.visible && metrics.boardStage,
                'The snake start / pause card and canvas stage should both be visible. ' + detail);
              assert.ok(metrics.overlay.top >= metrics.boardStage.top - 1
                && metrics.overlay.bottom <= metrics.boardStage.bottom + 1,
              'The snake overlay card must stay completely inside its canvas. ' + detail);
              assert.ok(metrics.overlay.bottom <= metrics.controls.top + 1,
                'The snake overlay must not overlap the controls below the canvas. ' + detail);
            }

            if (viewport.width > 820) {
              assert.ok(metrics.heading && metrics.heading.top < viewport.height,
                'The game heading should begin in the first desktop viewport. ' + detail);
              assert.ok(metrics.board.top < viewport.height,
                'The playable surface should begin in the first desktop viewport. ' + detail);
            } else {
              assert.ok(metrics.touch && metrics.touch.visible,
                'The mobile touch control should be visible. ' + detail);
              assert.ok(metrics.touch.height >= 40,
                'The mobile touch target should be at least 40 CSS pixels high. ' + detail);
            }

            if (viewport.name === '1920x1080') {
              if (game.id === 'snake') {
                await page.locator('#start-button').click();
                assert.equal(await page.locator('#status-pill').getAttribute('data-state'), 'playing');
                await page.locator('#pause-button').click();
                assert.equal(await page.locator('#status-pill').getAttribute('data-state'), 'paused');
              } else if (game.id === '2048') {
                await page.locator('#puzzle-board').focus();
                await page.keyboard.press('ArrowLeft');
                assert.equal(await page.locator('#status-pill').getAttribute('data-state'), 'playing');
              } else {
                await page.locator('.mine-cell').first().click();
                assert.equal(await page.locator('#status-pill').getAttribute('data-state'), 'playing');
                assert.equal(await page.locator('.mine-cell').count(), 64);
              }
            }

            if (viewport.name === '390x844') {
              if (game.id === 'snake') {
                await page.locator('.dpad [data-dir="up"]').click();
                assert.equal(await page.locator('#status-pill').getAttribute('data-state'), 'playing');
              } else if (game.id === '2048') {
                await page.locator('.mobile-controls [data-move="left"]').click();
              } else {
                await page.locator('#flag-mode-button').click();
                assert.equal(await page.locator('#flag-mode-button').getAttribute('aria-pressed'), 'true');
              }
            }

            assert.deepEqual(pageErrors, [], 'Interactions should not throw JavaScript exceptions.');
            console.log('[browser-ui] ' + game.id + ' ' + viewport.name + ' ' + JSON.stringify({
              panelBottom: metrics.mainPanel.bottom,
              boardBottom: metrics.board.bottom,
              controlsBottom: metrics.controls.bottom,
              documentWidth: metrics.documentWidth,
              screenshot: path.relative(process.cwd(), screenshotPath),
            }));
          } finally {
            await page.close();
          }
        });
      }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
