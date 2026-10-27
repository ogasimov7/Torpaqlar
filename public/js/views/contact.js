import { SITE } from '../config.js';
import { $, esc } from '../util.js';

export default function contact(root) {
  const tel = SITE.phone.replace(/\s/g, '');
  root.innerHTML = `
  <section class="page-head container">
    <span class="eyebrow">Əlaqə</span>
    <h1>Gəlin, sizə uyğun torpağı birlikdə tapaq</h1>
  </section>
  <section class="container contact-grid">
    <div class="contact-info">
      <div class="agent">
        <span class="avatar avatar-lg">${esc(SITE.agent.split(' ').map((w) => w[0]).join(''))}</span>
        <div><strong>${esc(SITE.agent)}</strong><span class="muted">${esc(SITE.role)}</span></div>
      </div>
      <a class="contact-row" href="tel:${tel}"><span>Telefon</span><strong>${esc(SITE.phone)}</strong></a>
      <a class="contact-row" href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener"><span>WhatsApp</span><strong>${esc(SITE.phone)}</strong></a>
      <a class="contact-row" href="mailto:${SITE.email}"><span>E-poçt</span><strong>${esc(SITE.email)}</strong></a>
      <div class="contact-row"><span>Ofis</span><strong>${esc(SITE.address)}</strong></div>
      <div class="contact-row"><span>İş saatları</span><strong>${esc(SITE.hours)}</strong></div>
    </div>
    <form class="contact-form" id="cform">
      <h2>Müraciət</h2>
      <div class="seg">
        <label><input type="radio" name="goal" value="almaq" checked /><span>Torpaq almaq</span></label>
        <label><input type="radio" name="goal" value="satmaq" /><span>Torpaq satmaq</span></label>
      </div>
      <label>Adınız<input name="name" required placeholder="Ad, soyad" /></label>
      <label>Telefon<input name="phone" required placeholder="+994 __ ___ __ __" /></label>
      <label>Bölgə və büdcə<input name="region" placeholder="Məs: Qəbələ, 50 000 ₼-a qədər" /></label>
      <label>Qeyd<textarea name="note" rows="4" placeholder="Sahə ölçüsü, təyinat və s."></textarea></label>
      <button class="btn btn-accent btn-block" type="submit">WhatsApp ilə göndər</button>
      <p class="muted small">Göndər düyməsi müraciətinizi hazır mətn kimi WhatsApp-da açır.</p>
    </form>
  </section>`;

  $('#cform').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const msg = `Salam! Mən ${d.name}. Torpaq ${d.goal} istəyirəm.\nTelefon: ${d.phone}${d.region ? `\nBölgə/büdcə: ${d.region}` : ''}${d.note ? `\nQeyd: ${d.note}` : ''}`;
    window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });
}
