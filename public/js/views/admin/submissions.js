// Saytdan göndərilən elanlar: #/admin/sorgular (siyahı), #/admin/sorgular/:id (ətraflı)
//  - "Torpaq satıram": admin yoxlayır, redaktə edib elan kimi dərc edir (#/admin/elanlar/sorgu-:id)
//  - "Torpaq axtarıram": admin uyğun elanları görür, müştəri ilə əlaqə saxlayır
import { getListings, crmList, crmSave, crmDelete } from '../../api.js';
import { $, esc, fmtPrice, fmtArea, toast, satFigure } from '../../util.js';
import {
  ic, ago, fmtDateTime, telHref, waHref, statusSelect, avatar, empty, pill, listingPill, normPhone,
  confirmClick, handleAuthError, updateCounts, taskForm,
} from './common.js';

export const SUB_STATUS = {
  sell: {
    new: { label: 'Yeni', color: '#3b82f6' },
    reviewing: { label: 'Yoxlanılır', color: '#f59e0b' },
    published: { label: 'Dərc olunub', color: '#22a35a' },
    rejected: { label: 'Rədd edildi', color: '#ef5350' },
  },
  seek: {
    new: { label: 'Yeni', color: '#3b82f6' },
    contacted: { label: 'Əlaqə saxlanıldı', color: '#8b5cf6' },
    offered: { label: 'Variant təklif edildi', color: '#0ea5a4' },
    closed: { label: 'Bağlandı', color: '#8a938b' },
  },
};
const TYPE = { sell: 'Torpaq satır', seek: 'Torpaq axtarır' };
const OPEN = { sell: ['new', 'reviewing'], seek: ['new', 'contacted', 'offered'] };

const range = (a, b, fmt) => (a && b ? `${fmt(a)} – ${fmt(b)}` : b ? `${fmt(b)}-a qədər` : a ? `${fmt(a)}-dan` : '');
const sotTxt = (n) => `${n} sot`;

function summary(s) {
  if (s.type === 'sell') return s.title || `${s.area} sot torpaq, ${s.settlement || s.region}`;
  return [s.region, s.category, range(s.areaMin, s.areaMax, sotTxt)].filter(Boolean).join(' · ') || 'Torpaq axtarır';
}

// Axtarış sorğusuna uyğun elanlar (satılmamış)
export function matches(s, listings) {
  const regs = (s.region || '').toLowerCase().split(/[,;/]| və /).map((x) => x.trim()).filter(Boolean);
  return listings
    .filter((l) => l.status !== 'sold')
    .filter((l) => !regs.length || regs.some((r) => `${l.region} ${l.settlement}`.toLowerCase().includes(r) || r.includes(l.region.toLowerCase())))
    .filter((l) => !s.category || l.category === s.category)
    .filter((l) => !s.budgetMax || l.price <= s.budgetMax * 1.1)
    .filter((l) => !s.budgetMin || l.price >= s.budgetMin * 0.7)
    .filter((l) => !s.areaMin || l.area >= s.areaMin * 0.9)
    .filter((l) => !s.areaMax || l.area <= s.areaMax * 1.1)
    .map((l) => ({ l, score: (s.features || []).filter((f) => l.features?.includes(f)).length }))
    .sort((a, b) => b.score - a.score || a.l.price - b.l.price)
    .map((x) => x.l);
}

export default async function submissionsPage(root, sub) {
  if (sub) return detail(root, sub);
  return table(root);
}

async function load() {
  const [listings, subs, clients] = await Promise.all([getListings(true), crmList('submissions', true), crmList('clients', true)]);
  return { listings, subs, clients };
}

// ---------------- Siyahı ----------------
async function table(root) {
  let d = await load();
  let type = sessionStorage.getItem('subType') || 'sell';
  let view = 'open';

  root.innerHTML = `<section class="adm-page">
    <div class="admin-head">
      <div><h1>Saytdan elanlar</h1>
        <p class="muted">Saytdakı “Elan yerləşdir” formasından gələnlər: satış elanlarını yoxlayıb dərc edin, torpaq axtaranlarla əlaqə saxlayın.</p></div>
      <div class="admin-actions"><input class="admin-search" type="search" placeholder="Ad, telefon, bölgə…" id="q" /></div>
    </div>
    <div class="type-switch" id="types"></div>
    <div class="seg-tabs" id="tabs"></div>
    <div class="sub-list" id="rows"></div>
  </section>`;

  function draw() {
    const q = $('#q').value.toLowerCase().trim();
    const L = Object.fromEntries(d.listings.map((l) => [l.id, l]));
    const ofType = (t) => d.subs.filter((s) => s.type === t);
    const newCount = (t) => ofType(t).filter((s) => s.status === 'new').length;
    $('#types').innerHTML = Object.entries({ sell: 'Torpaq satıram', seek: 'Torpaq axtarıram' }).map(([k, label]) => `
      <button class="${k === type ? 'on' : ''}" data-type="${k}">${ic(k === 'sell' ? 'plots' : 'search', 18)}<span>${label}</span><small>${ofType(k).length} sorğu</small>${newCount(k) ? `<b>${newCount(k)} yeni</b>` : ''}</button>`).join('');
    const ST = SUB_STATUS[type];
    const pool = ofType(type);
    const tabs = [['open', type === 'sell' ? 'Təsdiq gözləyir' : 'Aktiv', pool.filter((s) => OPEN[type].includes(s.status)).length], ['all', 'Hamısı', pool.length],
      ...Object.entries(ST).map(([k, v]) => [k, v.label, pool.filter((s) => s.status === k).length, v.color])];
    $('#tabs').innerHTML = tabs.map(([k, label, n, c]) => `<button class="${k === view ? 'on' : ''}" data-v="${k}">${c ? `<i style="background:${c}"></i>` : ''}${label}<b>${n}</b></button>`).join('');

    const rows = pool
      .filter((s) => view === 'all' || (view === 'open' ? OPEN[type].includes(s.status) : s.status === view))
      .filter((s) => !q || `${s.name} ${s.phone} ${s.email} ${s.region} ${s.settlement || ''} ${s.title || ''} ${s.note || ''} ${s.description || ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    $('#rows').innerHTML = rows.length ? rows.map((s) => {
      const st = ST[s.status] || { label: s.status, color: '#888' };
      const m = s.type === 'seek' ? matches(s, d.listings).length : 0;
      return `<a class="sub-card ${s.status === 'new' ? 'is-new' : ''}" href="#/admin/sorgular/${s.id}">
        <div class="sub-media">${s.type === 'sell'
          ? (s.photos?.[0] ? `<img src="${esc(s.photos[0])}" alt="" loading="lazy" />` : `<span class="sub-ph">${ic('plots', 28)}</span>`)
          : `<span class="sub-ph seek">${ic('search', 28)}</span>`}</div>
        <div class="sub-main">
          <div class="sub-top">${pill(st.label, st.color)}<span class="muted small">${ago(s.createdAt)}</span></div>
          <strong>${esc(summary(s))}</strong>
          <div class="sub-facts">${s.type === 'sell'
            ? `<span>${esc(s.region)}${s.settlement ? `, ${esc(s.settlement)}` : ''}</span><span>${fmtArea(+s.area)}</span><b>${fmtPrice(+s.price)}</b>${s.photos?.length ? `<span>${s.photos.length} foto</span>` : ''}`
            : `${range(s.budgetMin, s.budgetMax, fmtPrice) ? `<b>${range(s.budgetMin, s.budgetMax, fmtPrice)}</b>` : ''}<span class="${m ? 'ok' : ''}">${m ? `${m} uyğun elan` : 'Uyğun elan yoxdur'}</span>`}
            ${s.listingId && L[s.listingId] ? `<span class="ok">Elan · kod ${s.listingId}</span>` : ''}</div>
        </div>
        <div class="sub-contact">${avatar(s.name)}<div><strong>${esc(s.name)}</strong><span class="muted small">${esc(s.phone)}</span></div></div>
        <span class="sub-go">${ic('arrow', 18)}</span>
      </a>`;
    }).join('') : empty(pool.length ? 'Bu filtrə uyğun sorğu yoxdur.' : type === 'sell' ? 'Hələ satış elanı göndərilməyib.' : 'Hələ axtarış sorğusu yoxdur.');
  }

  draw();
  $('#q').addEventListener('input', draw);
  $('#types').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (b) { type = b.dataset.type; view = 'open'; sessionStorage.setItem('subType', type); draw(); }
  });
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; draw(); } });
}

// ---------------- Ətraflı ----------------
async function detail(root, id) {
  let d = await load();
  let s = d.subs.find((x) => x.id === id);
  if (!s) {
    root.innerHTML = `<section class="adm-page">${empty('Sorğu tapılmadı (silinib ola bilər).', '<a class="btn btn-dark" href="#/admin/sorgular">Bütün sorğular</a>')}</section>`;
    return;
  }
  // Açılan kimi "Yeni" → "Yoxlanılır" (yalnız satış elanı)
  if (s.type === 'sell' && s.status === 'new') {
    try { s = await crmSave('submissions', { id: s.id, status: 'reviewing' }); updateCounts(); } catch { /* vacib deyil */ }
  }

  const reload = async () => {
    d = await load();
    s = d.subs.find((x) => x.id === id);
    if (!s) { location.hash = '#/admin/sorgular'; return; }
    draw();
    updateCounts();
  };

  function draw() {
    const L = Object.fromEntries(d.listings.map((l) => [l.id, l]));
    const client = d.clients.find((c) => c.id === s.clientId) || d.clients.find((c) => s.phone && normPhone(c.phone) === normPhone(s.phone));
    const listing = L[s.listingId];
    const wa = s.whatsapp || s.phone;
    const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '');
    const ms = s.type === 'seek' ? matches(s, d.listings) : [];
    const siteUrl = (l) => `${location.origin}/#/elan/${l.id}`;

    root.innerHTML = `<section class="adm-page">
      <nav class="crumbs"><a href="#/admin/sorgular">Saytdan elanlar</a><span>/</span><span>${TYPE[s.type]}</span></nav>
      <div class="client-head">
        <span class="sub-ph big ${s.type === 'seek' ? 'seek' : ''}">${ic(s.type === 'sell' ? 'plots' : 'search', 28)}</span>
        <div class="grow">
          <h1>${esc(summary(s))}</h1>
          <div class="client-tags"><span class="chip-s">${TYPE[s.type]}</span>${statusSelect(SUB_STATUS[s.type], s.status, 'id="subStatus"')}<span class="muted small">Göndərilib: ${fmtDateTime(s.createdAt)}</span></div>
        </div>
        <div class="admin-actions">
          ${s.type === 'sell'
            ? listing
              ? `<a class="btn btn-sm btn-dark" href="#/admin/elanlar/${listing.id}">${ic('edit', 15)} Elanı redaktə et</a><a class="btn btn-sm btn-ghost" href="#/elan/${listing.id}" target="_blank">${ic('ext', 15)} Saytda bax</a>`
              : `<a class="btn btn-sm btn-accent" href="#/admin/elanlar/sorgu-${s.id}">${ic('edit', 15)} Redaktə et və dərc et</a>
                 ${s.status !== 'rejected' ? `<button class="btn btn-sm btn-ghost" id="reject">Rədd et</button>` : ''}`
            : ''}
        </div>
      </div>

      <div class="sub-grid">
        <div class="col">
          ${s.type === 'sell' ? `
          <div class="panel">
            <h3>Torpaq haqqında</h3>
            ${s.photos?.length ? `<div class="sub-photos">${s.photos.map((p) => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="" loading="lazy" /></a>`).join('')}</div>` : '<p class="muted small">Foto əlavə olunmayıb.</p>'}
            <dl class="kv">
              ${row('Bölgə', esc(s.region))}
              ${row('Kənd / qəsəbə', esc(s.settlement || ''))}
              ${row('Sahə', `${fmtArea(+s.area)}${s.area >= 100 ? ` (${s.area} sot)` : ''}`)}
              ${row('Qiymət', `${fmtPrice(+s.price)} <span class="muted small">· 1 sot ${fmtPrice(s.price / s.area)}</span>`)}
              ${row('Təyinat', esc(s.category || ''))}
              ${row('Sənəd', esc(s.document || ''))}
              ${row('Üstünlüklər', (s.features || []).map(esc).join(', '))}
              ${row('Yeri', s.location ? linkify(s.location) : '<span class="muted">Qeyd olunmayıb</span>')}
            </dl>
            ${s.description ? `<div class="note-box">${esc(s.description).replace(/\n/g, '<br/>')}</div>` : ''}
          </div>` : `
          <div class="panel">
            <h3>Axtardığı torpaq</h3>
            <dl class="kv">
              ${row('Bölgə', esc(s.region || ''))}
              ${row('Təyinat', esc(s.category || 'Fərq etmir'))}
              ${row('Sahə', range(s.areaMin, s.areaMax, sotTxt))}
              ${row('Büdcə', range(s.budgetMin, s.budgetMax, fmtPrice))}
              ${row('Vacib olanlar', (s.features || []).map(esc).join(', '))}
            </dl>
            ${s.note ? `<div class="note-box">${esc(s.note).replace(/\n/g, '<br/>')}</div>` : ''}
          </div>
          <div class="panel">
            <div class="panel-h"><h3>Uyğun elanlar <small class="muted">${ms.length}</small></h3></div>
            <p class="muted small">Bölgə, təyinat, büdcə (±10%) və sahəyə görə seçilib. Elanı müştəriyə bir kliklə WhatsApp-da göndərə bilərsiniz.</p>
            <div class="liked">${ms.slice(0, 12).map((l) => `
              <div class="liked-it">
                <a href="#/elan/${l.id}" target="_blank" class="liked-img">${satFigure(l, { w: 120, h: 80, pad: 2 })}</a>
                <div class="grow"><a href="#/elan/${l.id}" target="_blank"><strong>${esc(l.title)}</strong></a>
                  <div class="muted small">${esc(l.region)} · ${fmtArea(l.area)} · ${fmtPrice(l.price)}</div>${listingPill(l.status)}</div>
                <a class="btn btn-xs btn-wa" href="${waHref(wa, `Salam, ${s.name}! Axtardığınız torpağa uyğun bir variant: “${l.title}”, ${fmtArea(l.area)}, ${fmtPrice(l.price)}.\n${siteUrl(l)}`)}" target="_blank" rel="noopener" data-offer>${ic('wa', 14)} Göndər</a>
              </div>`).join('') || '<p class="muted small">Hazırda bazada uyğun elan yoxdur. Yeni elan əlavə olunanda yenidən baxın.</p>'}</div>
          </div>`}
        </div>

        <div class="col">
          <div class="panel">
            <h3>Əlaqə məlumatları</h3>
            <div class="who">${avatar(s.name, 'av-lg')}<div><strong class="big">${esc(s.name)}</strong>${client ? `<a class="link-arrow small" href="#/admin/musteriler/${client.id}">Müştəri kartı →</a>` : ''}</div></div>
            <dl class="kv">
              ${row('Telefon', `<a href="${telHref(s.phone)}">${esc(s.phone)}</a>`)}
              ${row('WhatsApp', s.whatsapp ? `<a href="${waHref(s.whatsapp)}" target="_blank" rel="noopener">${esc(s.whatsapp)}</a>` : '')}
              ${row('E-poçt', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '')}
              ${row('Zəng vaxtı', esc(s.contactTime || ''))}
            </dl>
            <div class="contact-btns">
              <a class="btn btn-sm btn-accent" href="${telHref(s.phone)}">${ic('phone', 15)} Zəng et</a>
              <a class="btn btn-sm btn-wa" href="${waHref(wa, s.type === 'sell' ? `Salam, ${s.name}! Saytda göndərdiyiniz torpaq elanı ilə bağlı yazıram.` : `Salam, ${s.name}! Torpaq axtarışınızla bağlı yazıram.`)}" target="_blank" rel="noopener">${ic('wa', 15)} WhatsApp</a>
            </div>
            <div class="contact-btns">
              ${client ? '' : `<button class="btn btn-sm btn-dark" id="toClient">${ic('plus', 15)} Müştərilərə əlavə et</button>`}
              <button class="btn btn-sm btn-ghost" id="addTask">${ic('tasks', 15)} Tapşırıq</button>
            </div>
          </div>
          <div class="panel">
            <h3>Daxili qeyd</h3>
            <textarea id="adminNote" rows="4" placeholder="Zəngin nəticəsi, razılaşma, nəyi yoxlamaq lazımdır…">${esc(s.adminNote || '')}</textarea>
            <div><button class="btn btn-sm btn-dark" id="saveNote">Yadda saxla</button></div>
          </div>
          <button class="btn btn-sm btn-danger" id="del">${ic('trash', 15)} Sorğunu sil</button>
        </div>
      </div>
    </section>`;
    bind(client);
  }

  function bind(client) {
    const save = async (patch, msg) => {
      try { await crmSave('submissions', { id: s.id, ...patch }); if (msg) toast(msg); await reload(); }
      catch (err) { handleAuthError(err); }
    };
    $('#subStatus').addEventListener('change', (e) => save({ status: e.target.value }, `Status: «${SUB_STATUS[s.type][e.target.value].label}»`));
    $('#reject')?.addEventListener('click', (e) => { if (confirmClick(e.currentTarget)) save({ status: 'rejected' }, 'Elan rədd edildi'); });
    $('#saveNote').addEventListener('click', () => save({ adminNote: $('#adminNote').value.trim() }, 'Qeyd yadda saxlanıldı'));
    root.querySelectorAll('[data-offer]').forEach((a) => a.addEventListener('click', () => {
      if (s.status === 'new' || s.status === 'contacted') crmSave('submissions', { id: s.id, status: 'offered' }).then(reload).catch(() => {});
    }));
    $('#toClient')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        const c = await crmSave('clients', {
          name: s.name, phone: s.phone, phone2: s.whatsapp && s.whatsapp !== s.phone ? s.whatsapp : '', email: s.email || '',
          type: s.type === 'sell' ? 'seller' : 'buyer', status: 'active', source: 'site',
          budgetMin: s.budgetMin || '', budgetMax: s.budgetMax || '', regions: s.region || '',
          areaWanted: s.type === 'seek' ? range(s.areaMin, s.areaMax, sotTxt) : '',
          listingIds: s.listingId ? [s.listingId] : [],
          note: [s.type === 'sell' ? `Saytdan satış elanı: ${summary(s)}, ${fmtPrice(+s.price)}` : s.note, s.contactTime && `Zəng vaxtı: ${s.contactTime}`].filter(Boolean).join('\n'),
        });
        await crmSave('submissions', { id: s.id, clientId: c.id, ...(s.type === 'seek' && s.status === 'new' ? { status: 'contacted' } : {}) });
        toast(`${c.name} müştərilərə əlavə olundu`);
        await reload();
      } catch (err) { handleAuthError(err); e.currentTarget.disabled = false; }
    });
    $('#addTask').addEventListener('click', () => taskForm({
      title: s.type === 'sell' ? `${s.name} — elanı yoxlamaq` : `${s.name} — uyğun variantları təqdim etmək`,
      type: 'call', clientId: client?.id || '', note: `Saytdan sorğu: ${summary(s)}\nTelefon: ${s.phone}`,
    }, d, reload));
    $('#del').addEventListener('click', async (e) => {
      if (!confirmClick(e.currentTarget)) return;
      try { await crmDelete('submissions', s.id); toast('Sorğu silindi'); updateCounts(); location.hash = '#/admin/sorgular'; }
      catch (err) { handleAuthError(err); }
    });
  }

  draw();
}

// Mətndəki linkləri klikləmək olsun (məs. Google Maps linki)
function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.length > 50 ? `${u.slice(0, 50)}…` : u}</a>`).replace(/\n/g, '<br/>');
}
