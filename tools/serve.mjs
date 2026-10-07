// 本機試玩與 e2e 用的小型靜態伺服器（不需要任何套件）。
// 用法：npm run serve            → http://localhost:8000
//       npm run serve -- 8080     → 換 port
//       npm run serve -- --lan    → 綁 0.0.0.0，可用區網 IP 開（指控頁會提示無法判定，這是預期的）
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

export function startServer({ root = ROOT, port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, '.' + rel);
      if (!file.startsWith(root + path.sep)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
      const info = await stat(file);
      if (!info.isFile()) throw Object.assign(new Error('not a file'), { code: 'ENOENT' });
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(body);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 找不到這個檔案');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const { port: actual } = server.address();
      resolve({ server, port: actual, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const lan = args.includes('--lan');
  const portArg = args.find((a) => /^\d+$/.test(a));
  const { port } = await startServer({ port: portArg ? Number(portArg) : 8000, host: lan ? '0.0.0.0' : '127.0.0.1' });
  console.log(`遊戲已啟動：http://localhost:${port}/`);
  if (lan) console.log('（區網 IP 是 http，不是安全環境；指控頁會提示無法判定，正式遊玩請用 GitHub Pages 的 https 網址。）');
  console.log('按 Ctrl+C 結束。');
}
