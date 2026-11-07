// Qeyd dəftəri: sərbəst qeydlər, istəsəniz müştəriyə və ya elana bağlanır
import { getListings, crmList, crmSave } from '../../api.js';
import { $, esc, toast } from '../../util.js';
import { NOTE_COLORS, ic, empty, fmtDateTime, noteForm, handleAuthError } from './common.js';

export default async function notesPage(root) {
  const load = async () => {
    const [listings, clients, notes] = await Promise.all([getListings(), crmList('clients', true), crmList('notes', true)]);
    return { listings, clients, notes };
  };
  let d = await load();
  let color = 'plain';

  root.innerHTML = `<section class="adm-page">
    <div class="admin-head">
      <div><h1>Qeyd dəftəri</h1><p class="muted">Fikirlər, danışıqlar, xatırlatmalar — hər şeyi bir yerdə saxlayın.</p></div>
      <div class="admin-actions"><input class="admin-search" type="search" placeholder="Qeydlərdə axtar…" id="q" /></div>
    </div>
    <form class="note-composer" id="nc">
      <input name="title" placeholder="Başlıq (ixtiyari)" autocomplete="off" />
      <textarea name="text" rows="3" placeholder="Qeyd yazın… (Ctrl+Enter — yadda saxla)" required></textarea>
      <div class="nc-foot">
        <div class="color-pick" id="ncColors">${Object.entries(NOTE_COLORS).map(([k, c]) => `<label><input type="radio" name="color" value="${k}" ${k === 'plain' ? 'checked' : ''} /><i style="background:${c}"></i></label>`).join('')}</div>
        <span class="grow"></span>
        <button type="button" class="btn btn-sm btn-ghost" id="more">Müştəri / elan bağla…</button>
        <button class="btn btn-sm btn-dark">Əlavə et</button>
      </div>
    </form>
    <div class="notes-grid" id="grid"></div>
  </section>`;

  const reload = async () => { d = await load(); draw(); };
  const nc = $('#nc');

  function draw() {
    const q = $('#q').value.toLowerCase().trim();
    const L = Object.fromEntries(d.listings.map((l) => [l.id, l]));
    const C = Object.fromEntries(d.clients.map((c) => [c.id, c]));
    const list = d.notes
      .filter((n) => !q || `${n.title || ''} ${n.text} ${C[n.clientId]?.name || ''} ${L[n.listingId]?.title || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (!!b.pinned - !!a.pinned) || (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
    $('#grid').innerHTML = list.length ? list.map((n) => `
      <article class="note-card ${n.pinned ? 'pinned' : ''}" style="--nb:${NOTE_COLORS[n.color] || '#fff'}" data-id="${n.id}">
        <button class="note-pin" data-pin title="${n.pinned ? 'Sabitləməni ləğv et' : 'Yuxarıda sabitlə'}">${ic('pin', 15)}</button>
        ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}
        <p>${esc(n.text).replace(/\n/g, '<br/>')}</p>
        <div class="note-links">
          ${n.clientId && C[n.clientId] ? `<a href="#/admin/musteriler/${n.clientId}">${ic('user', 12)} ${esc(C[n.clientId].name)}</a>` : ''}
          ${n.listingId && L[n.listingId] ? `<a href="#/admin/elanlar/${n.listingId}">${ic('plots', 12)} ${esc(L[n.listingId].title)}</a>` : ''}
        </div>
        <footer><span>${fmtDateTime(n.updatedAt || n.createdAt)}</span><button class="link-btn" data-edit>${ic('edit', 14)} Redaktə</button></footer>
      </article>`).join('') : empty(d.notes.length ? 'Axtarışa uyğun qeyd yoxdur.' : 'Hələ qeyd yoxdur. Yuxarıdakı xanada ilk qeydinizi yazın.');
  }

  const quickSave = async () => {
    const text = nc.elements.text.value.trim();
    if (!text) return nc.elements.text.focus();
    try {
      await crmSave('notes', { title: nc.elements.title.value.trim(), text, color: nc.querySelector('[name=color]:checked').value });
      nc.reset();
      toast('Qeyd əlavə olundu');
      await reload();
    } catch (err) { handleAuthError(err); }
  };
  nc.addEventListener('submit', (e) => { e.preventDefault(); quickSave(); });
  nc.elements.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); quickSave(); } });
  $('#more').addEventListener('click', () => {
    noteForm({ title: nc.elements.title.value.trim(), text: nc.elements.text.value.trim(), color: nc.querySelector('[name=color]:checked').value }, d, (n) => { if (n) nc.reset(); reload(); });
  });
  $('#q').addEventListener('input', draw);
  $('#grid').addEventListener('click', async (e) => {
    const card = e.target.closest('.note-card');
    if (!card) return;
    const n = d.notes.find((x) => x.id === card.dataset.id);
    if (e.target.closest('[data-edit]')) return noteForm(n, d, reload);
    if (e.target.closest('[data-pin]')) {
      try { await crmSave('notes', { id: n.id, pinned: !n.pinned }); await reload(); }
      catch (err) { handleAuthError(err); }
    }
  });
  draw();
}
