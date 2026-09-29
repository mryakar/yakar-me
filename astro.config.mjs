// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { noRawHtml, articleBlocks } from './src/lib/markdown.ts';

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
  markdown: {
    // Prism sınıf üretir; Shiki renkleri satır içi style="" olarak basar (CSP style-src 'self').
    syntaxHighlight: 'prism',
    processor: satteri({ mdastPlugins: [noRawHtml], hastPlugins: [articleBlocks] }),
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
