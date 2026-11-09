import { describe, expect, it } from 'vitest';
import { arcToCubics, parsePathData, KAPPA } from '../src';

describe('parsePathData', () => {
  it('legge comandi assoluti e relativi e chiude con Z', () => {
    const [sp] = parsePathData('M10 10 l20 0 v20 H10 z');
    expect(sp?.closed).toBe(true);
    expect(sp?.segments.map((s) => s.kind)).toEqual(['line', 'line', 'line', 'line']);
    expect(sp?.segments[1]).toMatchObject({ p0: { x: 30, y: 10 }, p1: { x: 30, y: 30 } });
    expect(sp?.segments[3]).toMatchObject({ p1: { x: 10, y: 10 } });
  });

  it('M con coppie successive diventa L', () => {
    const [sp] = parsePathData('M0 0 10 0 10 10');
    expect(sp?.segments).toHaveLength(2);
  });

  it('S riflette la seconda maniglia, T riflette il controllo quadratico', () => {
    const [sp] = parsePathData('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
    const s = sp?.segments[1];
    expect(s).toMatchObject({ kind: 'cubic', c1: { x: 10, y: -10 } });
    const [q] = parsePathData('M0 0 Q5 10 10 0 T20 0');
    expect(q?.segments).toHaveLength(2);
    expect(q?.segments[1]).toMatchObject({ kind: 'cubic' });
  });

  it('Q diventa una cubica che passa per gli stessi estremi', () => {
    const [sp] = parsePathData('M0 0 Q 5 10 10 0');
    expect(sp?.segments[0]).toMatchObject({
      kind: 'cubic',
      c1: { x: expect.closeTo(10 / 3), y: expect.closeTo(20 / 3) },
    });
  });

  it('separa i sotto-tracciati e numeri compatti ("1-2", ".5.5")', () => {
    const subs = parsePathData('M0 0L1-2M5 5l.5.5');
    expect(subs).toHaveLength(2);
    expect(subs[0]?.segments[0]).toMatchObject({ p1: { x: 1, y: -2 } });
    expect(subs[1]?.segments[0]).toMatchObject({ p1: { x: 5.5, y: 5.5 } });
  });

  it('segnala comandi sconosciuti o path senza comando iniziale', () => {
    expect(() => parsePathData('10 10')).toThrow();
  });
});

describe('arcToCubics', () => {
  it('un quarto di cerchio ha maniglie kappa·r', () => {
    const [seg] = arcToCubics({ x: 10, y: 0 }, 10, 10, 0, false, true, { x: 0, y: 10 });
    if (seg?.kind !== 'cubic') throw new Error('attesa cubica');
    expect(Math.hypot(seg.c1.x - seg.p0.x, seg.c1.y - seg.p0.y)).toBeCloseTo(10 * KAPPA, 2);
  });

  it('un mezzo cerchio produce 2 cubiche; flag large/sweep scelgono l’arco', () => {
    expect(arcToCubics({ x: 0, y: 0 }, 5, 5, 0, false, true, { x: 10, y: 0 })).toHaveLength(2);
    const small = arcToCubics({ x: 0, y: 0 }, 10, 10, 0, false, true, { x: 10, y: 10 });
    const large = arcToCubics({ x: 0, y: 0 }, 10, 10, 0, true, true, { x: 10, y: 10 });
    expect(small).toHaveLength(1);
    expect(large).toHaveLength(3);
  });

  it('raggi troppo piccoli vengono scalati; raggio nullo dà una retta', () => {
    expect(arcToCubics({ x: 0, y: 0 }, 1, 1, 0, false, true, { x: 10, y: 0 })).toHaveLength(2);
    expect(arcToCubics({ x: 0, y: 0 }, 0, 5, 0, false, true, { x: 10, y: 0 })[0]?.kind).toBe(
      'line',
    );
  });
});
