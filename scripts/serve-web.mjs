import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
http
  .createServer((req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    let path;
    try {
      path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(path) || !statSync(path).isFile()) path = resolve(root, 'index.html');
    if (!existsSync(path)) {
      res.writeHead(404).end('Run expo export first');
      return;
    }
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    createReadStream(path).pipe(res);
  })
  .listen(8081, '127.0.0.1', () => console.log('NutriTrack preview: http://127.0.0.1:8081'));
