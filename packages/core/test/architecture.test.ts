import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('regole dei pacchetti (§5.5)', () => {
  const src = files(join(__dirname, '..', 'src'));

  it('core non importa da ui, dalle app o da pacchetti esterni', () => {
    for (const f of src) {
      const imports = [...readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
        (m) => m[1] as string,
      );
      for (const i of imports) {
        expect(i.startsWith('.'), `${f} importa "${i}"`).toBe(true);
        expect(/(@compasso\/ui|apps\/|packages\/ui)/.test(i), `${f} importa "${i}"`).toBe(false);
      }
    }
  });

  it('core non usa il DOM né API dell’host', () => {
    for (const f of src) {
      const text = readFileSync(f, 'utf8')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      expect(/\b(document|window|DOMParser|localStorage|CSInterface)\b/.test(text), f).toBe(false);
    }
  });
});
