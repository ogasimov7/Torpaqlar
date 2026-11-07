// Admin paneli üçün ortaq hissələr: sabitlər, formatlar, modal forma, CRM formaları
import { crmList, crmSave, crmDelete, adminKey } from '../../api.js';
import { STATUS } from '../../config.js';
import { $, esc, fmtPrice, toast } from '../../util.js';

export const rerender = () => dispatchEvent(new HashChangeEvent('hashchange'));

// ---------- Sabitlər ----------
export const LEAD_STATUS = {
  new: { label: 'Yeni', color: '#3b82f6' },
  contacted: { label: 'Əlaqə saxlanıldı', color: '#8b5cf6' },
  viewing: { label: 'Baxış təyin edildi', color: '#f59e0b' },
  negotiation: { label: 'Danışıqlar', color: '#0ea5a4' },
  won: { label: 'Uğurlu', color: '#22a35a' },
  lost: { label: 'İmtina', color: '#ef5350' },
};
export const LEAD_SOURCE = {
  site: 'Sayt — elan', contact: 'Sayt — əlaqə', phone: 'Zəng', whatsapp: 'WhatsApp',
  instagram: 'Instagram', referral: 'Tövsiyə', office: 'Ofis', other: 'Digər',
};
export const CLIENT_TYPE = { buyer: 'Alıcı', seller: 'Satıcı', both: 'Alıcı və satıcı', investor: 'İnvestor' };
export const CLIENT_STATUS = {
  hot: { label: 'İsti', color: '#ef5350' },
  active: { label: 'Aktiv', color: '#22a35a' },
  potential: { label: 'Potensial', color: '#f59e0b' },
  closed: { label: 'Bağlanıb', color: '#8a938b' },
};
export const TASK_TYPE = { call: 'Zəng', meeting: 'Görüş', viewing: 'Sahəyə baxış', docs: 'Sənəd işi', other: 'Digər' };
export const NOTE_COLORS = { plain: '#ffffff', sand: '#fff4d1', green: '#e2f3e7', blue: '#e4edfb', rose: '#fbe6e4' };

// ---------- İkonlar ----------
const ICONS = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  plots: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  tasks: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  globe: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 0v20M3 7l9 5 9-5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  wa: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  pin: '<path d="M9 4h6l-1 6 4 3v2H6v-2l4-3z"/><path d="M12 15v6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  post: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>',
};
export const ic = (name, size = 18) =>
  `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// ---------- Formatlar ----------
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
};
const MONTHS_LONG = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const WEEKDAYS = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'];
export const fmtLongDate = (d = new Date()) => `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
export const fmtTime = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '');
export function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'indicə';
  if (s < 3600) return `${Math.floor(s / 60)} dəq əvvəl`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat əvvəl`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} gün əvvəl`;
  return fmtDate(iso);
}
// <input type="datetime-local"> üçün yerli vaxt
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
export const isToday = (iso) => iso && dayKey(iso) === dayKey(Date.now());
export const isOverdue = (t) => !t.done && t.due && new Date(t.due) < new Date() && !isToday(t.due);

export const telHref = (p = '') => `tel:${p.replace(/[^\d+]/g, '')}`;
export function waHref(p = '', text = '') {
  let d = p.replace(/\D/g, '');
  if (d.startsWith('0')) d = `994${d.slice(1)}`;
  else if (d.length === 9) d = `994${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export const normPhone = (p = '') => p.replace(/\D/g, '').slice(-9);

export const pill = (label, color) => `<span class="pill" style="--c:${color}"><i></i>${esc(label)}</span>`;
export const leadPill = (s) => pill(LEAD_STATUS[s]?.label || s, LEAD_STATUS[s]?.color || '#888');
export const listingPill = (s) => pill(STATUS[s]?.label || s, STATUS[s]?.color || '#888');

// Statusu sətirdən dəyişmək üçün rəngli select
export const statusSelect = (map, value, attrs = '') =>
  `<select class="status-select" ${attrs} style="--c:${map[value]?.color || '#888'}">${Object.entries(map)
    .map(([k, v]) => `<option value="${k}" data-color="${v.color}" ${k === value ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`;

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
export const avatar = (name, cls = '') => `<span class="av ${cls}" style="--h:${[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}">${esc(initials(name))}</span>`;

export const empty = (text, action = '') => `<div class="adm-empty"><p>${text}</p>${action}</div>`;

// İki addımlı silmə düyməsi: 1-ci klik "Əminsiniz?", 2-ci klik silir
export function confirmClick(btn) {
  if (btn.classList.contains('confirm')) return true;
  btn.classList.add('confirm');
  const prev = btn.innerHTML;
  btn.textContent = 'Əminsiniz?';
  setTimeout(() => { btn.classList.remove('confirm'); btn.innerHTML = prev; }, 3000);
  return false;
}

export function handleAuthError(err) {
  toast(err.message, 'err');
  if (/İcazə/.test(err.message)) { adminKey.clear(); rerender(); }
}

// ---------- Modal forma ----------
// fields: [{ name, label, type, options: [[value, label]], required, full, placeholder, rows }]
export function openForm({ title, subtitle = '', fields, data = {}, submitLabel = 'Yadda saxla', onSubmit, onDelete }) {
  const val = (f) => data[f.name] ?? f.default ?? '';
  const field = (f) => {
    const req = f.required ? 'required' : '';
    const lbl = `${esc(f.label)}${f.required ? ' *' : ''}`;
    const cls = f.full ? 'full' : '';
    switch (f.type) {
      case 'select':
        return `<label class="${cls}">${lbl}<select name="${f.name}" ${req}>${f.options
          .map(([v, l, c]) => `<option value="${esc(v)}" ${c ? `data-color="${c}"` : ''} ${String(v) === String(val(f)) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
      case 'textarea':
        return `<label class="${cls || 'full'}">${lbl}<textarea name="${f.name}" rows="${f.rows || 4}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(val(f))}</textarea></label>`;
      case 'checkbox':
        return `<label class="check ${cls}"><input type="checkbox" name="${f.name}" ${val(f) ? 'checked' : ''} /> ${esc(f.label)}</label>`;
      case 'colors':
        return `<div class="${cls} color-pick"><span>${lbl}</span><div>${Object.entries(NOTE_COLORS)
          .map(([k, c]) => `<label><input type="radio" name="${f.name}" value="${k}" ${k === (val(f) || 'plain') ? 'checked' : ''} /><i style="background:${c}"></i></label>`).join('')}</div></div>`;
      case 'datetime':
        return `<label class="${cls}">${lbl}<input type="datetime-local" name="${f.name}" ${req} value="${toLocalInput(val(f))}" /></label>`;
      default:
        return `<label class="${cls}">${lbl}<input type="${f.type || 'text'}" name="${f.name}" ${req} value="${esc(val(f))}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'number' ? 'step="any" min="0"' : ''} ${f.list ? `list="dl-${f.name}"` : ''} />${f.list ? `<datalist id="dl-${f.name}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}</label>`;
    }
  };

  const wrap = document.createElement('div');
  wrap.className = 'adm-modal admin';
  wrap.innerHTML = `
    <div class="adm-modal-bg" data-close></div>
    <form class="adm-modal-card" novalidate>
      <header><div><h2>${esc(title)}</h2>${subtitle ? `<p class="muted small">${subtitle}</p>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="Bağla">✕</button></header>
      <div class="adm-form-grid">${fields.map(field).join('')}</div>
      <footer>
        ${onDelete ? `<button type="button" class="btn btn-sm btn-danger" data-del>${ic('trash', 15)} Sil</button>` : ''}
        <span class="grow"></span>
        <button type="button" class="btn btn-sm btn-ghost" data-close>Ləğv et</button>
        <button class="btn btn-sm btn-dark" type="submit">${esc(submitLabel)}</button>
      </footer>
    </form>`;
  document.body.appendChild(wrap);
  document.body.classList.add('modal-open');
  const form = $('form', wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  setTimeout(() => form.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea')?.focus(), 60);

  const close = () => {
    wrap.classList.remove('in');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    setTimeout(() => wrap.remove(), 200);
  };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.csel-pop')) close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  window.addEventListener('hashchange', close);

  $('[data-del]', wrap)?.addEventListener('click', async (e) => {
    if (!confirmClick(e.currentTarget)) return;
    try { await onDelete(); close(); } catch (err) { handleAuthError(err); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      const bad = form.querySelector(':invalid');
      bad?.focus();
      return toast(`Doldurun: ${bad?.closest('label')?.firstChild.textContent.replace('*', '').trim() || 'məcburi xanalar'}`, 'err');
    }
    const out = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      if (f.type === 'checkbox') out[f.name] = el.checked;
      else if (f.type === 'number') out[f.name] = el.value === '' ? '' : +el.value;
      else if (f.type === 'datetime') out[f.name] = el.value ? new Date(el.value).toISOString() : '';
      else if (f.type === 'colors') out[f.name] = form.querySelector(`[name=${f.name}]:checked`)?.value || 'plain';
      else out[f.name] = el.value.trim();
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try { await onSubmit(out); close(); }
    catch (err) { handleAuthError(err); }
    finally { btn.disabled = false; }
  });
  return { close };
}

// ---------- CRM formaları (bütün səhifələrdə eyni) ----------
const listingOpts = (listings) => [['', '— seçilməyib —'], ...listings.map((l) => [l.id, `${l.id} · ${l.title} (${l.region})`])];
const clientOpts = (clients) => [['', '— seçilməyib —'], ...clients.map((c) => [c.id, `${c.name}${c.phone ? ` · ${c.phone}` : ''}`])];

export function leadForm(lead, { listings = [], clients = [] } = {}, onSaved) {
  const isNew = !lead?.id;
  return openForm({
    title: isNew ? 'Yeni müraciət' : 'Müraciət',
    subtitle: isNew ? 'Zəng, WhatsApp və ya ofisə gələn müraciəti qeyd edin' : `${LEAD_SOURCE[lead.source] || ''} · ${fmtDateTime(lead.createdAt)}`,
    data: { status: 'new', source: 'phone', goal: 'almaq', ...lead },
    fields: [
      { name: 'name', label: 'Ad, soyad', required: true },
      { name: 'phone', label: 'Telefon', type: 'tel', required: true, placeholder: '+994 __ ___ __ __' },
      { name: 'email', label: 'E-poçt', type: 'email' },
      { name: 'goal', label: 'Məqsəd', type: 'select', options: [['almaq', 'Torpaq almaq'], ['satmaq', 'Torpaq satmaq']] },
      { name: 'listingId', label: 'Elan', type: 'select', options: listingOpts(listings), full: true },
      { name: 'status', label: 'Status', type: 'select', options: Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.label, v.color]) },
      { name: 'source', label: 'Mənbə', type: 'select', options: Object.entries(LEAD_SOURCE) },
      { name: 'budget', label: 'Büdcə (₼)', type: 'number' },
      { name: 'clientId', label: 'Müştəri', type: 'select', options: clientOpts(clients) },
      { name: 'message', label: 'Müraciətin mətni', type: 'textarea', rows: 3 },
      { name: 'note', label: 'Daxili qeyd (yalnız siz görürsünüz)', type: 'textarea', rows: 3 },
    ],
    onSubmit: async (d) => { const s = await crmSave('leads', { ...lead, ...d }); toast(isNew ? 'Müraciət əlavə olundu' : 'Yadda saxlanıldı'); onSaved?.(s); },
    onDelete: isNew ? null : async () => { await crmDelete('leads', lead.id); toast('Müraciət silindi'); onSaved?.(null); },
  });
}

export function clientForm(client, { listings = [] } = {}, onSaved) {
  const isNew = !client?.id;
  return openForm({
    title: isNew ? 'Yeni müştəri' : 'Müştərini redaktə et',
    data: { type: 'buyer', status: 'active', source: 'phone', ...client },
    fields: [
      { name: 'name', label: 'Ad, soyad', required: true },
      { name: 'phone', label: 'Telefon', type: 'tel', required: true, placeholder: '+994 __ ___ __ __' },
      { name: 'phone2', label: 'Əlavə telefon', type: 'tel' },
      { name: 'email', label: 'E-poçt', type: 'email' },
      { name: 'type', label: 'Növ', type: 'select', options: Object.entries(CLIENT_TYPE) },
      { name: 'status', label: 'Status', type: 'select', options: Object.entries(CLIENT_STATUS).map(([k, v]) => [k, v.label, v.color]) },
      { name: 'budgetMin', label: 'Büdcə — min (₼)', type: 'number' },
      { name: 'budgetMax', label: 'Büdcə — max (₼)', type: 'number' },
      { name: 'regions', label: 'Maraqlandığı bölgələr', placeholder: 'Məs: Abşeron, Qəbələ', list: [...new Set(listings.map((l) => l.region))] },
      { name: 'areaWanted', label: 'İstədiyi sahə', placeholder: 'Məs: 6–10 sot' },
      { name: 'source', label: 'Mənbə', type: 'select', options: Object.entries(LEAD_SOURCE) },
      { name: 'birthday', label: 'Doğum günü', type: 'date' },
      { name: 'note', label: 'Qeyd', type: 'textarea', rows: 4, placeholder: 'Ailə vəziyyəti, üstünlüklər, nə vaxt zəng etmək olar…' },
    ],
    onSubmit: async (d) => { const s = await crmSave('clients', { ...client, ...d }); toast(isNew ? 'Müştəri əlavə olundu' : 'Yadda saxlanıldı'); onSaved?.(s); },
    onDelete: isNew ? null : async () => { await crmDelete('clients', client.id); toast('Müştəri silindi'); onSaved?.(null); },
  });
}

export function taskForm(task, { listings = [], clients = [] } = {}, onSaved) {
  const isNew = !task?.id;
  const d0 = new Date(); d0.setHours(d0.getHours() + 1, 0, 0, 0);
  return openForm({
    title: isNew ? 'Yeni tapşırıq' : 'Tapşırıq',
    data: { type: 'call', due: d0.toISOString(), ...task },
    fields: [
      { name: 'title', label: 'Nə etmək lazımdır', required: true, full: true, placeholder: 'Məs: Bilgəhdəki sahəni göstərmək' },
      { name: 'type', label: 'Növ', type: 'select', options: Object.entries(TASK_TYPE) },
      { name: 'due', label: 'Vaxt', type: 'datetime' },
      { name: 'clientId', label: 'Müştəri', type: 'select', options: clientOpts(clients) },
      { name: 'listingId', label: 'Elan', type: 'select', options: listingOpts(listings) },
      { name: 'note', label: 'Qeyd', type: 'textarea', rows: 3 },
      ...(isNew ? [] : [{ name: 'done', label: 'Tamamlanıb', type: 'checkbox' }]),
    ],
    onSubmit: async (d) => { const s = await crmSave('tasks', { done: false, ...task, ...d }); toast(isNew ? 'Tapşırıq əlavə olundu' : 'Yadda saxlanıldı'); onSaved?.(s); },
    onDelete: isNew ? null : async () => { await crmDelete('tasks', task.id); toast('Tapşırıq silindi'); onSaved?.(null); },
  });
}

export function noteForm(note, { listings = [], clients = [] } = {}, onSaved) {
  const isNew = !note?.id;
  return openForm({
    title: isNew ? 'Yeni qeyd' : 'Qeyd',
    data: { color: 'plain', ...note },
    fields: [
      { name: 'title', label: 'Başlıq', full: true, placeholder: 'ixtiyari' },
      { name: 'text', label: 'Mətn', type: 'textarea', rows: 7, required: true },
      { name: 'clientId', label: 'Müştəri', type: 'select', options: clientOpts(clients) },
      { name: 'listingId', label: 'Elan', type: 'select', options: listingOpts(listings) },
      { name: 'color', label: 'Rəng', type: 'colors' },
      { name: 'pinned', label: 'Yuxarıda sabitlə', type: 'checkbox' },
    ],
    onSubmit: async (d) => { const s = await crmSave('notes', { ...note, ...d }); toast(isNew ? 'Qeyd əlavə olundu' : 'Yadda saxlanıldı'); onSaved?.(s); },
    onDelete: isNew ? null : async () => { await crmDelete('notes', note.id); toast('Qeyd silindi'); onSaved?.(null); },
  });
}

// Müraciəti müştəriyə çevirmək: eyni telefonlu müştəri varsa ona bağlanır
export async function leadToClient(lead, clients) {
  let client = clients.find((c) => lead.phone && normPhone(c.phone) === normPhone(lead.phone));
  if (!client) {
    client = await crmSave('clients', {
      name: lead.name, phone: lead.phone, email: lead.email || '',
      type: lead.goal === 'satmaq' ? 'seller' : 'buyer', status: 'active',
      source: lead.source || 'other', budgetMax: lead.budget || '',
      listingIds: lead.listingId ? [lead.listingId] : [],
      note: lead.message || '',
    });
  } else if (lead.listingId && !(client.listingIds || []).includes(lead.listingId)) {
    client = await crmSave('clients', { id: client.id, listingIds: [...(client.listingIds || []), lead.listingId] });
  }
  await crmSave('leads', { id: lead.id, clientId: client.id, status: lead.status === 'new' ? 'contacted' : lead.status });
  return client;
}

export const budgetText = (c) => {
  const a = +c.budgetMin, b = +c.budgetMax;
  if (a && b) return `${fmtPrice(a)} – ${fmtPrice(b)}`;
  if (b) return `${fmtPrice(b)}-a qədər`;
  if (a) return `${fmtPrice(a)}-dan`;
  return '';
};

// Sidebar-da yeni müraciətlərin və bu günkü/gecikmiş tapşırıqların sayı
export async function updateCounts(root = document) {
  try {
    const [leads, tasks, subs] = await Promise.all([crmList('leads'), crmList('tasks'), crmList('submissions')]);
    const set = (k, n, warn) => {
      const el = $(`[data-count="${k}"]`, root);
      if (el) { el.textContent = n || ''; el.classList.toggle('warn', !!warn); }
    };
    set('muracietler', leads.filter((l) => l.status === 'new').length);
    set('sorgular', subs.filter((s) => s.status === 'new').length);
    const due = tasks.filter((t) => !t.done && (isOverdue(t) || isToday(t.due)));
    set('tapsiriqlar', due.length, due.some(isOverdue));
  } catch { /* sayğac vacib deyil */ }
}
