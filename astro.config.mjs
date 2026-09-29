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
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  markdown: {
    syntaxHighlight: 'prism',
    processor: satteri({ mdastPlugins: [noRawHtml], hastPlugins: [articleBlocks] }),
  },
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      assetsInlineLimit: 0,
    },
  },
});
