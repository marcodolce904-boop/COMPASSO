// Contorni delle zone d'inchiostro (marching squares): anelli chiusi di punti a metà tra pixel.

import type { Vec2 } from '../model';
import type { Mask } from './raster';

export function contours(m: Mask): Vec2[][] {
  const { width: w, height: h, data } = m;
  const v = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? data[y * w + x]! : 0);
  // punto a metà di un lato: chiave intera (coordinate raddoppiate)
  const key = (x2: number, y2: number) => `${x2},${y2}`;
  const adj = new Map<string, string[]>();
  const pos = new Map<string, Vec2>();
  const link = (a: [number, number], b: [number, number]) => {
    const ka = key(a[0], a[1]);
    const kb = key(b[0], b[1]);
    pos.set(ka, { x: a[0] / 2, y: a[1] / 2 });
    pos.set(kb, { x: b[0] / 2, y: b[1] / 2 });
    (adj.get(ka) ?? adj.set(ka, []).get(ka)!).push(kb);
    (adj.get(kb) ?? adj.set(kb, []).get(kb)!).push(ka);
  };
  // cella (cx, cy): angoli = centri dei pixel (cx-1, cy-1) … (cx, cy); coordinate ×2
  for (let cy = 0; cy <= h; cy++) {
    for (let cx = 0; cx <= w; cx++) {
      const tl = v(cx - 1, cy - 1);
      const tr = v(cx, cy - 1);
      const br = v(cx, cy);
      const bl = v(cx - 1, cy);
      const c = tl * 8 + tr * 4 + br * 2 + bl;
      if (c === 0 || c === 15) continue;
      // metà dei lati della cella, in coordinate pixel ×2 (centro pixel i → 2i+1)
      const T: [number, number] = [2 * cx, 2 * cy - 1];
      const R: [number, number] = [2 * cx + 1, 2 * cy];
      const B: [number, number] = [2 * cx, 2 * cy + 1];
      const L: [number, number] = [2 * cx - 1, 2 * cy];
      switch (c) {
        case 1:
        case 14:
          link(L, B);
          break;
        case 2:
        case 13:
          link(B, R);
          break;
        case 3:
        case 12:
          link(L, R);
          break;
        case 4:
        case 11:
          link(T, R);
          break;
        case 6:
        case 9:
          link(T, B);
          break;
        case 7:
        case 8:
          link(L, T);
          break;
        case 5: // diagonale tl-br vuota: due pezzi separati
          link(L, T);
          link(B, R);
          break;
        case 10:
          link(T, R);
          link(L, B);
          break;
      }
    }
  }
  const seen = new Set<string>();
  const loops: Vec2[][] = [];
  for (const start of [...adj.keys()].sort()) {
    if (seen.has(start)) continue;
    const loop: Vec2[] = [];
    let prev = '';
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(pos.get(cur)!);
      const next = (adj.get(cur) ?? []).find((k) => k !== prev && !seen.has(k));
      if (!next) break;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 4) loops.push(loop.map((p) => ({ x: p.x, y: p.y })));
  }
  return loops;
}

/**
 * Contorni di livello di un campo (marching squares con interpolazione lineare): anelli chiusi di
 * punti SOTTO il pixel dove il campo vale `level`. Fuori dall'immagine il campo vale −∞ (vuoto).
 */
export function isoContours(f: Float32Array, w: number, h: number, level: number): Vec2[][] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? f[y * w + x]! : -1e9);
  // punti sui lati tra centri di pixel: lato orizzontale (x,y)-(x+1,y) = "h", verticale = "v"
  const pt = new Map<string, Vec2>();
  const adj = new Map<string, string[]>();
  const edge = (kind: 'h' | 'v', x: number, y: number) => {
    const k = `${kind}${x},${y}`;
    if (!pt.has(k)) {
      const a = at(x, y);
      const b = kind === 'h' ? at(x + 1, y) : at(x, y + 1);
      const t = Math.abs(b - a) < 1e-12 ? 0.5 : Math.min(1, Math.max(0, (level - a) / (b - a)));
      pt.set(k, kind === 'h' ? { x: x + 0.5 + t, y: y + 0.5 } : { x: x + 0.5, y: y + 0.5 + t });
    }
    return k;
  };
  const link = (a: string, b: string) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };
  // celle tra i centri (x,y)…(x+1,y+1), con una cornice di celle fuori dall'immagine
  for (let y = -1; y < h; y++)
    for (let x = -1; x < w; x++) {
      const tl = at(x, y) > level ? 1 : 0;
      const tr = at(x + 1, y) > level ? 1 : 0;
      const br = at(x + 1, y + 1) > level ? 1 : 0;
      const bl = at(x, y + 1) > level ? 1 : 0;
      const c = tl * 8 + tr * 4 + br * 2 + bl;
      if (c === 0 || c === 15) continue;
      const T = () => edge('h', x, y);
      const B = () => edge('h', x, y + 1);
      const L = () => edge('v', x, y);
      const R = () => edge('v', x + 1, y);
      const centre = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 > level;
      switch (c) {
        case 1:
        case 14:
          link(L(), B());
          break;
        case 2:
        case 13:
          link(B(), R());
          break;
        case 3:
        case 12:
          link(L(), R());
          break;
        case 4:
        case 11:
          link(T(), R());
          break;
        case 6:
        case 9:
          link(T(), B());
          break;
        case 7:
        case 8:
          link(L(), T());
          break;
        case 5: // tl e br vuoti, tr e bl pieni
          if (centre) {
            link(L(), T());
            link(B(), R());
          } else {
            link(T(), R());
            link(L(), B());
          }
          break;
        case 10: // tl e br pieni
          if (centre) {
            link(T(), R());
            link(L(), B());
          } else {
            link(L(), T());
            link(B(), R());
          }
          break;
      }
    }
  // catene chiuse
  const seen = new Set<string>();
  const out: Vec2[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: Vec2[] = [];
    let prev = '';
    let cur = start;
    for (let guard = 0; guard < 4 * pt.size + 4; guard++) {
      seen.add(cur);
      loop.push(pt.get(cur)!);
      const next = (adj.get(cur) ?? []).find((n) => n !== prev && !seen.has(n));
      if (!next) break;
      prev = cur;
      cur = next;
    }
    if (loop.length >= 3) out.push(loop);
  }
  return out;
}
