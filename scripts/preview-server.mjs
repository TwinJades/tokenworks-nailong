import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('site'), port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // /repo/ exercises GitHub Pages project-site paths locally.
    if (path.startsWith('/repo/')) path = path.slice(5);
    const file = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Preview ready http://127.0.0.1:${port}`));
