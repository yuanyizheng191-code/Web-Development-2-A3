/**
 * tools/preview-server.js
 * ---------------------------------------------------------------------------
 * A tiny static web server used ONLY during development to preview the built
 * Angular applications the way they will behave on cPanel:
 *
 *   * it serves the compiled Angular files from a dist folder
 *   * it falls back to index.html for unknown paths (Angular client-side routing)
 *   * it proxies /api/* to the Express API, exactly like the cPanel setup where
 *     the API lives at the same origin under /api
 *
 * This lets the production build (which uses the relative apiBase '/api') be
 * tested locally without rebuilding with different environment values.
 *
 * Usage:
 *   node tools/preview-server.js <dist-folder> [port] [--base=/admin]
 *   node tools/preview-server.js ng-client/dist/clientside/browser 4201
 *
 * PROG2002 A3 - team40 - Yizheng Yuan (24833044), Mu Li (224832355)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const distArg = process.argv[2];
if (!distArg) {
  console.error('Usage: node tools/preview-server.js <dist-folder> [port] [--base=/admin]');
  process.exit(1);
}

const distDir = path.resolve(distArg);
const portArg = process.argv.slice(3).find((a) => /^\d+$/.test(a));
const port = Number(portArg || 4201);
const baseArg = process.argv.find((a) => a.startsWith('--base='));
const basePath = baseArg ? baseArg.replace('--base=', '').replace(/\/$/, '') : '';

const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:3000';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

if (!fs.existsSync(distDir)) {
  console.error(`The dist folder does not exist: ${distDir}`);
  console.error('Build the app first, e.g.  npx ng build --configuration development');
  process.exit(1);
}

/** Proxy an /api request to the Express server. */
function proxy(req, res, body) {
  const target = new URL(req.url, API_TARGET);
  const headers = { ...req.headers, host: new URL(API_TARGET).host };

  const upstream = http.request(
    target,
    { method: req.method, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        success: false,
        error: { status: 502, message: `The preview proxy could not reach the API: ${err.message}` },
      }),
    );
  });

  if (body && body.length) upstream.write(body);
  upstream.end();
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    // 1. API passthrough (relative apiBase '/api' needs this).
    if (req.url.startsWith('/api')) {
      return proxy(req, res, body);
    }

    // 2. Strip the optional base path (mirrors hosting the app under /admin).
    let urlPath = req.url.split('?')[0];
    if (basePath && urlPath.startsWith(basePath)) {
      urlPath = urlPath.slice(basePath.length) || '/';
    }

    // 3. Serve a real file when it exists.
    const candidate = path.join(distDir, decodeURIComponent(urlPath));
    if (candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const ext = path.extname(candidate).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      return fs.createReadStream(candidate).pipe(res);
    }

    // 4. Otherwise hand back index.html and let the Angular router decide.
    const indexFile = path.join(distDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return fs.createReadStream(indexFile).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': MIME['.txt'] });
    res.end('index.html not found in ' + distDir);
  });
});

server.listen(port, () => {
  console.log(`Previewing ${distDir}`);
  console.log(`  http://localhost:${port}${basePath}/`);
  console.log(`  /api/* proxied to ${API_TARGET}`);
});
