import { SITE } from '../config.js';
import { $, esc, toast } from '../util.js';
import { sendLead } from '../api.js';

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
      <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="btn btn-accent btn-block" type="submit">Müraciət göndər</button>
      <p class="muted small">Müraciətiniz maklerə çatacaq və sizinlə tezliklə əlaqə saxlanılacaq.</p>
    </form>
  </section>`;

  $('#cform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const d = Object.fromEntries(new FormData(f));
    if (!d.name.trim() || d.phone.replace(/\D/g, '').length < 7) return toast('Adınızı və telefon nömrənizi yazın', 'err');
    const msg = `Salam! Mən ${d.name}. Torpaq ${d.goal} istəyirəm.\nTelefon: ${d.phone}${d.region ? `\nBölgə/büdcə: ${d.region}` : ''}${d.note ? `\nQeyd: ${d.note}` : ''}`;
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await sendLead({
        name: d.name, phone: d.phone, goal: d.goal, website: d.website,
        message: [d.region && `Bölgə/büdcə: ${d.region}`, d.note].filter(Boolean).join('\n'),
      });
      f.innerHTML = `<div class="inq-ok"><span class="success-ic">✓</span><h2>Müraciətiniz qəbul olundu</h2>
        <p class="muted">Təşəkkür edirik, ${esc(d.name)}! Tezliklə sizinlə əlaqə saxlayacağıq.</p>
        <a class="btn btn-wa btn-block" href="https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp-da da yazmaq</a></div>`;
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
    }
  });
}
