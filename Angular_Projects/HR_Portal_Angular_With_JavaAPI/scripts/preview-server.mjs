// Serves the production build (dist/) with SPA fallback and proxies /api to the gateway (same behaviour as the dev proxy).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'hr-portal-angular-with-java-api', 'browser');
const gateway = new URL(process.env.HR_GATEWAY_URL || 'http://localhost:9080');
const port = Number(process.env.PORT || 4300);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const headers = { ...req.headers, host: gateway.host }; delete headers.origin;
    const up = http.request({ host: gateway.hostname, port: gateway.port, path: req.url, method: req.method, headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"message":"Gateway unreachable"}'); });
    req.pipe(up); return;
  }
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': f.endsWith('index.html') ? 'no-cache' : 'public,max-age=31536000' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`HR Portal (production build) on http://localhost:${port}`));
