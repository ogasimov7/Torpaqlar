// API: həm lokal server (server.js), həm də Vercel funksiyası (api/index.js) bunu işlədir.
// Yaddaş: BLOB_READ_WRITE_TOKEN varsa Vercel Blob, yoxdursa lokal fayllar (data/, public/uploads/).
//
// Kolleksiyalar:
//   listings — elanlar (GET hamıya açıqdır, dəyişiklik yalnız admin)
//   leads    — müraciətlər (yalnız admin; saytdan gələnlər POST /api/inquiry ilə yazılır)
//   clients  — müştərilər, tasks — tapşırıqlar, notes — qeydlər (yalnız admin)
//   submissions — saytdan göndərilən elanlar: "torpaq satıram" / "torpaq axtarıram" (yalnız admin; saytdan POST /api/submit)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
// Vercel-də açar mütləq ADMIN_KEY mühit dəyişəni ilə verilməlidir — yoxdursa admin bağlıdır
const ADMIN_KEY = process.env.ADMIN_KEY || (process.env.VERCEL ? null : 'makler2026');

const COLLECTIONS = ['listings', 'leads', 'clients', 'tasks', 'notes', 'submissions'];

const blob = () => require('@vercel/blob');

// Vercel Blob-da hər yazı yeni fayldır: db/<kolleksiya>/<zaman>-<təsadüfi>.json
//  - public Blob CDN-də ~60 san keşlənir; sabit adın üstünə yazsaq köhnə versiya oxunar və
//    ardıcıl iki yazıda biri itə bilər. Yeni ad + list() (keşsiz API) həmişə ən son versiyanı verir.
//  - Ad təxmin edilə bilmir (32 simvollu təsadüfi hissə), list() isə yalnız token ilə işləyir —
//    müştəri məlumatları ictimai ünvanla açıla bilməz.
const KEEP_VERSIONS = 10;
const prefixOf = (name) => `db/${name}/`;

async function versions(name) {
  const { blobs } = await blob().list({ prefix: prefixOf(name), limit: 1000 });
  return blobs.sort((a, b) => b.pathname.localeCompare(a.pathname)); // ən yenisi birinci
}

async function readCol(name) {
  if (useBlob) {
    const [latest] = await versions(name);
    if (latest) {
      const r = await fetch(latest.url);
      if (!r.ok) throw new Error(`Məlumat oxunmadı (${name}: ${r.status})`);
      return r.json();
    }
    // Köhnə sxem: data/<kolleksiya>.json (əvvəlki elanlar burada qalıb)
    const old = await blob().get(`data/${name}.json`, { access: 'public' });
    if (old?.statusCode === 200) return JSON.parse(await new Response(old.stream).text());
  }
  // Blob boşdursa — repodakı ilkin məlumat (yalnız elanlar üçün var), yoxdursa boş siyahı
  const file = path.join(DATA_DIR, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

async function writeCol(name, list) {
  const json = JSON.stringify(list, null, 2);
  if (!useBlob) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), json);
  }
  const key = `${prefixOf(name)}${String(Date.now()).padStart(15, '0')}-${crypto.randomBytes(16).toString('hex')}.json`;
  await blob().put(key, json, {
    access: 'public', contentType: 'application/json; charset=utf-8', addRandomSuffix: false,
  });
  // Son bir neçə versiya ehtiyat kimi qalır, köhnələr silinir
  try {
    const stale = (await versions(name)).slice(KEEP_VERSIONS).map((b) => b.url);
    if (stale.length) await blob().del(stale);
  } catch (e) { console.error('Köhnə versiyalar silinmədi:', e.message); }
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
      if (size > limit) { reject(new Error('Sorğu çox böyükdür')); req.destroy(); }
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
const newId = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// Saytdan gələn sorğular üçün sadə limit: bir IP-dən 10 dəqiqədə `max` sorğu (növə görə ayrıca)
const hits = new Map();
function rateLimited(req, kind = 'lead', max = 6) {
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 10 * 60e3);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
const TOO_MANY = 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.';
const num = (v, max = 1e10) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? n : ''; };
const strList = (v, n, len) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x) => x.trim().slice(0, len)).filter(Boolean) : []);

// Saytdakı formadan müraciət: yalnız icazəli sahələr qəbul olunur
async function publicLead(req, res) {
  const b = await readBody(req, 16 * 1024);
  if (b.website) return send(res, 201, { ok: true }); // bot tələsi (gizli sahə)
  const name = clip(b.name, 100);
  const phone = clip(b.phone, 40);
  if (!name || phone.replace(/\D/g, '').length < 7) return send(res, 400, { error: 'Ad və telefon nömrəsini düzgün yazın' });
  if (rateLimited(req)) return send(res, 429, { error: TOO_MANY });
  const listingId = clip(b.listingId, 20);
  const listings = listingId ? await readCol('listings') : [];
  const listing = listings.find((l) => l.id === listingId);
  const lead = {
    id: newId(),
    name, phone,
    email: clip(b.email, 120),
    message: clip(b.message, 2000),
    goal: ['almaq', 'satmaq'].includes(b.goal) ? b.goal : 'almaq',
    listingId: listing ? listing.id : '',
    source: listing ? 'site' : 'contact',
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  const leads = await readCol('leads');
  leads.unshift(lead);
  await writeCol('leads', leads);
  return send(res, 201, { ok: true, id: lead.id });
}

// Saytdan elan: "sell" — torpaq satıram (admin təsdiq edib elan kimi paylaşır),
// "seek" — torpaq axtarıram (admin müştəri ilə əlaqə saxlayır). Yalnız icazəli sahələr yazılır.
async function publicSubmission(req, res) {
  const b = await readBody(req, 64 * 1024);
  if (b.website) return send(res, 201, { ok: true }); // bot tələsi
  const type = b.type === 'seek' ? 'seek' : b.type === 'sell' ? 'sell' : null;
  const name = clip(b.name, 100);
  const phone = clip(b.phone, 40);
  if (!type) return send(res, 400, { error: 'Elanın növünü seçin' });
  if (!name || phone.replace(/\D/g, '').length < 7) return send(res, 400, { error: 'Ad və telefon nömrəsini düzgün yazın' });
  const base = {
    id: newId(), type, status: 'new', createdAt: new Date().toISOString(),
    name, phone,
    whatsapp: clip(b.whatsapp, 40),
    email: clip(b.email, 120),
    contactTime: clip(b.contactTime, 100),
    region: clip(b.region, 80),
    category: clip(b.category, 60),
    features: strList(b.features, 20, 40),
  };
  let item;
  if (type === 'sell') {
    const region = base.region;
    const area = num(b.area, 1e7), price = num(b.price);
    if (!region || !area || !price) return send(res, 400, { error: 'Bölgə, sahə və qiyməti yazın' });
    // Fotolar yalnız /api/submit-upload ilə yüklənmiş fayllar ola bilər
    const photos = strList(b.photos, 8, 300).filter((u) => /^(\/uploads\/sub-|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/uploads\/sub-)[\w.-]+$/.test(u));
    item = {
      ...base,
      title: clip(b.title, 120),
      settlement: clip(b.settlement, 80),
      area, price,
      document: clip(b.document, 60),
      location: clip(b.location, 1000),
      description: clip(b.description, 4000),
      photos,
    };
  } else {
    item = {
      ...base,
      areaMin: num(b.areaMin, 1e7), areaMax: num(b.areaMax, 1e7),
      budgetMin: num(b.budgetMin), budgetMax: num(b.budgetMax),
      note: clip(b.note, 3000),
    };
  }
  if (rateLimited(req, 'submit', 5)) return send(res, 429, { error: TOO_MANY });
  const list = await readCol('submissions');
  list.unshift(item);
  await writeCol('submissions', list);
  return send(res, 201, { ok: true, id: item.id });
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ':collection', ':id']
  const [, col, id] = parts;

  if (col === 'auth' && req.method === 'POST') {
    return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'Açar səhvdir' });
  }

  if (col === 'upload' && req.method === 'POST') {
    if (!isAdmin(req)) return send(res, 401, { error: 'İcazə yoxdur' });
    const { name = 'foto.jpg', data } = await readBody(req);
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(data || '');
    if (!m) return send(res, 400, { error: 'Yalnız PNG, JPG və ya WEBP şəkil' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const fileUrl = await saveUpload(file, Buffer.from(m[2], 'base64'), `image/${m[1]}`);
    return send(res, 201, { url: fileUrl, name });
  }

  // Saytdakı formalardan müraciət — hamıya açıqdır, yalnız icazəli sahələr yazılır
  if (col === 'inquiry' && req.method === 'POST') return publicLead(req, res);
  if (col === 'submit' && req.method === 'POST') return publicSubmission(req, res);

  // Saytdan elan göndərən satıcının fotoları: kiçik ölçü, limitli say
  if (col === 'submit-upload' && req.method === 'POST') {
    const { data } = await readBody(req, 6 * 1024 * 1024);
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(data || '');
    if (!m) return send(res, 400, { error: 'Yalnız PNG, JPG və ya WEBP şəkil' });
    if (rateLimited(req, 'upload', 16)) return send(res, 429, { error: TOO_MANY });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = `sub-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    return send(res, 201, { url: await saveUpload(file, Buffer.from(m[2], 'base64'), `image/${m[1]}`) });
  }

  if (!COLLECTIONS.includes(col)) return send(res, 404, { error: 'Tapılmadı' });

  const admin = isAdmin(req);

  // Elanları hamı oxuya bilər; qalan hər şey yalnız admin üçündür
  if (!(col === 'listings' && req.method === 'GET') && !admin) return send(res, 401, { error: 'İcazə yoxdur' });

  const list = await readCol(col);

  if (req.method === 'GET') {
    if (!id) return send(res, 200, list);
    const item = list.find((l) => l.id === id);
    return item ? send(res, 200, item) : send(res, 404, { error: 'Tapılmadı' });
  }

  if (req.method === 'POST' && !id) {
    const { id: _i, createdAt: _c, updatedAt: _u, ...body } = await readBody(req, col === 'listings' ? undefined : 1024 * 1024);
    const nextId = col === 'listings'
      ? String(Math.max(1000, ...list.map((l) => Number(l.id) || 0)) + 1)
      : newId();
    const item = { ...body, id: nextId, createdAt: new Date().toISOString() };
    list.unshift(item);
    await writeCol(col, list);
    return send(res, 201, item);
  }

  const idx = list.findIndex((l) => l.id === id);
  if (idx === -1) return send(res, 404, { error: 'Tapılmadı' });

  if (req.method === 'PUT') {
    const { id: _i, createdAt: _c, ...body } = await readBody(req, col === 'listings' ? undefined : 1024 * 1024);
    list[idx] = { ...list[idx], ...body, id, updatedAt: new Date().toISOString() };
    await writeCol(col, list);
    return send(res, 200, list[idx]);
  }

  if (req.method === 'DELETE') {
    const [removed] = list.splice(idx, 1);
    await writeCol(col, list);
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

module.exports = { handleApi, send, ADMIN_KEY, readCol, writeCol };
