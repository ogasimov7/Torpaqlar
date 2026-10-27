import { SITE } from './config.js';
import { $, $$, esc, waLink } from './util.js';
import home from './views/home.js';
import listings from './views/listings.js';
import mapView from './views/map.js';
import detail from './views/detail.js';
import contact from './views/contact.js';
import admin from './views/admin.js';
import { initSelects } from './select.js';

const routes = [
  ['home', /^#?\/?$/, home],
  ['listings', /^#\/elanlar$/, listings],
  ['map', /^#\/xerite(?:\/(\w+))?$/, mapView],
  ['detail', /^#\/elan\/(\w+)$/, detail],
  ['contact', /^#\/elaqe$/, contact],
  ['admin', /^#\/admin(?:\/(\w+))?$/, admin],
];

// Ayrı linklər: /admin → idarəetmə paneli, /elan-elave → yeni elan forması
const PATHS = { '/admin': '#/admin', '/elan-elave': '#/admin/yeni' };
const path = location.pathname.replace(/\/+$/, '');
if (PATHS[path]) history.replaceState(null, '', `/${location.hash.startsWith('#/admin') ? location.hash : PATHS[path]}`);

const app = $('#app');
let cleanup = null;
let token = 0;

async function render() {
  const hash = location.hash || '#/';
  const my = ++token;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  const [name, re, view] = routes.find(([, r]) => r.test(hash)) || routes[0];
  const params = hash.match(re)?.slice(1) || [];
  document.body.dataset.route = name;
  $$('#mainNav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name || (name === 'detail' && a.dataset.route === 'listings')));
  document.body.classList.remove('nav-open');
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const result = await view(app, ...params);
  if (my !== token) result?.();
  else cleanup = result;
}

window.addEventListener('hashchange', render);

// Header: scroll effekti və mobil menyu
const header = $('#siteHeader');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
$('#navToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));

$('#headerPhone').href = `tel:${SITE.phone.replace(/\s/g, '')}`;
$('#headerWa').href = waLink();
$('#year').textContent = new Date().getFullYear();
$('#footerContact').innerHTML = `
  <a href="tel:${SITE.phone.replace(/\s/g, '')}">${esc(SITE.phone)}</a>
  <a href="mailto:${SITE.email}">${esc(SITE.email)}</a>
  <span class="muted">${esc(SITE.address)}</span>
  <span class="muted">${esc(SITE.hours)}</span>`;

initSelects();
render();
onScroll();
