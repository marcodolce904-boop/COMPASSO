// Rigenera fixtures/expected/*.json e mostra le differenze. Le modifiche vanno approvate
// da Marco prima del commit (SPEC §10.2). Uso: pnpm fixtures:update [--out <cartella>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { EXPECTED_DIR, diff, expectedPath, goldenOf, svgFixtures } from './golden';

const outIdx = process.argv.indexOf('--out');
const outDir = outIdx > 0 ? process.argv[outIdx + 1]! : EXPECTED_DIR;
mkdirSync(outDir, { recursive: true });

let changed = 0;
for (const file of svgFixtures()) {
  const now = goldenOf(file);
  const prevPath = expectedPath(file);
  const target = join(outDir, basename(prevPath));
  if (!existsSync(prevPath)) {
    console.log(`+ ${basename(prevPath)} (nuovo)`);
    changed++;
  } else {
    const d = diff(now, JSON.parse(readFileSync(prevPath, 'utf8')));
    if (d.length) {
      changed++;
      console.log(`~ ${basename(prevPath)}: ${d.length} differenze`);
      for (const line of d.slice(0, 15)) console.log(`    ${line}`);
      if (d.length > 15) console.log(`    … altre ${d.length - 15}`);
    }
  }
  writeFileSync(target, JSON.stringify(now, null, 2) + '\n');
}
console.log(changed ? `${changed} file cambiati in ${outDir}` : 'Nessuna differenza.');
