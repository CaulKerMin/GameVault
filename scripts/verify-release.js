'use strict';

// Release gate: syntax-check JavaScript and verify local HTML/CSS references.
// Uses only Node.js built-in modules so it runs without npm install.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const errors = [];
const warnings = [];

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function isExternal(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value.trim());
}

function splitReference(raw) {
  let value = raw.trim();
  try { value = decodeURIComponent(value); } catch { /* malformed path is checked below */ }
  const hashAt = value.indexOf('#');
  const hash = hashAt >= 0 ? value.slice(hashAt + 1) : '';
  if (hashAt >= 0) value = value.slice(0, hashAt);
  const queryAt = value.indexOf('?');
  if (queryAt >= 0) value = value.slice(0, queryAt);
  return { pathname: value, hash };
}

function resolveLocalReference(fromFile, raw, kind) {
  const value = raw.trim();
  if (!value || isExternal(value) || value.startsWith('data:')) return null;
  const { pathname, hash } = splitReference(value);
  let target = pathname
    ? path.resolve(path.dirname(fromFile), pathname)
    : fromFile;
  if (pathname.startsWith('/')) target = path.resolve(ROOT, `.${pathname}`);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    errors.push(`${path.relative(ROOT, fromFile)}: missing ${kind} reference "${raw}"`);
    return null;
  }
  return { target, hash };
}

const files = walk(ROOT);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const cssFiles = files.filter((file) => file.endsWith('.css'));
const htmlIds = new Map();

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  htmlIds.set(file, new Set([...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1])));
}

for (const file of jsFiles) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) {
    errors.push(`${path.relative(ROOT, file)}: JavaScript syntax check failed\n${(checked.stderr || checked.stdout || '').trim()}`);
  }
}

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const attrs = /\b(href|src)\s*=\s*(["'])(.*?)\2/gi;
  for (const match of source.matchAll(attrs)) {
    const [, attribute, , value] = match;
    const resolved = resolveLocalReference(file, value, attribute);
    if (resolved?.hash && htmlIds.has(resolved.target) && !htmlIds.get(resolved.target).has(resolved.hash)) {
      errors.push(`${path.relative(ROOT, file)}: missing anchor "#${resolved.hash}" in ${path.relative(ROOT, resolved.target)}`);
    }
  }
}

for (const file of cssFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const refs = [
    ...[...source.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map((match) => match[2]),
    ...[...source.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)].map((match) => match[1]),
  ];
  for (const ref of refs) resolveLocalReference(file, ref, 'CSS asset');
}

const pkgPath = path.join(ROOT, 'package.json');
const readmePath = path.join(ROOT, 'README.md');
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  if (!readme.includes(`v${pkg.version}`)) errors.push(`README.md: version does not match package.json (${pkg.version})`);
  if (!pkg.scripts?.test || !pkg.scripts?.['verify:release']) errors.push('package.json: expected test and verify:release scripts');

  const pagesWorkflowPath = path.join(ROOT, '.github', 'workflows', 'pages.yml');
  if (!fs.existsSync(pagesWorkflowPath)) {
    errors.push('.github/workflows/pages.yml: missing GitHub Pages workflow');
  } else {
    const workflow = fs.readFileSync(pagesWorkflowPath, 'utf8');
    const requiredWorkflowMarkers = [
      'actions/upload-pages-artifact@v3',
      'actions/deploy-pages@v4',
      'actions/upload-artifact@v4',
      'retention-days: 90',
      'npm test',
      'npm run verify:release',
      'zip -r',
      'sha256sum',
      'path: frontend',
    ];
    for (const marker of requiredWorkflowMarkers) {
      if (!workflow.includes(marker)) errors.push(`.github/workflows/pages.yml: missing required deployment/package setting: ${marker}`);
    }
  }
} catch (error) {
  errors.push(`Release metadata check failed: ${error.message}`);
}

if (errors.length) {
  console.error(`Release verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Release verification passed.');
  console.log(`- JavaScript syntax: ${jsFiles.length} files`);
  console.log(`- HTML local references and anchors: ${htmlFiles.length} pages`);
  console.log(`- CSS asset references: ${cssFiles.length} stylesheets`);
  console.log('- package/README version metadata: consistent');
}
