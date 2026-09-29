// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://yakar.me',
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },
  build: {
    // Stiller her zaman ayrı dosya: CSP `style-src 'self'` satır içi stile izin vermez.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
