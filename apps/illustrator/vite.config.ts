import { defineConfig } from 'vite';

import { svelte } from '@sveltejs/vite-plugin-svelte';

import { cep, CepOptions, runAction } from 'vite-cep-plugin';
import cepConfig from './cep.config';
import path from 'path';
import { extendscriptConfig } from './vite.es.config';

const extensions = ['.js', '.ts', '.tsx'];

const devDist = 'dist';
const cepDist = 'cep';

const src = path.resolve(__dirname, 'src');
const root = path.resolve(src, 'js');
const outDir = path.resolve(__dirname, 'dist', cepDist);

const debugReact = process.env.DEBUG_REACT === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const isMetaPackage = process.env.ZIP_PACKAGE === 'true';
const isPackage = process.env.ZXP_PACKAGE === 'true' || isMetaPackage;
const isServe = process.env.SERVE_PANEL === 'true';
const action = process.env.BOLT_ACTION;
// svelte-check (pnpm typecheck) legge questa configurazione tramite vitePreprocess: in quel caso
// niente effetti collaterali, altrimenti riscriverebbe dist/ in modalità sviluppo (pannello che
// cerca localhost:3000) e ricompilerebbe lo script ExtendScript.
const configOnly = process.argv.some((a) => /svelte-check/.test(a));

const input: { [key: string]: string } = {};
cepConfig.panels.map((panel) => {
  input[panel.name] = path.resolve(root, panel.mainPath);
});

const config: CepOptions = {
  cepConfig,
  isProduction,
  isPackage,
  isMetaPackage,
  isServe,
  debugReact,
  dir: `${__dirname}/${devDist}`,
  cepDist: cepDist,
  zxpOutput: `${__dirname}/${devDist}/zxp/${cepConfig.id}`,
  zipOutput: `${__dirname}/${devDist}/zip/${cepConfig.displayName}_${cepConfig.version}`,
  packages: cepConfig.installModules || [],
};

if (action && !configOnly) runAction(config, action);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: configOnly ? [svelte()] : [svelte(), cep(config)],
  resolve: {
    alias: [{ find: '@esTypes', replacement: path.resolve(__dirname, 'src') }],
  },
  root,
  clearScreen: false,
  server: {
    port: cepConfig.port,
  },
  preview: {
    port: cepConfig.servePort,
  },

  build: {
    sourcemap: isPackage ? cepConfig.zxp.sourceMap : cepConfig.build?.sourceMap,
    watch: {
      include: 'src/jsx/**',
    },
    // commonjsOptions: {
    //   transformMixedEsModules: true,
    // },
    rollupOptions: {
      input,
      output: {
        manualChunks: {},
        // esModule: false,
        preserveModules: false,
        format: 'cjs',
        entryFileNames: 'assets/[name]-[hash].cjs',
        chunkFileNames: 'assets/[name]-[hash].cjs',
      },
    },
    target: 'chrome74',
    outDir,
  },
});

// rollup es3 build
const outPathExtendscript = path.join('dist', cepDist, 'jsx', 'index.js');
if (!configOnly)
  extendscriptConfig(
    `src/jsx/index.ts`,
    outPathExtendscript,
    cepConfig,
    extensions,
    isProduction,
    isPackage,
  );
