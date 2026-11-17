// Linea centrale dei tratti: assottigliamento di Zhang–Suen e grafo delle linee
// (estremi, incroci, anelli). Ogni tratto diventa una polilinea di centri di pixel.

import type { Vec2 } from '../model';
import type { Mask } from './raster';

/** Assottigliamento di Zhang–Suen: lo scheletro largo 1 pixel della maschera. */
export function thin(m: Mask): Mask {
  const { width: w, height: h } = m;
  const d = m.data.slice();
  // il bordo dell'immagine resta vuoto (i vicini fuori immagine contano come carta)
  for (let x = 0; x < w; x++) d[x] = d[(h - 1) * w + x] = 0;
  for (let y = 0; y < h; y++) d[y * w] = d[y * w + w - 1] = 0;
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!d[i]) continue;
          const p2 = d[i - w]!,
            p3 = d[i - w + 1]!,
            p4 = d[i + 1]!,
            p5 = d[i + w + 1]!,
            p6 = d[i + w]!,
            p7 = d[i + w - 1]!,
            p8 = d[i - 1]!,
            p9 = d[i - w - 1]!;
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
          if (a !== 1) continue;
          if (
            step === 0
              ? p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0
              : p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0
          )
            continue;
          del.push(i);
        }
      }
      if (del.length) changed = true;
      for (const i of del) d[i] = 0;
    }
  }
  return { width: w, height: h, data: d };
}

const NB = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;

export interface Stroke {
  points: Vec2[];
  closed: boolean;
}

interface Edge {
  a: number; // nodo (cluster di incrocio/estremo) o -1 per anelli
  b: number;
  pts: Vec2[];
  dead?: boolean;
}

/**
 * Scheletro → tratti. Estremi (1 vicino) e incroci (≥ 3 rami) sono nodi; i rami tra i nodi
 * sono tratti; gli anelli senza nodi sono tratti chiusi. Rametti corti attaccati a un estremo
 * (`spur` pixel) sono rumore dell'assottigliamento e si tolgono. Agli incroci a 4 rami si
 * uniscono i rami che proseguono dritti, così una linea che passa sopra un'altra resta intera.
 */
export function strokes(sk: Mask, spur: number, tip = spur * 3): Stroke[] {
  const { width: w, height: h, data } = sk;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1;
  // grafo dei pixel: 8-vicini, senza le diagonali "di troppo" dei gradini (se due pixel in
  // diagonale hanno un 4-vicino in comune, passano da lì). Così una linea ha vicini 2 a 2.
  const neighbors = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    const out: number[] = [];
    for (const [dx, dy] of NB) {
      if (!on(x + dx, y + dy)) continue;
      if (dx !== 0 && dy !== 0 && (on(x + dx, y) || on(x, y + dy))) continue;
      out.push((y + dy) * w + x + dx);
    }
    return out;
  };
  const nbCache = new Map<number, number[]>();
  const nbs = (i: number) => {
    let v = nbCache.get(i);
    if (!v) nbCache.set(i, (v = neighbors(i)));
    return v;
  };
  const isNode = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (data[i] && nbs(i).length !== 2) isNode[i] = 1;
  // nodi adiacenti = un solo nodo (cluster)
  const nodeOf = new Int32Array(w * h).fill(-1);
  const nodeCenter: Vec2[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!isNode[s] || nodeOf[s]! >= 0) continue;
    const id = nodeCenter.length;
    const stack = [s];
    nodeOf[s] = id;
    let sx = 0,
      sy = 0,
      c = 0;
    while (stack.length) {
      const i = stack.pop()!;
      sx += i % w;
      sy += Math.floor(i / w);
      c++;
      for (const j of nbs(i))
        if (isNode[j] && nodeOf[j]! < 0) {
          nodeOf[j] = id;
          stack.push(j);
        }
    }
    nodeCenter.push({ x: sx / c + 0.5, y: sy / c + 0.5 });
  }
  const P = (i: number): Vec2 => ({ x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });
  const visited = new Uint8Array(w * h);
  const edges: Edge[] = [];
  // catene di pixel con 2 vicini tra due nodi: il percorso è unico
  for (let i = 0; i < w * h; i++) {
    if (!isNode[i]) continue;
    for (const first of nbs(i)) {
      if (isNode[first] || visited[first]) continue;
      const pts: Vec2[] = [nodeCenter[nodeOf[i]!]!];
      let prev = i;
      let cur = first;
      let end = -2;
      for (;;) {
        if (isNode[cur]) {
          end = nodeOf[cur]!;
          pts.push(nodeCenter[end]!);
          break;
        }
        if (visited[cur]) break;
        visited[cur] = 1;
        pts.push(P(cur));
        const next = nbs(cur).find((j) => j !== prev);
        if (next === undefined) break;
        prev = cur;
        cur = next;
      }
      edges.push({ a: nodeOf[i]!, b: end, pts });
    }
  }
  // anelli senza nodi
  for (let i = 0; i < w * h; i++) {
    if (!data[i] || isNode[i] || visited[i]) continue;
    const pts: Vec2[] = [];
    let prev = -1;
    let cur = i;
    while (!visited[cur]) {
      visited[cur] = 1;
      pts.push(P(cur));
      const next = nbs(cur).find((j) => j !== prev);
      if (next === undefined) break;
      prev = cur;
      cur = next;
    }
    if (pts.length >= 8) edges.push({ a: -1, b: -1, pts });
  }

  // rametti: rami corti con un estremo libero
  const degree = () => {
    const deg = new Array(nodeCenter.length).fill(0);
    for (const e of edges) {
      if (e.dead || e.a < 0) continue;
      deg[e.a]!++;
      if (e.b >= 0) deg[e.b]++;
    }
    return deg as number[];
  };
  // punte acute: a un incrocio a 3 rami arriva un rametto corto e libero tra due lati a V.
  // La V è uno spigolo vivo e il rametto ne è la punta: i due lati si uniscono passando
  // per la sua estremità (invece di tagliare la punta).
  {
    const dirFrom = (pts: Vec2[], fromStart: boolean): Vec2 => {
      const n = pts.length;
      const k = Math.min(n - 1, Math.max(3, spur));
      const p = fromStart ? pts[0]! : pts[n - 1]!;
      const q = fromStart ? pts[k]! : pts[n - 1 - k]!;
      const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
    };
    const deg = degree();
    for (let node = 0; node < nodeCenter.length; node++) {
      if (deg[node] !== 3) continue;
      const inc: { e: Edge; atStart: boolean }[] = [];
      for (const e of edges) {
        if (e.dead || e.a < 0) continue;
        if (e.a === node) inc.push({ e, atStart: true });
        if (e.b === node) inc.push({ e, atStart: false });
      }
      if (inc.length !== 3 || new Set(inc.map((x) => x.e)).size !== 3) continue;
      const free = (x: { e: Edge; atStart: boolean }) => {
        const other = x.atStart ? x.e.b : x.e.a;
        return other < 0 || deg[other] === 1;
      };
      const spurs = inc.filter((x) => free(x) && x.e.pts.length <= tip);
      if (spurs.length !== 1) continue;
      const S = spurs[0]!;
      const [A, B] = inc.filter((x) => x !== S) as [typeof S, typeof S];
      const da = dirFrom(A.e.pts, A.atStart);
      const db = dirFrom(B.e.pts, B.atStart);
      const ds = dirFrom(S.e.pts, S.atStart);
      const vee = da.x * db.x + da.y * db.y; // > −0,5: angolo della V sotto i 120°
      const away = ds.x * (da.x + db.x) + ds.y * (da.y + db.y); // la punta sta fuori dalla V
      if (vee <= -0.5 || away >= 0) continue;
      const tipPt = S.atStart ? S.e.pts[S.e.pts.length - 1]! : S.e.pts[0]!;
      const aPts = A.atStart ? [...A.e.pts].reverse() : A.e.pts;
      const bPts = B.atStart ? B.e.pts : [...B.e.pts].reverse();
      const joined: Edge = {
        a: A.atStart ? A.e.b : A.e.a,
        b: B.atStart ? B.e.b : B.e.a,
        pts: [...aPts.slice(0, -1), tipPt, ...bPts.slice(1)],
      };
      A.e.dead = B.e.dead = S.e.dead = true;
      edges.push(joined);
      deg[node] = 0;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const deg = degree();
    for (const e of edges) {
      if (e.dead || e.a < 0) continue;
      const len = e.pts.length;
      const freeEnd = deg[e.a] === 1 || e.b < 0 || deg[e.b] === 1;
      const attached = (deg[e.a] ?? 0) >= 3 || (e.b >= 0 && (deg[e.b] ?? 0) >= 3);
      if (freeEnd && attached && len < spur) e.dead = true;
    }
  }
  // tratti isolati brevissimi
  for (const e of edges) if (!e.dead && e.pts.length < 3) e.dead = true;

  // unione attraverso i nodi: grado 2 sempre; grado 4 per coppie che proseguono dritte
  const dirAt = (e: Edge, atStart: boolean): Vec2 => {
    const pts = e.pts;
    const k = Math.min(pts.length - 1, Math.max(3, spur));
    const p = atStart ? pts[0]! : pts[pts.length - 1]!;
    const q = atStart ? pts[k]! : pts[pts.length - 1 - k]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  };
  let merged = true;
  while (merged) {
    merged = false;
    const deg = degree();
    for (let node = 0; node < nodeCenter.length && !merged; node++) {
      const inc: { e: Edge; atStart: boolean }[] = [];
      for (const e of edges) {
        if (e.dead || e.a < 0) continue;
        if (e.a === node) inc.push({ e, atStart: true });
        if (e.b === node) inc.push({ e, atStart: false });
      }
      if (deg[node] !== inc.length) continue;
      let pair: [number, number] | null = null;
      if (inc.length === 2 && inc[0]!.e !== inc[1]!.e) pair = [0, 1];
      else if (inc.length === 4 || inc.length === 3) {
        // la coppia più dritta (direzioni uscenti opposte), se entro 35°
        let best = -0.82;
        for (let i = 0; i < inc.length; i++)
          for (let j = i + 1; j < inc.length; j++) {
            if (inc[i]!.e === inc[j]!.e) continue;
            const a = dirAt(inc[i]!.e, inc[i]!.atStart);
            const b = dirAt(inc[j]!.e, inc[j]!.atStart);
            const dot = a.x * b.x + a.y * b.y;
            if (dot < best) {
              best = dot;
              pair = [i, j];
            }
          }
      }
      if (!pair) continue;
      const A = inc[pair[0]]!;
      const B = inc[pair[1]]!;
      // A termina nel nodo, B parte dal nodo
      const aPts = A.atStart ? [...A.e.pts].reverse() : A.e.pts;
      const aOther = A.atStart ? A.e.b : A.e.a;
      const bPts = B.atStart ? B.e.pts : [...B.e.pts].reverse();
      const bOther = B.atStart ? B.e.b : B.e.a;
      const joined: Edge = { a: aOther, b: bOther, pts: [...aPts, ...bPts.slice(1)] };
      A.e.dead = true;
      B.e.dead = true;
      if (inc.length !== 2) {
        // l'incrocio resta per gli altri rami: il tratto unito ci passa attraverso
        joined.a = aOther;
        joined.b = bOther;
      }
      edges.push(joined);
      merged = true;
    }
  }

  const out: Stroke[] = [];
  const deg = degree();
  for (const e of edges) {
    if (e.dead) continue;
    const closed =
      e.a === -1 ||
      (e.a >= 0 && e.a === e.b && deg[e.a] === 2) ||
      (e.pts.length > 4 &&
        Math.hypot(
          e.pts[0]!.x - e.pts[e.pts.length - 1]!.x,
          e.pts[0]!.y - e.pts[e.pts.length - 1]!.y,
        ) < 1.5 &&
        e.a === e.b);
    const pts = closed && e.a >= 0 ? e.pts.slice(0, -1) : e.pts;
    if (pts.length >= 2) out.push({ points: pts, closed });
  }
  return out;
}
