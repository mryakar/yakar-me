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
  { href: '/cv/', label: 'CV', tag: 'PDF' },
];

export const links = [
  { href: 'https://github.com/mryakar', label: 'GitHub' },
  { href: 'https://www.linkedin.com/in/ahmetyakar', label: 'LinkedIn' },
  { href: 'https://medium.com/@mr-yakar', label: 'Medium' },
  { href: 'mailto:ahmet@yakar.me', label: 'ahmet@yakar.me' },
];
