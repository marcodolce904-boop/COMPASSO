import type { CEP_Config } from 'vite-cep-plugin';
import { version } from './package.json';

// Manifest CEP (SPEC §8, Fase 4). Si sviluppa e si testa su Illustrator 2026 (v31.0):
// le versioni precedenti vanno dichiarate solo dopo averle provate.
const config: CEP_Config = {
  version,
  id: 'com.marcodolce.compasso',
  displayName: 'Compasso',
  symlink: 'local',
  port: 3000,
  servePort: 5000,
  startingDebugPort: 8860,
  extensionManifestVersion: 6.0,
  requiredRuntimeVersion: 11.0,
  hosts: [{ name: 'ILST', version: '[31.0,99.9]' }],
  type: 'Panel',
  iconDarkNormal: './assets/light-icon.png',
  iconNormal: './assets/dark-icon.png',
  iconDarkNormalRollOver: './assets/light-icon.png',
  iconNormalRollOver: './assets/dark-icon.png',
  parameters: ['--v=0', '--enable-nodejs', '--mixed-context'],
  width: 320,
  height: 720,
  panels: [
    {
      mainPath: './main/index.html',
      name: 'main',
      panelDisplayName: 'Compasso',
      autoVisible: true,
      width: 320,
      height: 720,
      minWidth: 280,
      minHeight: 420,
      // pannello ridimensionabile liberamente: più grande = anteprime più grandi, due colonne
      maxWidth: 3000,
      maxHeight: 3000,
    },
  ],
  build: { jsxBin: 'off', sourceMap: true },
  zxp: {
    country: 'IT',
    province: 'IT',
    org: 'MarcoDolce', // senza spazi: vite-cep-plugin non mette tra virgolette gli argomenti di ZXPSignCmd
    password: 'password', // certificato self-signed per uso personale (§8.7)
    tsa: ['http://timestamp.digicert.com/', 'http://timestamp.apple.com/ts01'],
    allowSkipTSA: false,
    sourceMap: false,
    jsxBin: 'off',
  },
  installModules: [],
  copyAssets: ['assets'], // icone del pannello → dist/cep/assets
  copyZipAssets: [],
};
export default config;
