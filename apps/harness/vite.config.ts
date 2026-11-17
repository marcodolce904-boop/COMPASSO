import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
// la versione mostrata nel pannello è quella del plugin per Illustrator
const pluginPkg = JSON.parse(
  readFileSync(new URL('../illustrator/package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [svelte()],
  // le fixture stanno nella root del repository: Vite deve poterle leggere
  server: { fs: { allow: [repoRoot] } },
  worker: { format: 'es' },
  define: { __COMPASSO_VERSION__: JSON.stringify(pluginPkg.version) },
});
