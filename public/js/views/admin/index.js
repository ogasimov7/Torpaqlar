// İdarəetmə paneli (CRM). Marşrutlar:
//   #/admin                 — icmal (dashboard)
//   #/admin/elanlar         — elanlar; /elanlar/yeni — yeni elan; /elanlar/:id — redaktə
//   #/admin/muracietler     — müraciətlər (/muracietler/:id — müraciəti açır, /muracietler/elan-:id — elana görə filtr)
//   #/admin/musteriler      — müştərilər; /musteriler/:id — müştəri kartı
//   #/admin/tapsiriqlar     — tapşırıqlar və görüşlər
//   #/admin/qeydler         — qeyd dəftəri
//   #/admin/xerite          — 3D xəritə
import { checkKey, adminKey } from '../../api.js';
import { SITE } from '../../config.js';
import { $, esc, toast } from '../../util.js';
import { ic, rerender, updateCounts } from './common.js';
import dashboard from './dashboard.js';
import listingsPage from './listings.js';
import leadsPage from './leads.js';
import clientsPage from './clients.js';
import tasksPage from './tasks.js';
import notesPage from './notes.js';
import mapPage from './map.js';

const NAV = [
  ['', 'İcmal', 'dash', dashboard],
  ['elanlar', 'Elanlar', 'plots', listingsPage],
  ['muracietler', 'Müraciətlər', 'inbox', leadsPage],
  ['musteriler', 'Müştərilər', 'users', clientsPage],
  ['tapsiriqlar', 'Tapşırıqlar', 'tasks', tasksPage],
  ['qeydler', 'Qeyd dəftəri', 'notes', notesPage],
  ['xerite', '3D Xəritə', 'globe', mapPage],
];

export default async function admin(root, sec = '', sub) {
  if (!adminKey.get()) return login(root);

  // Köhnə linklər: #/admin/yeni və #/admin/1001
  if (sec === 'yeni' || /^\d+$/.test(sec)) {
    sub = sec; sec = 'elanlar';
    history.replaceState(null, '', `#/admin/elanlar/${sub}`);
  }
  const page = NAV.find(([k]) => k === sec) || NAV[0];

  root.innerHTML = `
  <div class="adm">
    <aside class="adm-side" id="admSide">
      <a class="adm-brand" href="#/admin">
        <span class="brand-mark"><svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true"><path d="M3 24 L12 10 L18 18 L22 13 L29 24 Z" fill="currentColor"/></svg></span>
        <span><strong>${esc(SITE.name)}</strong><small>CRM panel</small></span>
      </a>
      <nav class="adm-nav">
        ${NAV.map(([k, label, icon]) => `<a href="#/admin${k ? `/${k}` : ''}" class="${k === page[0] ? 'on' : ''}">${ic(icon)}<span>${label}</span><b class="adm-count" data-count="${k}"></b></a>`).join('')}
      </nav>
      <div class="adm-side-foot">
        <a href="#/" target="_blank">${ic('ext')}<span>Sayta bax</span></a>
        <button type="button" id="logout">${ic('out')}<span>Çıxış</span></button>
      </div>
    </aside>
    <div class="adm-scrim" id="admScrim"></div>
    <div class="adm-body">
      <header class="adm-top">
        <button class="icon-btn" id="admMenu" aria-label="Menyu">${ic('menu')}</button>
        <strong>${page[1]}</strong>
      </header>
      <div class="adm-main admin ${sec === 'xerite' ? 'adm-main-full' : ''}" id="admMain"></div>
    </div>
  </div>`;

  $('#logout', root).addEventListener('click', () => { adminKey.clear(); location.hash = '#/admin'; rerender(); });
  const side = $('#admSide', root);
  $('#admMenu', root).addEventListener('click', () => side.classList.add('open'));
  $('#admScrim', root).addEventListener('click', () => side.classList.remove('open'));
  updateCounts(root);

  return page[3]($('#admMain', root), sub);
}

function login(root) {
  root.innerHTML = `
  <section class="container login">
    <form class="login-card" id="lf">
      <span class="eyebrow">CRM panel</span>
      <h1>Daxil olun</h1>
      <p class="muted">Elanları, müştəriləri və müraciətləri idarə etmək üçün admin açarını daxil edin.</p>
      <label>Admin açarı<input type="password" name="key" required autofocus autocomplete="current-password" /></label>
      <button class="btn btn-accent btn-block">Daxil ol</button>
    </form>
  </section>`;
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = e.target.key.value;
    try { await checkKey(key); adminKey.set(key); rerender(); }
    catch { toast('Açar səhvdir', 'err'); }
  });
}
