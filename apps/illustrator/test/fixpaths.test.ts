import { describe, expect, it } from 'vitest';
import { parseSvg } from '@compasso/core';
import { toFixPaths } from '../src/js/main/fixpaths';

describe('toFixPaths', () => {
  it('chiuso: un nodo per segmento, maniglie dai segmenti vicini', () => {
    const g = parseSvg('<svg><path d="M0 0 C 10 0 20 10 20 20 L 0 20 Z"/></svg>');
    const [p] = toFixPaths(g);
    expect(p!.closed).toBe(true);
    expect(p!.nodes).toHaveLength(3);
    expect(p!.nodes[0]).toEqual({ a: [0, 0], l: [0, 0], r: [10, 0] });
    expect(p!.nodes[1]).toEqual({ a: [20, 20], l: [20, 10], r: [20, 20] });
  });
  it('aperto: un nodo in più per l’ultimo estremo', () => {
    const g = parseSvg('<svg><path d="M0 0 L 10 0 L 10 10" fill="none" stroke="#000"/></svg>');
    const [p] = toFixPaths(g);
    expect(p!.closed).toBe(false);
    expect(p!.nodes.map((n) => n.a)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });
});
