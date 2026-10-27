// Sadə, asılılıqsız Node.js server: statik fayllar + elanlar üçün JSON API (lib/core.js)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi, send, ADMIN_KEY } = require('./lib/core');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, url) {
  let filePath = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(url.pathname)));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html'); // SPA fallback
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res);
    else serveStatic(req, res, url);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, () => {
  console.log(`\n  Torpaq sayt işləyir:  http://localhost:${PORT}`);
  console.log(`  Admin panel:          http://localhost:${PORT}/#/admin   (açar: ${ADMIN_KEY})\n`);
});
