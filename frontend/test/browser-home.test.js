'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createStaticServer } = require('../dev-server');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  chromium = null;
}

const screenshotDir = path.resolve(process.cwd(), 'artifacts/browser-ui');
const routes = [
  { id: 'home', path: '/', width: 1366, height: 900 },
  { id: 'snake', path: '/games/snake/index.html', width: 1366, height: 900 },
  { id: '2048', path: '/games/2048/index.html', width: 1366, height: 900 },
  { id: 'minesweeper', path: '/games/minesweeper/index.html', width: 1366, height: 900 },
  { id: 'home-mobile-390', path: '/', width: 390, height: 844 },
  { id: 'home-mobile-360', path: '/', width: 360, height: 740 },
];

async function withBrowser(run) {
  const server = createStaticServer({ root: path.resolve(__dirname, '..') });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await run(browser, 'http://127.0.0.1:' + server.address().port);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

function luminance(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  assert.ok(match, 'Expected a six-digit hex color, received ' + hex);
  const channels = [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function assertTheme(page, theme, viewport) {
  const state = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    stored: localStorage.getItem('gamevault.theme'),
    background: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    text: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    toggleLabel: document.querySelector('[data-theme-toggle]')?.getAttribute('aria-label'),
    overlayHeadingColor: document.querySelector('.overlay-card h3')
      ? getComputedStyle(document.querySelector('.overlay-card h3')).color : null,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    overflowElements: [...document.querySelectorAll('body *')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        text: (element.textContent || '').trim().slice(0, 50),
      };
    }).filter((element) => element.width > 0 && (element.left < -1 || element.right > innerWidth + 1))
      .sort((a, b) => b.right - a.right).slice(0, 12),
  }));

  const expected = theme === 'light'
    ? { background: '#f3f5fc', text: '#20263c', colorScheme: 'light', toggleLabel: '切换深色主题' }
    : { background: '#0a0d17', text: '#f3f5ff', colorScheme: 'dark', toggleLabel: '切换浅色主题' };

  assert.equal(state.theme, theme, 'The root theme should be ' + theme);
  assert.equal(state.stored, theme, 'The selected theme should persist in localStorage');
  assert.equal(state.background, expected.background, 'The theme background token should match');
  assert.equal(state.text, expected.text, 'The theme text token should match');
  assert.equal(state.colorScheme, expected.colorScheme, 'The browser color scheme should match');
  assert.equal(state.toggleLabel, expected.toggleLabel, 'The theme toggle should announce the next action');
  if (state.overlayHeadingColor !== null) {
    assert.equal(state.overlayHeadingColor, 'rgb(243, 245, 255)',
      'The snake overlay title must stay light on its dark canvas in both themes');
  }
  assert.ok(contrastRatio(state.text, state.background) >= 7,
    'Primary text contrast should be at least 7:1 in ' + theme + ' mode');
  assert.ok(state.documentWidth <= viewport.width + 1,
    'Theme changes must not introduce horizontal overflow: ' + JSON.stringify(state));
  assert.deepEqual(state.overflowElements, [],
    'No visible element should extend beyond the viewport: ' + JSON.stringify(state.overflowElements));
}

test('Chromium verifies dark/light theme switching and persistence on every page', {
  skip: !chromium ? 'Playwright is not installed; CI installs it before running npm test.' : false,
}, async (t) => {
  const fs = require('node:fs');
  fs.mkdirSync(screenshotDir, { recursive: true });

  await withBrowser(async (browser, baseUrl) => {
    for (const route of routes) {
      await t.test(route.id + ' theme toggle and persistence', async () => {
        const page = await browser.newPage({
          viewport: { width: route.width, height: route.height },
          deviceScaleFactor: 1,
        });
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        try {
          await page.route('http://localhost:3001/api/**', (request) => request.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, entries: [] }),
          }));
          await page.goto(baseUrl + route.path, { waitUntil: 'networkidle' });
          // The initial dark theme is the default and is not written until a user toggles it.
          // Seed it explicitly so this case can also verify reload persistence.
          await page.evaluate(() => localStorage.setItem('gamevault.theme', 'dark'));
          await page.screenshot({
            path: path.join(screenshotDir, 'theme-' + route.id + '-dark.png'),
            fullPage: false,
            animations: 'disabled',
          });
          await assertTheme(page, 'dark', route);

          await page.locator('[data-theme-toggle]').click();
          await assertTheme(page, 'light', route);
          await page.screenshot({
            path: path.join(screenshotDir, 'theme-' + route.id + '-light.png'),
            fullPage: false,
            animations: 'disabled',
          });

          await page.reload({ waitUntil: 'networkidle' });
          await assertTheme(page, 'light', route);

          await page.locator('[data-theme-toggle]').click();
          await assertTheme(page, 'dark', route);
          await page.reload({ waitUntil: 'networkidle' });
          await assertTheme(page, 'dark', route);

          assert.deepEqual(pageErrors, [], 'Theme switching and reloads should not throw JavaScript exceptions.');
        } finally {
          await page.close();
        }
      });
    }

    await t.test('theme selection follows navigation from the homepage into a game', async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      try {
        await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
        await page.locator('[data-theme-toggle]').click();
        await assertTheme(page, 'light', { width: 1366 });
        await page.locator('[data-last-game="2048"]').click();
        await page.waitForURL((url) => url.pathname.endsWith('/games/2048/index.html'));
        await assertTheme(page, 'light', { width: 1366 });
        await page.locator('[data-theme-toggle]').click();
        await assertTheme(page, 'dark', { width: 1366 });
        await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
        await assertTheme(page, 'dark', { width: 1366 });
      } finally {
        await page.close();
      }
    });
  });
});

test('Chromium verifies homepage search, recent-play state and navigation', {
  skip: !chromium ? 'Playwright is not installed; CI installs it before running npm test.' : false,
}, async (t) => {
  await withBrowser(async (browser, baseUrl) => {
    for (const viewport of [
      { name: 'desktop', width: 1366, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await t.test(viewport.name + ' search and recent-play flow', async () => {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        try {
          await page.route('http://localhost:3001/api/**', (request) => request.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, entries: [] }),
          }));
          await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
          const search = page.locator('[data-game-search]');

          await search.fill('2048');
          assert.equal(await page.locator('[data-game-card]:visible').count(), 1);
          assert.match(await page.locator('[data-game-card]:visible').innerText(), /2048/);

          await search.fill('not-a-real-game');
          assert.equal(await page.locator('[data-game-card]:visible').count(), 0);
          await page.locator('[data-empty-state]').waitFor({ state: 'visible' });

          await search.fill('扫雷');
          assert.equal(await page.locator('[data-game-card]:visible').count(), 1);
          assert.match(await page.locator('[data-game-card]:visible').innerText(), /扫雷/);

          await search.fill('');
          assert.equal(await page.locator('[data-game-card]:visible').count(), 3);
          assert.equal(await page.locator('[data-empty-state]').isVisible(), false);

          await page.locator('[data-last-game="snake"]').click();
          await page.waitForURL((url) => url.pathname.endsWith('/games/snake/index.html'));
          const recentAfterStart = await page.evaluate(() => ({
            game: localStorage.getItem('gamevault.lastGame'),
            at: localStorage.getItem('gamevault.lastGameAt'),
          }));
          assert.equal(recentAfterStart.game, 'snake');
          assert.ok(Number.isFinite(Date.parse(recentAfterStart.at)));

          await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
          await page.locator('[data-recent-wrap]').waitFor({ state: 'visible' });
          assert.match(await page.locator('[data-recent-game-title]').innerText(), /继续贪吃蛇/);
          assert.equal(await page.locator('[data-recent-game]').getAttribute('href'), 'games/snake/index.html');
          await page.locator('[data-recent-game]').click();
          await page.waitForURL((url) => url.pathname.endsWith('/games/snake/index.html'));

          const recentAfterContinue = await page.evaluate(() => ({
            game: localStorage.getItem('gamevault.lastGame'),
            at: localStorage.getItem('gamevault.lastGameAt'),
          }));
          assert.equal(recentAfterContinue.game, 'snake');
          assert.ok(Number.isFinite(Date.parse(recentAfterContinue.at)));

          const documentWidth = await page.evaluate(() =>
            Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
          assert.ok(documentWidth <= viewport.width + 1, 'Homepage interactions should not cause horizontal overflow.');
          assert.deepEqual(pageErrors, [], 'Search and recent-play navigation should not throw JavaScript exceptions.');
        } finally {
          await page.close();
        }
      });
    }
  });
});

test('Chromium verifies homepage leaderboard rendering and empty state', {
  skip: !chromium ? 'Playwright is not installed; CI installs it before running npm test.' : false,
}, async (t) => {
  await withBrowser(async (browser, baseUrl) => {
    await t.test('server leaderboard sorts and displays the top three per game', async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      const responses = {
        snake: [
          { id: 's-1', game: 'snake', score: 300, name: '玩家甲', createdAt: '2026-10-30T10:00:00.000Z' },
          { id: 's-2', game: 'snake', score: 100, name: '玩家丁', createdAt: '2026-10-30T10:03:00.000Z' },
          { id: 's-3', game: 'snake', score: 250, name: '玩家乙', createdAt: '2026-10-30T10:01:00.000Z' },
          { id: 's-4', game: 'snake', score: 200, name: '玩家丙', createdAt: '2026-10-30T10:02:00.000Z' },
        ],
        '2048': [
          { id: 'p-1', game: '2048', score: 2048, name: '数字高手', createdAt: '2026-10-30T10:00:00.000Z' },
          { id: 'p-2', game: '2048', score: 4096, name: '合并大师', createdAt: '2026-10-30T10:01:00.000Z' },
        ],
        minesweeper: [],
      };

      await page.route('http://localhost:3001/api/**', async (route) => {
        const url = new URL(route.request().url());
        const game = url.searchParams.get('game');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, entries: responses[game] || [] }),
        });
      });

      try {
        await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
        const leaderboard = page.locator('[data-home-leaderboard]');
        await page.waitForFunction(() =>
          document.querySelector('[data-home-leaderboard]')?.getAttribute('aria-busy') === 'false');

        assert.match(await leaderboard.locator('.leaderboard-status').innerText(), /共享排行榜已连接/);
        const groups = leaderboard.locator('.mini-leaderboard-group');
        assert.equal(await groups.count(), 2);

        // JavaScript enumerates integer-like object keys (the "2048" key) before string keys.
        const snakeGroup = groups.filter({ hasText: '贪吃蛇' });
        assert.equal(await snakeGroup.locator('.leaderboard-row').count(), 3);
        assert.match(await snakeGroup.locator('.leaderboard-row').nth(0).innerText(), /玩家甲.*300/s);
        assert.match(await snakeGroup.locator('.leaderboard-row').nth(1).innerText(), /玩家乙.*250/s);
        assert.match(await snakeGroup.locator('.leaderboard-row').nth(2).innerText(), /玩家丙.*200/s);
        assert.deepEqual(await snakeGroup.locator('.leaderboard-rank').allTextContents(), ['01', '02', '03']);

        const puzzleGroup = groups.filter({ hasText: '2048' });
        assert.match(await puzzleGroup.locator('h3').innerText(), /2048/);
        assert.equal(await puzzleGroup.locator('.leaderboard-row').count(), 2);
        const topPuzzleRow = await puzzleGroup.locator('.leaderboard-row').nth(0).innerText();
        assert.ok(topPuzzleRow.includes('合并大师') && topPuzzleRow.includes('4,096'));

        await page.locator('#records').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(screenshotDir, 'home-leaderboard-server.png'),
          fullPage: false,
          animations: 'disabled',
        });
      } finally {
        await page.close();
      }
    });

    await t.test('empty leaderboard displays a useful empty state', async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      await page.route('http://localhost:3001/api/**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, entries: [] }),
      }));

      try {
        await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
        await page.waitForFunction(() =>
          document.querySelector('[data-home-leaderboard]')?.getAttribute('aria-busy') === 'false');
        assert.match(await page.locator('.leaderboard-empty strong').innerText(), /还没有成绩/);
        assert.match(await page.locator('.leaderboard-status').innerText(), /共享排行榜已连接/);
      } finally {
        await page.close();
      }
    });

    await t.test('API failure falls back to local scores with an offline status', async () => {
      const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
      const localScores = [
        { id: 'local-snake-1', game: 'snake', score: 125, name: '本地玩家', createdAt: '2026-10-30T10:00:00.000Z', syncStatus: 'local' },
        { id: 'local-snake-2', game: 'snake', score: 456, name: '本地高手', createdAt: '2026-10-30T10:01:00.000Z', syncStatus: 'local' },
      ];
      await page.addInitScript((scores) => {
        localStorage.setItem('gamevault.scores.v1', JSON.stringify(scores));
      }, localScores);
      await page.route('http://localhost:3001/api/**', (route) => route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'test unavailable' }),
      }));

      try {
        await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
        const leaderboard = page.locator('[data-home-leaderboard]');
        await page.waitForFunction(() =>
          document.querySelector('[data-home-leaderboard]')?.getAttribute('aria-busy') === 'false');

        assert.match(await leaderboard.locator('.leaderboard-status').innerText(), /API 暂不可用，当前显示本机记录/);
        const snakeGroup = leaderboard.locator('.mini-leaderboard-group').filter({ hasText: '贪吃蛇' });
        assert.equal(await snakeGroup.locator('.leaderboard-row').count(), 2);
        assert.ok((await snakeGroup.locator('.leaderboard-row').nth(0).innerText()).includes('本地高手'));
        assert.ok((await snakeGroup.locator('.leaderboard-row').nth(0).innerText()).includes('456'));
        assert.ok((await snakeGroup.locator('.leaderboard-row').nth(1).innerText()).includes('本地玩家'));
        assert.ok((await snakeGroup.locator('.leaderboard-row').nth(1).innerText()).includes('125'));
      } finally {
        await page.close();
      }
    });
  });
});
