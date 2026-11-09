import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { diff, expectedPath, goldenOf, svgFixtures } from './golden';

describe.each(svgFixtures())('golden %s', (file) => {
  const path = expectedPath(file);
  it.skipIf(!existsSync(path))('coincide con fixtures/expected', () => {
    const d = diff(goldenOf(file), JSON.parse(readFileSync(path, 'utf8')));
    expect(d, `differenze (approva e lancia pnpm fixtures:update):\n${d.join('\n')}`).toEqual([]);
  });
});
