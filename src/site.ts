export const site = {
  name: 'Ahmet Yakar',
  domain: 'yakar.me',
  title: 'Yakar',
  url: 'https://yakar.me',
};

export const home = { city: 'Ankara', country: 'Turkey', lat: 39.9334, lon: 32.8597 };

export const nav = [
  { key: 'home', href: '/' },
  { key: 'writing', href: '/writing/' },
  { key: 'reading', href: '/reading/' },
  { key: 'photos', href: '/photos/' },
  { key: 'playing', href: '/playing/' },
  { key: 'about', href: '/about/' },
] as const;

export const links = [
  { href: 'https://github.com/mryakar', label: 'GitHub', short: 'GitHub' },
  { href: 'https://www.linkedin.com/in/ahmetyakar', label: 'LinkedIn', short: 'LinkedIn' },
  { href: 'https://medium.com/@mr-yakar', label: 'Medium', short: 'Medium' },
  { href: 'mailto:ahmet@yakar.me', label: 'ahmet@yakar.me', short: null },
];

export const nowUpdated = new Date('2026-09-29');
