// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';
import { noRawHtml, articleBlocks } from './src/lib/markdown.ts';
import { localeNotFound } from './scripts/lib/locale-not-found.mjs';
import { site } from './src/site.ts';
import { defaultLang, locales } from './src/lib/i18n.ts';

export default defineConfig({
  site: site.url,
  integrations: [localeNotFound(locales.filter((l) => l !== defaultLang))],
  i18n: {
    locales: [...locales],
    defaultLocale: defaultLang,
    routing: { prefixDefaultLocale: false },
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
