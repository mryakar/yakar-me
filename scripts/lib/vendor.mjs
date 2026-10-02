import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { MAPLIBRE_DIR, MAPLIBRE_FILES } from '../../src/lib/vendor.ts';

const SOURCE_MAP = /\n\/\/# sourceMappingURL=\S+\s*$/;

export const vendor = () => ({
  name: 'vendor',
  hooks: {
    'astro:config:setup': async ({ config }) => {
      const source = new URL('node_modules/maplibre-gl/dist/', config.root);
      const target = new URL(MAPLIBRE_DIR.slice(1), config.publicDir);
      await rm(new URL('vendor/', config.publicDir), { recursive: true, force: true });
      await mkdir(target, { recursive: true });
      for (const file of MAPLIBRE_FILES) {
        const code = await readFile(new URL(file, source), 'utf8');
        await writeFile(new URL(file, target), code.replace(SOURCE_MAP, '\n'));
      }
    },
  },
});
