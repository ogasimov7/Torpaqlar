// Saytın əsas parametrləri — makler öz məlumatlarını buradan dəyişə bilər
export const SITE = {
  name: 'Torpaqlar',
  agent: 'Orxan Qasımov',
  role: 'Torpaq üzrə makler',
  phone: '+994 50 000 00 00',
  whatsapp: '994500000000',
  email: 'info@torpaqlar.az',
  address: 'Bakı, Nərimanov rayonu',
  hours: 'Hər gün 09:00 – 20:00',
};

export const STATUS = {
  available: { label: 'Satışda', color: '#3ddc84' },
  reserved: { label: 'Rezerv', color: '#f4b740' },
  sold: { label: 'Satılıb', color: '#ef5350' },
};

export const CATEGORIES = ['Fərdi yaşayış', 'Bağ evi', 'Kommersiya', 'Kənd təsərrüfatı', 'İnvestisiya'];
export const DOCUMENTS = ['Kupça (Çıxarış)', 'Bələdiyyə sənədi', 'Müqavilə'];
export const FEATURES = ['Su', 'İşıq', 'Qaz', 'Asfalt yol', 'Dəniz mənzərəsi', 'Dağ mənzərəsi', 'Meşəyə yaxın', 'Çaya yaxın', 'Hasarlanıb', 'Ağaclar var', 'Magistral kənarı'];

// Azərbaycanın ümumi görünüşü
export const AZ_VIEW = { center: [48.6, 40.45], zoom: 6.6, pitch: 45, bearing: -10 };
