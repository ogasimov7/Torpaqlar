let cache = null;

export const adminKey = {
  get: () => sessionStorage.getItem('adminKey') || '',
  set: (k) => sessionStorage.setItem('adminKey', k),
  clear: () => sessionStorage.removeItem('adminKey'),
};

async function request(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey.get(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Xəta ${res.status}`);
  return data;
}

export async function getListings(force = false) {
  if (!cache || force) cache = await request('/api/listings');
  return cache;
}

export async function getListing(id) {
  const list = await getListings();
  return list.find((l) => l.id === id) || null;
}

export const checkKey = (key) => request('/api/auth', { method: 'POST', headers: { 'x-admin-key': key } });

export async function saveListing(item) {
  const saved = item.id
    ? await request(`/api/listings/${item.id}`, { method: 'PUT', body: JSON.stringify(item) })
    : await request('/api/listings', { method: 'POST', body: JSON.stringify(item) });
  cache = null;
  return saved;
}

export async function deleteListing(id) {
  await request(`/api/listings/${id}`, { method: 'DELETE' });
  cache = null;
}

// Böyük fotolar göndərilməzdən əvvəl kiçildilir (Vercel-də sorğu limiti ~4.5 MB-dır)
async function shrink(file, max = 2200) {
  if (file.size < 1.2e6 || !/^image\/(jpe?g|png|webp)$/.test(file.type)) return file;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

export async function uploadImage(file) {
  const blob = await shrink(file);
  const data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return request('/api/upload', { method: 'POST', body: JSON.stringify({ name: file.name, data }) });
}
