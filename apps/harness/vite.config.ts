import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  // le fixture stanno nella root del repository: Vite deve poterle leggere
  server: { fs: { allow: [repoRoot] } },
  worker: { format: 'es' },
});
