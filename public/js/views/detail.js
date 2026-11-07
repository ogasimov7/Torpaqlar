import { getListing, getListings, sendLead } from '../api.js';
import { SITE, STATUS } from '../config.js';
import { $, $$, esc, fmtPrice, fmtArea, perSot, statusBadge, satFigure, gallery, cardHTML, waLink, toast } from '../util.js';

export default async function detail(root, id) {
  const l = await getListing(id);
  if (!l) {
    root.innerHTML = `<section class="container page-head"><h1>Elan tapılmadı</h1><p class="muted">Bu elan silinib və ya kod səhvdir.</p><a class="btn btn-dark" href="#/elanlar">Bütün elanlar</a></section>`;
    return;
  }
  const list = await getListings();
  const similar = list
    .filter((x) => x.id !== l.id && x.status !== 'sold' && (x.region === l.region || x.category === l.category))
    .sort((a, b) => (b.region === l.region) - (a.region === l.region) || Math.abs(a.price - l.price) - Math.abs(b.price - l.price))
    .slice(0, 3);
  const shots = gallery(l);
  const shotHTML = (s, big) =>
    s.type === 'photo'
      ? `<div class="sat"><img src="${esc(s.url)}" alt="${esc(l.title)}" /></div>`
      : satFigure(l, { w: big ? 1200 : 300, h: big ? 760 : 200, pad: s.pad, minSize: s.minSize });

  root.innerHTML = `
  <section class="container detail">
    <nav class="crumbs"><a href="#/">Ana səhifə</a><span>/</span><a href="#/elanlar">Elanlar</a><span>/</span><span>${esc(l.region)}</span></nav>
    <header class="detail-head">
      <div>
        <div class="detail-tags">${statusBadge(l.status)}<span class="badge badge-plain">${esc(l.category)}</span>${l.project ? `<span class="badge badge-plain">${esc(l.project)}</span>` : ''}</div>
        <h1>${esc(l.title)}</h1>
        <p class="muted">${esc(l.region)} rayonu, ${esc(l.settlement)} · Kod: ${l.id}</p>
      </div>
      <div class="detail-price"><strong>${fmtPrice(l.price)}</strong><span>${perSot(l)} / sot</span></div>
    </header>

    <div class="detail-gallery">
      <div class="g-main" id="gMain">${shotHTML(shots[0], true)}<span class="g-label">${shots[0].label || 'Foto'}</span></div>
      <div class="g-thumbs">
        ${shots.map((s, i) => `<button class="g-thumb ${i ? '' : 'active'}" data-i="${i}">${shotHTML(s, false)}<span>${s.label || 'Foto'}</span></button>`).join('')}
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-main">
        <dl class="specs specs-lg">
          <div><dt>Sahə</dt><dd>${fmtArea(l.area)}${l.area >= 100 ? ` <small>(${l.area} sot)</small>` : ''}</dd></div>
          <div><dt>Qiymət</dt><dd>${fmtPrice(l.price)}</dd></div>
          <div><dt>1 sot</dt><dd>${perSot(l)}</dd></div>
          <div><dt>Təyinat</dt><dd>${esc(l.category)}</dd></div>
          <div><dt>Sənəd</dt><dd>${esc(l.document)}</dd></div>
          <div><dt>Status</dt><dd>${STATUS[l.status].label}</dd></div>
          ${l.distances?.sea != null ? `<div><dt>Dənizə</dt><dd>${l.distances.sea} km</dd></div>` : ''}
          ${l.distances?.city != null ? `<div><dt>Rayon mərkəzinə</dt><dd>${l.distances.city} km</dd></div>` : ''}
        </dl>

        <h2 class="h-sm">Kommunikasiya və üstünlüklər</h2>
        <div class="chips chips-lg">${(l.features || []).map((f) => `<span class="chip-s">✓ ${esc(f)}</span>`).join('') || '<span class="muted">Qeyd olunmayıb</span>'}</div>

        <h2 class="h-sm">Təsvir</h2>
        <div class="prose">${esc(l.description).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')}</div>
      </div>

      <aside class="detail-side">
        <div class="agent-card">
          <div class="agent">
            <span class="avatar">${esc(SITE.agent.split(' ').map((w) => w[0]).join(''))}</span>
            <div><strong>${esc(SITE.agent)}</strong><span class="muted">${esc(SITE.role)}</span></div>
          </div>
          <a class="btn btn-accent btn-block" href="tel:${SITE.phone.replace(/\s/g, '')}">${esc(SITE.phone)}</a>
          <a class="btn btn-wa btn-block" href="${waLink(l)}" target="_blank" rel="noopener">WhatsApp ilə yaz</a>
          <p class="muted small">${esc(SITE.hours)}. Baxış üçün əvvəlcədən zəng edin.</p>
        </div>
        ${l.status === 'sold' ? '' : `
        <form class="inquiry" id="inq" novalidate>
          <h3>Bu sahə ilə maraqlanırsınız?</h3>
          <p class="muted small">Sorğu göndərin — makler sizinlə tezliklə əlaqə saxlayacaq.</p>
          <label>Adınız<input name="name" required maxlength="100" autocomplete="name" placeholder="Ad, soyad" /></label>
          <label>Telefon<input name="phone" type="tel" required maxlength="40" autocomplete="tel" placeholder="+994 __ ___ __ __" /></label>
          <label>Mesaj<textarea name="message" rows="3" maxlength="2000">Salam! “${esc(l.title)}” (kod ${l.id}) sahəsi ilə maraqlanıram. Baxış təyin etmək istəyirəm.</textarea></label>
          <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <button class="btn btn-dark btn-block" type="submit">Sorğu göndər</button>
        </form>`}
      </aside>
    </div>

    ${similar.length ? `<section class="section-sm"><h2>Oxşar sahələr</h2><div class="grid cards">${similar.map(cardHTML).join('')}</div></section>` : ''}
  </section>`;

  // Qalereya
  $$('.g-thumb', root).forEach((b) => b.addEventListener('click', () => {
    const s = shots[+b.dataset.i];
    $('#gMain').innerHTML = `${shotHTML(s, true)}<span class="g-label">${s.label || 'Foto'}</span>`;
    $$('.g-thumb', root).forEach((x) => x.classList.toggle('active', x === b));
  }));

  // Elana sorğu
  $('#inq')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const { name, phone, message, website } = f.elements;
    if (!name.value.trim() || phone.value.replace(/\D/g, '').length < 7) {
      (name.value.trim() ? phone : name).focus();
      return toast('Adınızı və telefon nömrənizi yazın', 'err');
    }
    const btn = f.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Göndərilir…';
    try {
      await sendLead({ listingId: l.id, name: name.value, phone: phone.value, message: message.value, website: website.value });
      f.innerHTML = `<div class="inq-ok"><span class="success-ic">✓</span><h3>Sorğunuz göndərildi</h3>
        <p class="muted">Təşəkkür edirik! Makler qısa zamanda sizinlə əlaqə saxlayacaq.</p>
        <a class="btn btn-wa btn-block" href="${waLink(l)}" target="_blank" rel="noopener">Təcili isə — WhatsApp-da yazın</a></div>`;
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = 'Sorğu göndər';
    }
  });
}
