// Saytın dizaynında açılan siyahı: brauzerin standart <select> pəncərəsi əvəzinə.
// <select> elementi yerində qalır (forma, filtrlər, FormData əvvəlki kimi işləyir) — yalnız açılan siyahı bizimdir.
// Seçimdən sonra select-də "input" və "change" hadisələri yaranır.

let pop = null; // { sel, el, items, idx }
let typed = '', typedAt = 0;

const isCustom = (el) => el instanceof HTMLSelectElement && !el.multiple && el.size <= 1 && !el.dataset.native;

const check = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

function open(sel) {
  if (sel.disabled) return;
  close();
  const el = document.createElement('div');
  el.className = 'csel-pop';
  el.setAttribute('role', 'listbox');
  const opts = [...sel.options].filter((o) => !o.hidden);
  el.innerHTML = opts
    .map((o, i) => {
      const dot = o.dataset.color ? `<i style="background:${o.dataset.color}"></i>` : '';
      return `<div class="csel-opt${o.selected ? ' is-sel' : ''}${o.disabled ? ' is-dis' : ''}" role="option" data-i="${i}" aria-selected="${o.selected}">${dot}<span>${o.textContent}</span>${check}</div>`;
    })
    .join('');
  document.body.appendChild(el);
  const items = [...el.children];
  pop = { sel, el, items, opts, idx: Math.max(0, opts.findIndex((o) => o.selected)) };
  sel.classList.add('csel-open');
  place();
  highlight(pop.idx, true);
  requestAnimationFrame(() => el.classList.add('in'));

  el.addEventListener('pointerdown', (e) => e.preventDefault()); // fokus select-də qalsın
  el.addEventListener('click', (e) => {
    const it = e.target.closest('.csel-opt');
    if (it && !it.classList.contains('is-dis')) choose(+it.dataset.i);
  });
  el.addEventListener('pointermove', (e) => {
    const it = e.target.closest('.csel-opt');
    if (it && +it.dataset.i !== pop.idx) highlight(+it.dataset.i);
  });
}

function place() {
  if (!pop) return;
  const r = pop.sel.getBoundingClientRect();
  // Select ekrandan çıxıbsa və ya gizlənibsə — bağla
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return close();
  const el = pop.el;
  // Hero axtarışında select etiketin içindədir — siyahını bütün seqmentin altında aç
  const box = pop.sel.closest('.hero-search label')?.getBoundingClientRect() || r;
  const w = Math.max(box.width, 190);
  el.style.width = `${w}px`;
  el.style.left = `${Math.min(Math.max(8, box.left), innerWidth - w - 8)}px`;
  const h = Math.min(el.scrollHeight, 320);
  const below = innerHeight - box.bottom - 12;
  const up = below < Math.min(h, 200) && box.top > below;
  el.style.maxHeight = `${Math.max(120, Math.min(320, up ? box.top - 12 : below))}px`;
  el.style.top = up ? '' : `${box.bottom + 6}px`;
  el.style.bottom = up ? `${innerHeight - box.top + 6}px` : '';
  el.classList.toggle('up', up);
}

function highlight(i, center = false) {
  if (!pop) return;
  pop.idx = i;
  pop.items.forEach((it, k) => it.classList.toggle('is-hi', k === i));
  const it = pop.items[i];
  if (!it) return;
  const { el } = pop;
  if (center) el.scrollTop = it.offsetTop - el.clientHeight / 2 + it.offsetHeight / 2;
  else if (it.offsetTop < el.scrollTop) el.scrollTop = it.offsetTop - 4;
  else if (it.offsetTop + it.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = it.offsetTop + it.offsetHeight - el.clientHeight + 4;
}

function move(d) {
  if (!pop) return;
  let i = pop.idx;
  for (let n = 0; n < pop.opts.length; n++) {
    i = Math.min(pop.opts.length - 1, Math.max(0, i + d));
    if (!pop.opts[i].disabled) break;
  }
  highlight(i);
}

function choose(i) {
  const { sel, opts } = pop;
  const o = opts[i];
  close();
  if (!o || o.disabled || o.selected) return;
  o.selected = true;
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function close() {
  if (!pop) return;
  const { el, sel } = pop;
  sel.classList.remove('csel-open');
  el.classList.remove('in');
  setTimeout(() => el.remove(), 150);
  pop = null;
}

function typeahead(ch) {
  const now = Date.now();
  typed = now - typedAt > 700 ? ch : typed + ch;
  typedAt = now;
  const q = typed.toLocaleLowerCase('az');
  const i = pop.opts.findIndex((o) => !o.disabled && o.textContent.trim().toLocaleLowerCase('az').startsWith(q));
  if (i >= 0) highlight(i);
}

export function initSelects() {
  const toggle = (sel) => (pop?.sel === sel ? close() : open(sel));

  // Siçan: brauzerin öz siyahısının açılmasının qarşısını al
  document.addEventListener('pointerdown', (e) => {
    if (pop && !pop.el.contains(e.target) && e.target !== pop.sel) close();
    const sel = e.target;
    if (!isCustom(sel) || e.pointerType === 'touch' || e.button !== 0) return;
    e.preventDefault();
    sel.focus({ preventScroll: true });
    toggle(sel);
  }, true);
  document.addEventListener('mousedown', (e) => { if (isCustom(e.target)) e.preventDefault(); }, true);

  // Toxunma (telefon): sistem seçicisinin əvəzinə bizim siyahı
  document.addEventListener('touchend', (e) => {
    const sel = e.target;
    if (!isCustom(sel)) return;
    e.preventDefault();
    toggle(sel);
  }, { capture: true, passive: false });

  // Etiketin mətninə klik (məs. "Bölgə") — siyahını aç
  document.addEventListener('click', (e) => {
    if (isCustom(e.target)) return e.preventDefault();
    const label = e.target.closest('label');
    const sel = label?.control;
    if (!isCustom(sel) || pop?.el.contains(e.target)) return;
    e.preventDefault();
    sel.focus({ preventScroll: true });
    toggle(sel);
  }, true);

  // Klaviatura
  document.addEventListener('keydown', (e) => {
    const sel = e.target;
    if (!isCustom(sel)) return;
    const k = e.key;
    if (!pop || pop.sel !== sel) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k) || (e.altKey && k === 'ArrowDown')) { e.preventDefault(); open(sel); }
      else if (k.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(sel); typeahead(k); }
      return;
    }
    const map = { ArrowDown: 1, ArrowUp: -1, PageDown: 6, PageUp: -6, Home: -1e3, End: 1e3 };
    if (k in map) { e.preventDefault(); move(map[k]); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(pop.idx); }
    else if (k === 'Escape') { e.preventDefault(); close(); }
    else if (k === 'Tab') close();
    else if (k.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); typeahead(k); }
  }, true);

  addEventListener('scroll', (e) => { if (pop && !pop.el.contains(e.target)) place(); }, true);
  addEventListener('resize', close);
  addEventListener('hashchange', close);
  document.addEventListener('focusout', (e) => { if (pop && e.target === pop.sel) setTimeout(() => pop && document.activeElement !== pop.sel && close(), 0); });
}
