import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './fixtures-def';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'svg');
mkdirSync(dir, { recursive: true });
for (const fx of FIXTURES) {
  writeFileSync(join(dir, fx.file), fx.svg);
  console.log(`scritto fixtures/svg/${fx.file}`);
}
