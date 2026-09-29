import { rename, rmdir } from 'node:fs/promises';

export const localeNotFound = (locales) => ({
  name: 'locale-not-found',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      for (const lang of locales) {
        await rename(new URL(`${lang}/404/index.html`, dir), new URL(`${lang}/404.html`, dir));
        await rmdir(new URL(`${lang}/404/`, dir));
      }
    },
  },
});
