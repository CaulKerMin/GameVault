'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function isInside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function createStaticServer(options = {}) {
  const root = path.resolve(options.root || __dirname);
  const rootRealPathPromise = fs.realpath(root);

  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        Allow: 'GET, HEAD',
      });
      res.end('Method not allowed');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }
    if (pathname.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    const lexicalTarget = path.resolve(root, `.${pathname}`);
    if (!isInside(root, lexicalTarget)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    try {
      const rootRealPath = await rootRealPathPromise;
      let target = await fs.realpath(lexicalTarget);
      if (!isInside(rootRealPath, target)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      let info = await fs.stat(target);
      if (info.isDirectory()) {
        target = await fs.realpath(path.join(target, 'index.html'));
        if (!isInside(rootRealPath, target)) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Forbidden');
          return;
        }
        info = await fs.stat(target);
      }
      if (!info.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const content = await fs.readFile(target);
      res.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'Content-Length': content.length,
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error && error.code === 'EACCES' ? 403 : 404;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(status === 403 ? 'Forbidden' : 'Not found');
    }
  });
}

if (require.main === module) {
  const parsedPort = Number.parseInt(process.env.WEB_PORT || '5173', 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 5173;
  const server = createStaticServer();
  server.on('error', (error) => {
    console.error(`Could not start GameVault frontend server: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`GameVault frontend: http://localhost:${port}`);
  });
}

module.exports = { createStaticServer, mimeTypes };
