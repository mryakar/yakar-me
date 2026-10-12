export const site = {
  name: 'Ahmet Yakar',
  domain: 'yakar.me',
  title: 'Yakar',
  url: 'https://yakar.me',
};

export const home = { city: 'Ankara', country: 'Turkey', lat: 39.9334, lon: 32.8597 };

export const paths = {
  home: '/',
  writing: '/writing/',
  reading: '/reading/',
  photos: '/photos/',
  map: '/photos/map/',
  playing: '/playing/',
  artists: '/playing/artists/',
  about: '/about/',
  search: '/search/',
  feed: '/rss.xml',
} as const;

export const nav = ['home', 'photos', 'writing', 'reading', 'playing', 'about'] as const;

export const sections = ['photos', 'writing', 'reading', 'playing'] as const;

export const links = [
  { href: 'https://github.com/mryakar', label: 'GitHub', short: 'GitHub' },
  { href: 'https://www.linkedin.com/in/ahmetyakar', label: 'LinkedIn', short: 'LinkedIn' },
  { href: 'https://medium.com/@mr-yakar', label: 'Medium', short: 'Medium' },
  { href: 'mailto:ahmet@yakar.me', label: 'ahmet@yakar.me', short: null },
];

export const nowUpdated = new Date('2026-09-29');
