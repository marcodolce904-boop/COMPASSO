// Definizione delle fixture sintetiche 01–05 (SPEC §10.1), con i valori VERI noti.
// Usata da gen-fixtures.ts (scrive gli SVG) e dai test (confronta con la verità).

export interface FixtureTruth {
  /** Cerchi/archi attesi come "arc" (entro ε stretta). */
  arcs: { cx: number; cy: number; r: number; sweepDeg: number }[];
  /** Archi attesi come "near-arc" (finding). */
  nearArcs: number;
  /** Numero di segmenti retti attesi dopo la normalizzazione. */
  lines: number;
}

export interface FixtureDef {
  file: string;
  title: string;
  svg: string;
  truth: FixtureTruth;
}

const KAPPA = 0.5522847498307936;
const f = (v: number) => Number(v.toFixed(6)).toString();
const pt = (x: number, y: number) => `${f(x)} ${f(y)}`;

/** Cubica che approssima un arco di cerchio [a0, a1] (radianti, Y verso il basso). */
export function arcCubic(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const k = (4 / 3) * Math.tan((a1 - a0) / 4);
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const c1 = [x0 - k * r * Math.sin(a0), y0 + k * r * Math.cos(a0)];
  const c2 = [x1 + k * r * Math.sin(a1), y1 - k * r * Math.cos(a1)];
  return `C ${pt(c1[0] as number, c1[1] as number)} ${pt(c2[0] as number, c2[1] as number)} ${pt(x1, y1)}`;
}

const wrap = (body: string, w = 200, h = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${body}\n</svg>\n`;

const deg = (d: number) => (d * Math.PI) / 180;

function circleBy4(cx: number, cy: number, r: number): string[] {
  return [0, 1, 2, 3].map((i) => arcCubic(cx, cy, r, deg(90 * i), deg(90 * (i + 1))));
}

function f01(): FixtureDef {
  const [cx, cy, r] = [100, 100, 80];
  const d = `M ${pt(cx + r, cy)} ${circleBy4(cx, cy, r).join(' ')} Z`;
  return {
    file: '01-cerchio-4-cubiche.svg',
    title: 'Cerchio da 4 cubiche',
    svg: wrap(`<path d="${d}" fill="#000"/>`),
    truth: { arcs: [{ cx, cy, r, sweepDeg: 360 }], nearArcs: 0, lines: 0 },
  };
}

function f02(): FixtureDef {
  const [cx, cy, r] = [100, 100, 80];
  const d = `M ${pt(cx + r, cy)} ${arcCubic(cx, cy, r, 0, deg(90))}`;
  return {
    file: '02-arco-90.svg',
    title: 'Arco di 90° (test kappa)',
    svg: wrap(`<path d="${d}" fill="none" stroke="#000"/>`),
    truth: { arcs: [{ cx, cy, r, sweepDeg: 90 }], nearArcs: 0, lines: 0 },
  };
}

function f03(): FixtureDef {
  const [cx, cy, r] = [100, 110, 90];
  const cuts = [-100, -35, 40, 100]; // 3 pezzi irregolari: 65°, 75°, 60° → arco da 200°
  const parts: string[] = [];
  for (let i = 0; i < 3; i++)
    parts.push(arcCubic(cx, cy, r, deg(cuts[i] as number), deg(cuts[i + 1] as number)));
  const a0 = deg(cuts[0] as number);
  const d = `M ${pt(cx + r * Math.cos(a0), cy + r * Math.sin(a0))} ${parts.join(' ')}`;
  return {
    file: '03-arco-3-cubiche-irregolari.svg',
    title: 'Arco spezzato in 3 cubiche irregolari (catena)',
    svg: wrap(`<path d="${d}" fill="none" stroke="#000"/>`),
    truth: { arcs: [{ cx, cy, r, sweepDeg: 200 }], nearArcs: 0, lines: 0 },
  };
}

/** Quarto di cerchio con le maniglie allungate di `bulge`: il segmento si gonfia (quasi-arco). */
function f04(): FixtureDef {
  const [cx, cy, r] = [100, 100, 80];
  const bulge = 1.26;
  const q = circleBy4(cx, cy, r);
  // ultimo quarto (270°→360°) con maniglie scalate
  const a0 = deg(270);
  const a1 = deg(360);
  const k = (4 / 3) * Math.tan((a1 - a0) / 4) * bulge;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  q[3] = `C ${pt(x0 - k * r * Math.sin(a0), y0 + k * r * Math.cos(a0))} ${pt(x1 + k * r * Math.sin(a1), y1 - k * r * Math.cos(a1))} ${pt(x1, y1)}`;
  const d = `M ${pt(cx + r, cy)} ${q.join(' ')} Z`;
  return {
    file: '04-quasi-cerchio-1.5pct.svg',
    title: 'Quasi-cerchio: un quarto gonfiato (finding near-arc)',
    svg: wrap(`<path d="${d}" fill="#000"/>`),
    truth: { arcs: [{ cx, cy, r, sweepDeg: 270 }], nearArcs: 1, lines: 0 },
  };
}

function f05(): FixtureDef {
  const [x, y, w, h, rr] = [20, 40, 160, 120, 30];
  return {
    file: '05-rettangolo-arrotondato.svg',
    title: 'Rettangolo arrotondato (4 archi uguali, 4 rette)',
    svg: wrap(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" fill="#000"/>`),
    truth: {
      arcs: [
        { cx: x + w - rr, cy: y + rr, r: rr, sweepDeg: 90 },
        { cx: x + w - rr, cy: y + h - rr, r: rr, sweepDeg: 90 },
        { cx: x + rr, cy: y + h - rr, r: rr, sweepDeg: 90 },
        { cx: x + rr, cy: y + rr, r: rr, sweepDeg: 90 },
      ],
      nearArcs: 0,
      lines: 4,
    },
  };
}

export const FIXTURES: FixtureDef[] = [f01(), f02(), f03(), f04(), f05()];
export { KAPPA };
