// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://yakar.me',
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },
  // Menü bağlantılarına imleç gelince sonraki sayfa önceden yüklenir: geçişler anlık hissettirir.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  build: {
    // Stiller her zaman ayrı dosya: CSP `style-src 'self'` satır içi stile izin vermez.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Hiçbir dosya data: URI olarak gömülmez: CSP font-src/img-src 'self' ve satır içi script yasağı.
      assetsInlineLimit: 0,
    },
  },
});
