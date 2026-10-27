// Elanlar API-si: həm lokal server (server.js), həm də Vercel funksiyası (api/index.js) bunu işlədir.
// Yaddaş: BLOB_READ_WRITE_TOKEN varsa Vercel Blob, yoxdursa lokal fayllar (data/, public/uploads/).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'listings.json');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');
const BLOB_DATA = 'data/listings.json';
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
// Vercel-də açar mütləq ADMIN_KEY mühit dəyişəni ilə verilməlidir — yoxdursa admin bağlıdır
const ADMIN_KEY = process.env.ADMIN_KEY || (process.env.VERCEL ? null : 'makler2026');

const blob = () => require('@vercel/blob');

async function readListings() {
  if (useBlob) {
    const r = await blob().get(BLOB_DATA, { access: 'public', useCache: false });
    if (r?.statusCode === 200) return JSON.parse(await new Response(r.stream).text());
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); // Blob boşdursa — ilkin elanlar
}

async function writeListings(list) {
  const json = JSON.stringify(list, null, 2);
  if (!useBlob) return fs.writeFileSync(DATA_FILE, json);
  await blob().put(BLOB_DATA, json, {
    access: 'public', contentType: 'application/json; charset=utf-8',
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
  });
}

async function saveUpload(file, buf, type) {
  if (!useBlob) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
    return `/uploads/${file}`;
  }
  const r = await blob().put(`uploads/${file}`, buf, { access: 'public', contentType: type, addRandomSuffix: false });
  return r.url;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Fayl çox böyükdür')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('Yanlış JSON')); }
    });
    req.on('error', reject);
  });
}

const isAdmin = (req) => !!ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY;

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'listings', ':id']
  const id = parts[2];

  if (parts[1] === 'auth' && req.method === 'POST') {
    return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'Açar səhvdir' });
  }

  if (parts[1] === 'upload' && req.method === 'POST') {
    if (!isAdmin(req)) return send(res, 401, { error: 'İcazə yoxdur' });
    const { name = 'foto.jpg', data } = await readBody(req);
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(data || '');
    if (!m) return send(res, 400, { error: 'Yalnız PNG, JPG və ya WEBP şəkil' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const fileUrl = await saveUpload(file, Buffer.from(m[2], 'base64'), `image/${m[1]}`);
    return send(res, 201, { url: fileUrl, name });
  }

  if (parts[1] !== 'listings') return send(res, 404, { error: 'Tapılmadı' });

  const list = await readListings();

  if (req.method === 'GET') {
    if (!id) return send(res, 200, list);
    const item = list.find((l) => l.id === id);
    return item ? send(res, 200, item) : send(res, 404, { error: 'Elan tapılmadı' });
  }

  if (!isAdmin(req)) return send(res, 401, { error: 'İcazə yoxdur' });

  if (req.method === 'POST') {
    const body = await readBody(req);
    const nextId = String(Math.max(1000, ...list.map((l) => Number(l.id) || 0)) + 1);
    const item = { ...body, id: nextId, createdAt: new Date().toISOString() };
    list.unshift(item);
    await writeListings(list);
    return send(res, 201, item);
  }

  const idx = list.findIndex((l) => l.id === id);
  if (idx === -1) return send(res, 404, { error: 'Elan tapılmadı' });

  if (req.method === 'PUT') {
    const body = await readBody(req);
    list[idx] = { ...list[idx], ...body, id, updatedAt: new Date().toISOString() };
    await writeListings(list);
    return send(res, 200, list[idx]);
  }

  if (req.method === 'DELETE') {
    const [removed] = list.splice(idx, 1);
    await writeListings(list);
    return send(res, 200, removed);
  }

  send(res, 405, { error: 'Metod dəstəklənmir' });
}

async function handleApi(req, res) {
  try {
    await api(req, res, new URL(req.url, 'http://localhost'));
  } catch (e) {
    console.error(e);
    send(res, 500, { error: e.message });
  }
}

module.exports = { handleApi, send, ADMIN_KEY };
