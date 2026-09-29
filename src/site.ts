// Sitenin sabit verisi: menü ve bağlantılar. Menüye yalnızca var olan sayfalar girer;
// eksik sayfaya giden bağlantı CI'daki bağlantı denetiminde build'i kırar.
export const site = {
  name: 'Ahmet Yakar',
  domain: 'yakar.me',
  description: 'Software engineer, writer and traveller. Java, distributed systems, and the mechanisms underneath.',
};

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/writing/', label: 'Writing' },
  { href: '/about/', label: 'About' },
];

// short: telefon menüsündeki dar satırda görünen ad.
export const links = [
  { href: 'https://github.com/mryakar', label: 'GitHub', short: 'GitHub' },
  { href: 'https://www.linkedin.com/in/ahmetyakar', label: 'LinkedIn', short: 'LinkedIn' },
  { href: 'https://medium.com/@mr-yakar', label: 'Medium', short: 'Medium' },
  { href: 'mailto:ahmet@yakar.me', label: 'ahmet@yakar.me', short: 'Email' },
];

export const tagline = 'engineer · writer · traveller';

// Ana sayfadaki "Now" bölümü. Her yeni yazıda gözden geçirilir.
export const now = {
  updated: new Date('2026-09-29'),
  items: [
    { label: 'Reading', title: 'Designing Data-Intensive Applications', rest: ', second edition. Slowly, with a pencil.' },
    { label: 'Writing', title: '', rest: 'A piece on compare-and-swap. Compare, swap, rewrite the introduction, repeat.' },
    { label: 'Playing', title: '', rest: 'Alto saxophone. The neighbours have been very understanding.' },
  ],
};
