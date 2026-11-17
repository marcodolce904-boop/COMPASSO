import { describe, expect, it } from 'vitest';
import { STRINGS, num, statsText, t } from '../src/strings';

describe('strings', () => {
  it('EN e IT hanno le stesse chiavi e nessun testo vuoto', () => {
    expect(Object.keys(STRINGS.it).sort()).toEqual(Object.keys(STRINGS.en).sort());
    for (const lang of ['en', 'it'] as const) {
      for (const [k, v] of Object.entries(STRINGS[lang]))
        expect(v.trim(), `${lang}:${k}`).not.toBe('');
    }
  });

  it('gli stessi parametri {x} in entrambe le lingue', () => {
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]) {
      expect(params(STRINGS.it[k]), k).toEqual(params(STRINGS.en[k]));
    }
  });

  it('testi del §7.5', () => {
    expect(t('en', 'btn.draw')).toBe('DRAW GUIDES');
    expect(t('it', 'btn.draw')).toBe('DISEGNA COSTRUZIONE');
    expect(statsText('it', { paths: 23, circles: 5, lines: 12 })).toBe(
      '23 tracciati · 5 cerchi, 12 linee',
    );
    expect(statsText('it', { paths: 1, circles: 1, lines: 0 })).toBe(
      '1 tracciato · 1 cerchio, 0 linee',
    );
    expect(statsText('en', { paths: 1, circles: 2, lines: 1 })).toBe('1 path · 2 circles, 1 line');
    expect(t('en', 'findings.none')).toBe('No issues: the construction is clean');
  });

  it('parametri mancanti restano visibili', () => {
    expect(t('en', 'elements.title')).toBe('Elements ({n})');
  });

  it('numeri: virgola decimale in italiano', () => {
    expect(num('it', 0.75, 2)).toBe('0,75');
    expect(num('en', 0.75, 2)).toBe('0.75');
  });
});
