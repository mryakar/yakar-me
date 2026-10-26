import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { themeScriptPath, THEME_SCRIPT_DIR } from '../../src/lib/theme-script.ts';

export const themeScript = () => ({
  name: 'theme-script',
  hooks: {
    'astro:config:setup': async ({ config }) => {
      const source = await readFile(new URL('src/theme.js', config.root), 'utf8');
      const target = new URL(THEME_SCRIPT_DIR.slice(1), config.publicDir);
      await mkdir(target, { recursive: true });
      for (const old of (await readdir(target)).filter((f) => /^theme\.[0-9a-f]{8}\.js$/.test(f)))
        await rm(new URL(old, target));
      await writeFile(new URL((await themeScriptPath(source)).slice(THEME_SCRIPT_DIR.length), target), source);
    },
  },
});
