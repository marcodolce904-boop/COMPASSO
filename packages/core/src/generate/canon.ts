// GENERA canonico (docs/GENERA.md §0): il logo diventa una COSTRUZIONE (rette, archi di cerchio,
// raccordi) e un risolutore a vincoli gli impone la regola scelta su tutto insieme: raggi, angoli,
// posizioni. I raccordi che erano lisci restano tangenti, così il risultato è continuo. Il logo può
// cambiare anche molto: conta la correttezza della regola, non la somiglianza con l'originale.

import type { Circle, PathData, Segment, Vec2 } from '../model';
import { arcSpline } from '../fit/arcspline';
import { freeRuns } from '../fit/freecurves';
import { sampleSegment, segmentLength } from '../math';

// ---------------------------------------------------------------------------------------------
// Costruzione

interface Ctr {
  c: Vec2;
  r: number;
  /** Cerchio intero del logo (un tracciato chiuso fatto solo di questo cerchio). */
  full?: boolean;
  /** Raggio imposto dalla regola (aggiornato dal risolutore solo per le regole relative). */
  target: number;
}
type El =
  | { kind: 'line'; a: number; b: number; angle?: number }
  | { kind: 'arc'; a: number; b: number; c: number; dir: 1 | -1; sweep0?: number }
  | { kind: 'free'; a: number; b: number; seg: Extract<Segment, { kind: 'cubic' }> };
interface CPath {
  src: PathData;
  closed: boolean;
  els: El[];
  /** smooth[i]: il raccordo all'inizio di els[i] (tra els[i-1] ed els[i]) era liscio. */
  smooth: boolean[];
}
export interface Construction {
  vtx: Vec2[];
  /** Posizioni di partenza dei vertici (richiamo debole alla forma originale). */
  orig: Vec2[];
  ctr: Ctr[];
  paths: CPath[];
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
const len = (a: Vec2) => Math.hypot(a.x, a.y);
const unit = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < 1e-12 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
};

/** Ampiezza dell'arco da A a B intorno a C nel verso `dir`, in (0, 2π]. */
function sweepOf(C: Vec2, A: Vec2, B: Vec2, dir: 1 | -1): number {
  const a0 = Math.atan2(A.y - C.y, A.x - C.x);
  const a1 = Math.atan2(B.y - C.y, B.x - C.x);
  let s = (a1 - a0) * dir;
  while (s <= 1e-9) s += 2 * Math.PI;
  while (s > 2 * Math.PI) s -= 2 * Math.PI;
  return s;
}

function midOf(s: Segment): Vec2 {
  if (s.kind === 'line') return mul(add(s.p0, s.p1), 0.5);
  return {
    x: 0.125 * s.p0.x + 0.375 * s.c1.x + 0.375 * s.c2.x + 0.125 * s.p1.x,
    y: 0.125 * s.p0.y + 0.375 * s.c1.y + 0.375 * s.c2.y + 0.125 * s.p1.y,
  };
}

/** Tangente (verso di percorrenza) di un elemento all'inizio o alla fine. */
function tangentOf(k: Construction, e: El, atStart: boolean): Vec2 {
  const A = k.vtx[e.a]!;
  const B = k.vtx[e.b]!;
  if (e.kind === 'line') return unit(sub(B, A));
  if (e.kind === 'free') {
    const s = e.seg;
    return atStart ? unit(sub(s.c1, s.p0)) : unit(sub(s.p1, s.c2));
  }
  const C = k.ctr[e.c]!.c;
  const P = atStart ? A : B;
  const r = sub(P, C);
  return unit(e.dir > 0 ? { x: -r.y, y: r.x } : { x: r.y, y: -r.x });
}

/**
 * Trasforma i tracciati (normalizzati) in costruzione. `circles` = cerchi veri dell'analisi: i loro
 * tratti diventano archi di quel cerchio (stesso centro condiviso). Le curve libere diventano catene
 * di archi tangenti (`arcTol`); quelle che non si lasciano spiegare restano «libere».
 */
export function toConstruction(
  paths: PathData[],
  circles: Circle[],
  D: number,
  arcTol: number,
): Construction {
  const k: Construction = { vtx: [], orig: [], ctr: [], paths: [] };
  const circleOf = new Map<string, number>();
  for (const c of circles) {
    const ci = k.ctr.length;
    const ids = new Set(c.refs.map((r) => r.pathId));
    const only = ids.size === 1 ? paths.find((p) => p.id === [...ids][0]) : undefined;
    const full = !!only && only.closed && c.refs.length === only.segments.length;
    k.ctr.push({ c: { x: c.cx, y: c.cy }, r: c.r, target: c.r, full });
    for (const r of c.refs) circleOf.set(`${r.pathId}:${r.index}`, ci);
  }
  for (const p of paths) {
    const segs = p.segments;
    if (!segs.length) continue;
    // archi delle curve libere, per primo tratto della catena
    const covered = new Set<string>(circleOf.keys());
    segs.forEach((s, i) => {
      if (s.kind === 'line') covered.add(`${p.id}:${i}`);
    });
    const chains = new Map<
      number,
      { arcs: { c: Vec2; r: number; to: Vec2; dir: 1 | -1 }[]; run: number[] }
    >();
    const inChain = new Set<number>();
    for (const run of freeRuns(p, covered)) {
      const pts: Vec2[] = [];
      run.forEach((i, j) => {
        const s = segs[i]!;
        const sm = sampleSegment(s, Math.max(8, Math.ceil(segmentLength(s) / (D / 400))));
        pts.push(...(j === 0 ? sm : sm.slice(1)));
      });
      const arcs = arcSpline(pts, arcTol, Math.min(10, 4 * run.length));
      if (!arcs || arcs.some((a) => a.r > 5 * D)) continue;
      chains.set(run[0]!, {
        run,
        arcs: arcs.map((a) => {
          const mid = pts[Math.floor((a.i0 + a.i1) / 2)]!;
          const c = { x: a.cx, y: a.cy };
          return { c, r: a.r, to: a.to, dir: cross(sub(a.from, c), sub(mid, c)) >= 0 ? 1 : -1 };
        }),
      });
      for (const i of run) inChain.add(i);
    }
    // elementi, in ordine di percorrenza (una catena può iniziare a metà di un tracciato chiuso)
    const els: El[] = [];
    const vStart = k.vtx.length;
    const order: number[] = [];
    if (p.closed) {
      let start = 0;
      for (const [first, ch] of chains) if (ch.run[ch.run.length - 1]! < first) start = first;
      for (let j = 0; j < segs.length; j++) order.push((start + j) % segs.length);
    } else for (let j = 0; j < segs.length; j++) order.push(j);
    let lastCtr = -1;
    for (const i of order) {
      const s = segs[i]!;
      const ch = chains.get(i);
      if (inChain.has(i) && !ch) continue; // coperto dalla catena che parte prima
      const a = k.vtx.length;
      k.vtx.push({ ...s.p0 });
      if (ch) {
        ch.arcs.forEach((arc, j) => {
          const ci = k.ctr.length;
          k.ctr.push({ c: arc.c, r: arc.r, target: arc.r });
          if (j > 0) k.vtx.push({ ...ch.arcs[j - 1]!.to });
          els.push({ kind: 'arc', a: k.vtx.length - 1, b: -1, c: ci, dir: arc.dir });
        });
        lastCtr = -1;
        continue;
      }
      const ci = circleOf.get(`${p.id}:${i}`);
      if (ci !== undefined) {
        const C = k.ctr[ci]!.c;
        const dir: 1 | -1 = cross(sub(s.p0, C), sub(midOf(s), C)) >= 0 ? 1 : -1;
        const prev = els[els.length - 1];
        // tratti consecutivi dello stesso cerchio → un arco solo
        if (prev && prev.kind === 'arc' && lastCtr === ci && prev.dir === dir) {
          k.vtx.pop();
          continue;
        }
        els.push({ kind: 'arc', a, b: -1, c: ci, dir });
        lastCtr = ci;
        continue;
      }
      lastCtr = -1;
      if (s.kind === 'line') els.push({ kind: 'line', a, b: -1 });
      else els.push({ kind: 'free', a, b: -1, seg: s });
    }
    // estremi: ogni elemento finisce dove inizia il successivo
    for (let j = 0; j < els.length; j++) {
      const nxt = els[j + 1];
      if (nxt) els[j]!.b = nxt.a;
      else if (p.closed) els[j]!.b = els[0]!.a;
      else {
        k.vtx.push({ ...segs[segs.length - 1]!.p1 });
        els[j]!.b = k.vtx.length - 1;
      }
    }
    void vStart;
    for (const e of els)
      if (e.kind === 'arc') e.sweep0 = sweepOf(k.ctr[e.c]!.c, k.vtx[e.a]!, k.vtx[e.b]!, e.dir);
    const cp: CPath = { src: p, closed: p.closed, els, smooth: [] };
    // raccordi lisci all'inizio di ogni elemento (entro 25°: l'approssimazione ad archi sposta un po' le
    // tangenti; gli spigoli veri di un logo sono molto più netti)
    cp.smooth = els.map((e, j) => {
      const prev = j > 0 ? els[j - 1] : p.closed ? els[els.length - 1] : undefined;
      if (!prev) return false;
      const u = tangentOf(k, prev, false);
      const v = tangentOf(k, e, true);
      return dot(u, v) > Math.cos((25 * Math.PI) / 180);
    });
    k.paths.push(cp);
  }
  k.orig = k.vtx.map((v) => ({ ...v }));
  return k;
}

// ---------------------------------------------------------------------------------------------
// Regole

export interface CanonRules {
  /** Raggio imposto a partire da quello attuale (null = libero). */
  radius?: (r: number) => number;
  /** Angolo imposto a una retta (radianti, in [0, π)); null = libero. */
  angle?: (theta: number) => number | null;
  /** Posizione imposta a un centro di cerchio (null = libero); `full` = cerchio intero del logo. */
  center?: (c: Vec2, full: boolean) => Vec2 | null;
  /** Coordinata imposta a una retta orizzontale (y) o verticale (x) (null = libera). */
  axisLine?: (v: number, vertical: boolean) => number | null;
  /** Posizione imposta a uno spigolo (anchor non liscio tra due rette o curve) (null = libero). */
  corner?: (p: Vec2) => Vec2 | null;
}

const lineAngle = (a: Vec2, b: Vec2) => {
  let t = Math.atan2(b.y - a.y, b.x - a.x);
  if (t < 0) t += Math.PI;
  if (t >= Math.PI) t -= Math.PI;
  return t;
};

/** Risolutore: proiezioni ripetute dei vincoli (raggi, raccordi tangenti, angoli, griglie). */
export function solve(k: Construction, rules: CanonRules, iterations = 400): void {
  for (const c of k.ctr) if (rules.radius) c.target = Math.max(1e-6, rules.radius(c.r));
  // bersagli fissi delle rette: angolo e (per le orizzontali/verticali) posizione
  const lineTargets = new Map<El, { angle: number | null; pos: number | null }>();
  for (const p of k.paths)
    for (const e of p.els) {
      if (e.kind !== 'line') continue;
      const A = k.vtx[e.a]!;
      const B = k.vtx[e.b]!;
      const th = lineAngle(A, B);
      const angle = rules.angle ? rules.angle(th) : null;
      let pos: number | null = null;
      if (angle !== null && rules.axisLine) {
        const vertical = Math.abs(angle - Math.PI / 2) < 1e-9;
        const horizontal = Math.abs(angle) < 1e-9 || Math.abs(angle - Math.PI) < 1e-9;
        if (vertical) pos = rules.axisLine((A.x + B.x) / 2, true);
        else if (horizontal) pos = rules.axisLine((A.y + B.y) / 2, false);
      }
      lineTargets.set(e, { angle, pos });
    }
  // bordi paralleli vicini della stessa forma (es. i due lati di uno stelo): si muovono insieme, il
  // centro del tratto va sulla griglia e lo spessore resta
  if (rules.axisLine)
    for (const p of k.paths) {
      const ls = p.els.filter(
        (e): e is Extract<El, { kind: 'line' }> =>
          e.kind === 'line' && lineTargets.get(e)?.pos != null,
      );
      const used = new Set<El>();
      for (const a of ls)
        for (const b of ls) {
          if (a === b || used.has(a) || used.has(b)) continue;
          const ta = lineTargets.get(a)!;
          const tb = lineTargets.get(b)!;
          if (Math.abs((ta.angle ?? 0) - (tb.angle ?? 0)) > 1e-9) continue;
          const vertical = Math.abs((ta.angle ?? 0) - Math.PI / 2) < 1e-9;
          const coord = (e: El) => {
            const A = k.vtx[e.a]!;
            const B = k.vtx[e.b]!;
            return vertical ? (A.x + B.x) / 2 : (A.y + B.y) / 2;
          };
          const span = (e: El) => {
            const A = k.vtx[e.a]!;
            const B = k.vtx[e.b]!;
            return vertical
              ? [Math.min(A.y, B.y), Math.max(A.y, B.y)]
              : [Math.min(A.x, B.x), Math.max(A.x, B.x)];
          };
          const [a0, a1] = span(a);
          const [b0, b1] = span(b);
          const overlap = Math.min(a1!, b1!) - Math.max(a0!, b0!);
          const w = Math.abs(coord(a) - coord(b));
          if (
            overlap < 0.5 * Math.min(a1! - a0!, b1! - b0!) ||
            w > 0.25 * Math.max(a1! - a0!, b1! - b0!)
          )
            continue;
          const mid = (coord(a) + coord(b)) / 2;
          const sm = rules.axisLine(mid, vertical) ?? mid;
          const sa = coord(a) < coord(b) ? -1 : 1;
          ta.pos = sm + (sa * w) / 2;
          tb.pos = sm - (sa * w) / 2;
          used.add(a);
          used.add(b);
        }
    }
  const centerTargets = k.ctr.map((c) => (rules.center ? rules.center(c.c, !!c.full) : null));
  // spigoli: vertici non lisci
  const cornerTargets = new Map<number, Vec2>();
  if (rules.corner)
    for (const p of k.paths)
      p.els.forEach((e, j) => {
        if (p.smooth[j]) return;
        // spigoli tra due rette: stanno dove le rette si incontrano (le rette hanno già la regola)
        const prev = j > 0 ? p.els[j - 1] : p.closed ? p.els[p.els.length - 1] : undefined;
        if (e.kind === 'line' || prev?.kind === 'line') return;
        const t = rules.corner!(k.vtx[e.a]!);
        if (t) cornerTargets.set(e.a, t);
      });

  const moveV = (i: number, d: Vec2, w: number) => {
    const v = k.vtx[i]!;
    v.x += d.x * w;
    v.y += d.y * w;
  };
  for (let it = 0; it < iterations; it++) {
    const pull = it < iterations * 0.7 ? 0.25 : 1; // bersagli di posizione: morbidi, poi rigidi
    // richiamo debole alla forma di partenza: tra le soluzioni che rispettano le regole, quella più
    // coerente con il disegno (si spegne alla fine, così le regole restano esatte)
    if (it < iterations * 0.7)
      k.vtx.forEach((v, i) => {
        const o = k.orig[i]!;
        v.x += (o.x - v.x) * 0.06;
        v.y += (o.y - v.y) * 0.06;
      });
    // centri sulla griglia
    k.ctr.forEach((c, i) => {
      const t = centerTargets[i];
      if (t) c.c = add(c.c, mul(sub(t, c.c), pull));
    });
    // spigoli sulla griglia
    for (const [i, t] of cornerTargets) moveV(i, sub(t, k.vtx[i]!), pull);
    for (const p of k.paths) {
      for (const e of p.els) {
        if (e.kind === 'line') {
          const tg = lineTargets.get(e)!;
          const A = k.vtx[e.a]!;
          const B = k.vtx[e.b]!;
          if (tg.angle !== null) {
            const m = mul(add(A, B), 0.5);
            const L = len(sub(B, A)) / 2;
            let d = { x: Math.cos(tg.angle), y: Math.sin(tg.angle) };
            if (dot(d, sub(B, A)) < 0) d = mul(d, -1);
            const nA = sub(m, mul(d, L));
            const nB = add(m, mul(d, L));
            moveV(e.a, sub(nA, A), 0.5);
            moveV(e.b, sub(nB, B), 0.5);
          }
          if (tg.pos !== null) {
            const vertical = tg.angle !== null && Math.abs(tg.angle - Math.PI / 2) < 1e-9;
            for (const i of [e.a, e.b]) {
              const v = k.vtx[i]!;
              if (vertical) v.x += (tg.pos - v.x) * pull;
              else v.y += (tg.pos - v.y) * pull;
            }
          }
        } else if (e.kind === 'arc') {
          // raggio: gli estremi stanno sul cerchio di raggio imposto
          const c = k.ctr[e.c]!;
          for (const i of [e.a, e.b]) {
            const v = k.vtx[i]!;
            const d = sub(v, c.c);
            const l = len(d) || 1e-9;
            const err = l - c.target;
            const u = mul(d, 1 / l);
            moveV(i, mul(u, -err), 0.6);
            c.c = add(c.c, mul(u, err * 0.4));
          }
        }
      }
      // raccordi lisci: tangenza
      p.els.forEach((e, j) => {
        if (!p.smooth[j]) return;
        const prev = j > 0 ? p.els[j - 1]! : p.els[p.els.length - 1]!;
        const V = e.a;
        const P = k.vtx[V]!;
        const lineArc = (line: El, arc: Extract<El, { kind: 'arc' }>) => {
          const A = k.vtx[line.a]!;
          const B = k.vtx[line.b]!;
          const u = unit(sub(B, A));
          const c = k.ctr[arc.c]!;
          const err = dot(sub(c.c, P), u); // il raggio nel punto di raccordo è perpendicolare alla retta
          c.c = sub(c.c, mul(u, err * 0.5));
          moveV(V, mul(u, err * 0.5), 1);
        };
        if (prev.kind === 'line' && e.kind === 'arc') lineArc(prev, e);
        else if (prev.kind === 'arc' && e.kind === 'line') lineArc(e, prev);
        else if (prev.kind === 'arc' && e.kind === 'arc' && prev.c !== e.c) {
          // il punto di raccordo sta sulla retta dei due centri
          const c1 = k.ctr[prev.c]!.c;
          const c2 = k.ctr[e.c]!.c;
          const d = unit(sub(c2, c1));
          const proj = add(c1, mul(d, dot(sub(P, c1), d)));
          moveV(V, sub(proj, P), 0.5);
        }
      });
    }
  }
}

/**
 * Rifinitura finale: ogni arco torna un arco ESATTO del suo raggio (centro ricalcolato sui due
 * estremi, dalla parte del centro attuale); ogni retta con angolo imposto viene raddrizzata.
 */
export function finalize(k: Construction, rules: CanonRules): void {
  for (const p of k.paths)
    for (const e of p.els) {
      if (e.kind !== 'arc') continue;
      const c = k.ctr[e.c]!;
      const A = k.vtx[e.a]!;
      const B = k.vtx[e.b]!;
      const m = mul(add(A, B), 0.5);
      const half = len(sub(B, A)) / 2;
      if (half < 1e-9) continue;
      if (half > c.target) {
        // corda più lunga del diametro: il raggio più piccolo ammesso dalla regola che la contiene
        let r = half;
        for (let i = 0; i < 80; i++) {
          const q = rules.radius ? rules.radius(r) : r;
          if (q >= half - 1e-9) {
            r = q;
            break;
          }
          r *= 1.03;
        }
        c.target = Math.max(r, half);
      }
      const h = Math.sqrt(Math.max(0, c.target * c.target - half * half));
      const n = unit({ x: -(B.y - A.y), y: B.x - A.x });
      const c1 = add(m, mul(n, h));
      const c2 = sub(m, mul(n, h));
      // un centro condiviso da più archi (cerchio intero) resta il suo
      const shared = p.els.filter((x) => x.kind === 'arc' && x.c === e.c).length > 1;
      if (!shared) {
        // tra i due centri possibili, quello che dà un arco della stessa «specie» dell'originale
        // (arco corto o lungo): mai un bozzo che gira dalla parte sbagliata
        const s0 = e.sweep0 ?? sweepOf(c.c, A, B, e.dir);
        const d1 = Math.abs(sweepOf(c1, A, B, e.dir) - s0);
        const d2 = Math.abs(sweepOf(c2, A, B, e.dir) - s0);
        c.c = d1 <= d2 ? c1 : c2;
      }
    }
}

// ---------------------------------------------------------------------------------------------
// Ritorno ai tracciati

function arcCubics(C: Vec2, r: number, A: Vec2, B: Vec2, dir: 1 | -1): Segment[] {
  const a0 = Math.atan2(A.y - C.y, A.x - C.x);
  let a1 = Math.atan2(B.y - C.y, B.x - C.x);
  // ampiezza nel verso dell'arco, in (0, 2π]
  let sweep = (a1 - a0) * dir;
  while (sweep <= 1e-9) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
  a1 = a0 + sweep * dir;
  const n = Math.max(1, Math.ceil(sweep / (Math.PI / 2) - 1e-9));
  const step = (a1 - a0) / n;
  const h = (4 / 3) * Math.tan(step / 4);
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * step;
    const t1 = t0 + step;
    const p0 = i === 0 ? A : { x: C.x + r * Math.cos(t0), y: C.y + r * Math.sin(t0) };
    const p1 = i === n - 1 ? B : { x: C.x + r * Math.cos(t1), y: C.y + r * Math.sin(t1) };
    out.push({
      kind: 'cubic',
      p0,
      c1: { x: p0.x - h * r * Math.sin(t0), y: p0.y + h * r * Math.cos(t0) },
      c2: { x: p1.x + h * r * Math.sin(t1), y: p1.y - h * r * Math.cos(t1) },
      p1,
    });
  }
  return out;
}

export function fromConstruction(k: Construction): PathData[] {
  return k.paths.map((p) => {
    const segments: Segment[] = [];
    for (const e of p.els) {
      const A = { ...k.vtx[e.a]! };
      const B = { ...k.vtx[e.b]! };
      if (e.kind === 'line') segments.push({ kind: 'line', p0: A, p1: B });
      else if (e.kind === 'free') {
        const s = e.seg;
        const dA = sub(A, s.p0);
        const dB = sub(B, s.p1);
        segments.push({ kind: 'cubic', p0: A, c1: add(s.c1, dA), c2: add(s.c2, dB), p1: B });
      } else {
        const c = k.ctr[e.c]!;
        segments.push(...arcCubics(c.c, c.target, A, B, e.dir));
      }
    }
    return { ...p.src, segments };
  });
}

/** Raggi della costruzione (per riepilogo e guide). */
export function constructionCircles(k: Construction): { cx: number; cy: number; r: number }[] {
  const used = new Set<number>();
  for (const p of k.paths) for (const e of p.els) if (e.kind === 'arc') used.add(e.c);
  return [...used]
    .sort((a, b) => a - b)
    .map((i) => ({ cx: k.ctr[i]!.c.x, cy: k.ctr[i]!.c.y, r: k.ctr[i]!.target }));
}

export function lineAngles(k: Construction): number[] {
  const out: number[] = [];
  for (const p of k.paths)
    for (const e of p.els) if (e.kind === 'line') out.push(lineAngle(k.vtx[e.a]!, k.vtx[e.b]!));
  return out;
}
