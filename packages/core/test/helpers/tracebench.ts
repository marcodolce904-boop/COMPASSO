// Banco di prova del ricalco: figure con forma vera nota, disegnate "a matita" con difetti
// realistici, e misure del risultato (scarto, pezzi mancanti, anchor, spigoli, verso).

import type { DocumentGeometry, RasterImage, Segment, Vec2 } from '../../src';
import { paper, pencil } from './sketch';

export type Level = 'facile' | 'normale' | 'difficile';

export interface Figure {
  name: string;
  w: number;
  h: number;
  /** Tracciati veri: polilinee fitte (chiuse se `closed`). */
  paths: { pts: Vec2[]; closed: boolean }[];
  /** Spigoli veri. */
  corners: Vec2[];
  /** Minimo ragionevole di anchor (come li metterebbe un designer). */
  ideal: number;
}

const poly = (pts: [number, number][], closed: boolean, step = 2): Vec2[] => {
  const out: Vec2[] = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[(i + 1) % n]!;
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.max(1, Math.ceil(d / step));
    for (let j = 0; j < k; j++)
      out.push({ x: ax + ((bx - ax) * j) / k, y: ay + ((by - ay) * j) / k });
  }
  if (!closed) out.push({ x: pts[n - 1]![0], y: pts[n - 1]![1] });
  return out;
};
const curve = (f: (t: number) => Vec2, n = 400, closed = true): Vec2[] =>
  Array.from({ length: closed ? n : n + 1 }, (_, i) => f(i / n));

const P = (pts: [number, number][]) => pts.map(([x, y]) => ({ x, y }));

function insidePoly(p: Vec2, poly: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/**
 * Come lo schizzo di Marco (A + coda di volpe): una A a contorno le cui gambe passano DIETRO una
 * coda sinuosa. Le linee della A finiscono contro il contorno della coda (incroci a T).
 */
function aDietroLaCoda(): Figure {
  const A: [number, number][] = [
    [245, 60],
    [325, 60],
    [500, 600],
    [420, 600],
    [375, 460],
    [195, 460],
    [150, 600],
    [70, 600],
  ];
  const counter: [number, number][] = [
    [285, 175],
    [345, 380],
    [225, 380],
  ];
  const tail = curve((t) => {
    const a = t * 6.2832;
    return {
      x: 300 - 250 * Math.cos(a),
      y: 380 + 70 * Math.sin(a) - 40 * Math.sin(2 * a) + 30 * Math.cos(a),
    };
  }, 500);
  // parti della A fuori dalla coda: tratti aperti che finiscono sul contorno della coda
  const runs: { pts: Vec2[]; closed: boolean }[] = [];
  const corners: Vec2[] = [];
  let ideal = 6; // la coda
  for (const shape of [A, counter]) {
    const dense = poly(shape, true, 1);
    const n = dense.length;
    // si parte da un punto fuori dalla coda, così nessun tratto attraversa l'inizio
    let start = 0;
    while (start < n && insidePoly(dense[start]!, tail)) start++;
    let cur: Vec2[] = [];
    let allOutside = true;
    for (let k = 0; k <= n; k++) {
      const q = dense[(start + k) % n]!;
      if (insidePoly(q, tail)) {
        allOutside = false;
        if (cur.length > 4) runs.push({ pts: cur, closed: false });
        cur = [];
      } else cur.push(q);
    }
    if (allOutside) runs.push({ pts: dense, closed: true });
    else if (cur.length > 4) runs.push({ pts: cur, closed: false });
    for (const [x, y] of shape) if (!insidePoly({ x, y }, tail)) corners.push({ x, y });
  }
  for (const r of runs) {
    const inner = corners.filter((c) =>
      r.pts.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 1.5),
    ).length;
    ideal += inner + (r.closed ? 0 : 2);
  }
  return {
    name: 'A dietro la coda',
    w: 600,
    h: 660,
    paths: [...runs, { pts: tail, closed: true }],
    corners,
    ideal,
  };
}

export const FIGURES: Figure[] = [
  {
    name: 'cerchio',
    w: 500,
    h: 500,
    paths: [
      {
        pts: curve((t) => ({
          x: 250 + 170 * Math.cos(t * 6.2832),
          y: 250 + 170 * Math.sin(t * 6.2832),
        })),
        closed: true,
      },
    ],
    corners: [],
    ideal: 4,
  },
  {
    name: 'ovale ruotato',
    w: 600,
    h: 500,
    paths: [
      {
        pts: curve((t) => {
          const a = t * 6.2832;
          const u = 220 * Math.cos(a);
          const v = 110 * Math.sin(a);
          return {
            x: 300 + u * Math.cos(0.4) - v * Math.sin(0.4),
            y: 250 + u * Math.sin(0.4) + v * Math.cos(0.4),
          };
        }),
        closed: true,
      },
    ],
    corners: [],
    ideal: 4,
  },
  {
    name: 'quadrato',
    w: 500,
    h: 500,
    paths: [
      {
        pts: poly(
          [
            [90, 90],
            [410, 90],
            [410, 410],
            [90, 410],
          ],
          true,
        ),
        closed: true,
      },
    ],
    corners: P([
      [90, 90],
      [410, 90],
      [410, 410],
      [90, 410],
    ]),
    ideal: 4,
  },
  {
    name: 'triangolo',
    w: 500,
    h: 500,
    paths: [
      {
        pts: poly(
          [
            [250, 70],
            [430, 420],
            [70, 420],
          ],
          true,
        ),
        closed: true,
      },
    ],
    corners: P([
      [250, 70],
      [430, 420],
      [70, 420],
    ]),
    ideal: 3,
  },
  {
    name: 'fulmine',
    w: 500,
    h: 640,
    paths: [
      {
        pts: poly(
          [
            [300, 40],
            [150, 330],
            [255, 320],
            [185, 590],
            [390, 250],
            [280, 262],
          ],
          true,
        ),
        closed: true,
      },
    ],
    corners: P([
      [300, 40],
      [150, 330],
      [255, 320],
      [185, 590],
      [390, 250],
      [280, 262],
    ]),
    ideal: 6,
  },
  {
    name: 'A (contorno)',
    w: 520,
    h: 620,
    paths: [
      {
        pts: poly(
          [
            [225, 50],
            [295, 50],
            [470, 570],
            [395, 570],
            [350, 430],
            [170, 430],
            [125, 570],
            [50, 570],
          ],
          true,
        ),
        closed: true,
      },
      {
        pts: poly(
          [
            [260, 160],
            [325, 360],
            [195, 360],
          ],
          true,
        ),
        closed: true,
      },
    ],
    corners: P([
      [225, 50],
      [295, 50],
      [470, 570],
      [395, 570],
      [350, 430],
      [170, 430],
      [125, 570],
      [50, 570],
      [260, 160],
      [325, 360],
      [195, 360],
    ]),
    ideal: 11,
  },
  {
    name: 'S aperta',
    w: 640,
    h: 340,
    paths: [
      {
        pts: curve((t) => ({ x: 60 + 520 * t, y: 170 + 100 * Math.sin(t * 6.2832) }), 400, false),
        closed: false,
      },
    ],
    corners: [],
    ideal: 3,
  },
  {
    name: 'goccia (coda)',
    w: 600,
    h: 420,
    paths: [
      {
        // punta a sinistra, ventre tondo a destra: curva liscia con uno spigolo vivo
        pts: curve((t) => {
          const a = t * 6.2832;
          const r = 1 - Math.cos(a / 2) ** 8 * 0.0;
          const x = 300 - 230 * Math.cos(a) * r;
          const y = 210 + 150 * Math.sin(a) * Math.sin(a / 2) ** 1.5;
          return { x: 300 + (x - 300), y };
        }),
        closed: true,
      },
    ],
    corners: P([[70, 210]]),
    ideal: 4,
  },
  {
    name: 'onda chiusa',
    w: 560,
    h: 560,
    paths: [
      {
        pts: curve((t) => {
          const a = t * 6.2832;
          const r = 190 + 28 * Math.sin(3 * a) + 12 * Math.cos(5 * a);
          return { x: 280 + r * Math.cos(a), y: 280 + r * Math.sin(a) };
        }, 600),
        closed: true,
      },
    ],
    corners: [],
    ideal: 8,
  },
  {
    name: 'incrocio X',
    w: 500,
    h: 500,
    paths: [
      {
        pts: poly(
          [
            [60, 80],
            [440, 420],
          ],
          false,
        ),
        closed: false,
      },
      {
        pts: poly(
          [
            [440, 80],
            [60, 420],
          ],
          false,
        ),
        closed: false,
      },
    ],
    corners: [],
    ideal: 4,
  },
  aDietroLaCoda(),
];

const LEVELS: Record<
  Level,
  { passes: number; wobble: number; width: number; gap: number; dirt: boolean }
> = {
  facile: { passes: 1, wobble: 0.6, width: 3, gap: 0, dirt: false },
  normale: { passes: 3, wobble: 2.5, width: 4, gap: 0, dirt: false },
  difficile: { passes: 4, wobble: 4, width: 6, gap: 14, dirt: true },
};

function rng(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Disegna la figura a matita con i difetti del livello. */
export function sketch(fig: Figure, level: Level, seed = 1): RasterImage {
  const L = LEVELS[level];
  const img = paper(fig.w, fig.h);
  fig.paths.forEach((p, i) => {
    let pts = p.closed ? [...p.pts, p.pts[0]!] : p.pts;
    // la matita si ferma un soffio prima di chiudere la forma
    if (L.gap > 0 && p.closed) {
      let cut = 0;
      let k = pts.length - 1;
      while (k > 1 && cut < L.gap) {
        cut += Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y);
        k--;
      }
      pts = pts.slice(0, k + 1);
    }
    // linee aperte disegnate a mano: si fermano prima o vanno oltre di qualche px
    if (!p.closed && L.passes > 1 && pts.length > 4) {
      const r = rng(seed * 13 + i * 5 + 1);
      const fix = (atEnd: boolean) => {
        const d = (r() - 0.4) * 2 * (L.width + 4); // da −0,8 a +1,2 volte (spessore + 4 px)
        const e = atEnd ? pts[pts.length - 1]! : pts[0]!;
        const q = atEnd ? pts[pts.length - 4]! : pts[3]!;
        const l = Math.hypot(e.x - q.x, e.y - q.y) || 1;
        const np = { x: e.x + ((e.x - q.x) / l) * d, y: e.y + ((e.y - q.y) / l) * d };
        pts = atEnd ? [...pts.slice(0, -1), np] : [np, ...pts.slice(1)];
      };
      fix(false);
      fix(true);
    }
    pencil(img, pts, {
      passes: L.passes,
      wobble: L.wobble,
      width: L.width,
      seed: seed * 31 + i * 7,
    });
  });
  if (L.dirt) {
    const r = rng(seed * 97 + 3);
    const d = img.data;
    for (let y = 0; y < fig.h; y++)
      for (let x = 0; x < fig.w; x++) {
        const i = (y * fig.w + x) * 4;
        // luce non uniforme (ombra da un angolo) e grana della carta
        const shade = 45 * (x / fig.w) * (y / fig.h) + (r() - 0.5) * 14;
        for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, d[i + c]! - shade));
      }
    // puntini e sporco
    for (let k = 0; k < 60; k++) {
      const x = Math.floor(r() * (fig.w - 3));
      const y = Math.floor(r() * (fig.h - 3));
      for (let yy = 0; yy < 2; yy++)
        for (let xx = 0; xx < 2; xx++) {
          const i = ((y + yy) * fig.w + x + xx) * 4;
          d[i] = d[i + 1] = d[i + 2] = 90;
        }
    }
  }
  return img;
}

// --- misure -----------------------------------------------------------------------------------

function bez(s: Segment, t: number): Vec2 {
  if (s.kind === 'line')
    return { x: s.p0.x + (s.p1.x - s.p0.x) * t, y: s.p0.y + (s.p1.y - s.p0.y) * t };
  const u = 1 - t;
  return {
    x: u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p1.x,
    y: u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p1.y,
  };
}

export function samples(g: DocumentGeometry, step = 2): Vec2[] {
  const out: Vec2[] = [];
  for (const p of g.paths)
    for (const s of p.segments) {
      const chord =
        s.kind === 'line'
          ? Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y)
          : Math.hypot(s.c1.x - s.p0.x, s.c1.y - s.p0.y) +
            Math.hypot(s.c2.x - s.c1.x, s.c2.y - s.c1.y) +
            Math.hypot(s.p1.x - s.c2.x, s.p1.y - s.c2.y);
      const n = Math.max(8, Math.ceil(chord / step));
      for (let k = 0; k < n; k++) out.push(bez(s, k / n));
    }
  return out;
}

/** Distanza minima da un insieme di punti (griglia per velocità). */
function nearest(points: Vec2[], cell = 8) {
  const grid = new Map<string, Vec2[]>();
  for (const p of points) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(p);
  }
  return (q: Vec2): number => {
    const gx = Math.floor(q.x / cell);
    const gy = Math.floor(q.y / cell);
    let best = Infinity;
    for (let r = 0; r < 64 && best > (r - 1) * cell; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const p of grid.get(`${gx + dx},${gy + dy}`) ?? [])
            best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
        }
    return best;
  };
}

export interface Score {
  paths: number;
  expectedPaths: number;
  anchors: number;
  ideal: number;
  /** Scarto medio e massimo del ricalco dalla forma vera (px). */
  meanDev: number;
  maxDev: number;
  /** Parte della forma vera lontana più di 2× lo spessore dal ricalco (pezzi mancanti), 0–1. */
  missing: number;
  /** Distanza media degli spigoli veri dall'anchor più vicino (px); NaN se la figura non ne ha. */
  cornerErr: number;
  /** Forme chiuse orientate bene (esterne orarie, buchi antiorari), 0–1. */
  oriented: number;
}

export function score(g: DocumentGeometry, fig: Figure, width: number): Score {
  const truth = fig.paths.flatMap((p) => p.pts);
  const traced = samples(g);
  const toTruth = nearest(truth, 8);
  const toTraced = nearest(traced.length ? traced : [{ x: -1e6, y: -1e6 }], 8);
  let sum = 0;
  let max = 0;
  for (const q of traced) {
    const d = toTruth(q);
    sum += d;
    max = Math.max(max, d);
  }
  let miss = 0;
  for (const q of truth) {
    const d = toTraced(q);
    max = Math.max(max, d);
    if (d > 2 * width) miss++;
  }
  const anchors: Vec2[] = g.paths.flatMap((p) => [
    ...p.segments.map((s) => s.p0),
    ...(p.closed || !p.segments.length ? [] : [p.segments[p.segments.length - 1]!.p1]),
  ]);
  const cornerErr = fig.corners.length
    ? fig.corners.reduce(
        (a, c) => a + Math.min(...anchors.map((p) => Math.hypot(p.x - c.x, p.y - c.y))),
        0,
      ) / fig.corners.length
    : NaN;
  // verso: area > 0 (y in giù) = orario; i buchi (contenuti in un'altra forma) antiorari
  const closed = g.paths.filter((p) => p.closed);
  let ok = 0;
  for (const p of closed) {
    const pts = p.segments.flatMap((s) => [bez(s, 0), bez(s, 0.5)]);
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const u = pts[i]!;
      const v = pts[(i + 1) % pts.length]!;
      a += u.x * v.y - v.x * u.y;
    }
    const c = pts[0]!;
    const isHole = closed.some((o) => o !== p && insidePath(c, o));
    if (isHole ? a < 0 : a > 0) ok++;
  }
  return {
    paths: g.paths.length,
    expectedPaths: fig.paths.length,
    anchors: anchors.length,
    ideal: fig.ideal,
    meanDev: traced.length ? sum / traced.length : Infinity,
    maxDev: max,
    missing: miss / truth.length,
    cornerErr,
    oriented: closed.length ? ok / closed.length : 1,
  };
}

function insidePath(p: Vec2, path: DocumentGeometry['paths'][number]): boolean {
  const poly = path.segments.flatMap((s) => Array.from({ length: 8 }, (_, k) => bez(s, k / 8)));
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export const LEVEL_WIDTH: Record<Level, number> = { facile: 3, normale: 4, difficile: 6 };
