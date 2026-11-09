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

/** Attese a livello di analyze() (Fase 2); i campi assenti non vengono verificati. */
export interface AnalyzeTruth {
  circles?: number;
  /** Assi validi: 'v' (verticale, x = rho) o 'h' (orizzontale, y = rho). */
  axes?: { dir: 'v' | 'h'; at: number }[];
  noAxes?: boolean;
  unitX?: number | null;
  /** Tipi di finding attesi (almeno uno ciascuno). */
  findings?: string[];
  /** Nessun finding. */
  clean?: boolean;
  /** Delta atteso del primo finding del tipo indicato. */
  findingDelta?: { kind: string; delta: number; tol: number };
  relations?: string[];
}

export interface FixtureDef {
  file: string;
  title: string;
  svg: string;
  truth: FixtureTruth;
  analyze?: AnalyzeTruth;
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
    analyze: {
      circles: 1,
      clean: true,
      axes: [
        { dir: 'v', at: 100 },
        { dir: 'h', at: 100 },
      ],
      unitX: null,
    },
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
    analyze: { circles: 1, clean: true },
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
    analyze: { circles: 1, clean: true },
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
    analyze: { circles: 1, findings: ['near-arc'] },
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
    analyze: {
      circles: 4,
      clean: true,
      axes: [
        { dir: 'v', at: 100 },
        { dir: 'h', at: 100 },
      ],
      relations: ['equal-radius', 'tangent-line-circle'],
    },
  };
}

/** Lettera O geometrica: anello (due cerchi concentrici, verso opposto). Sostituibile da un disegno. */
function f06(): FixtureDef {
  const [cx, cy, R, r] = [100, 100, 80, 56];
  const outer = `M ${pt(cx + R, cy)} ${circleBy4(cx, cy, R).join(' ')} Z`;
  const innerParts = [3, 2, 1, 0].map((i) => arcCubic(cx, cy, r, deg(90 * (i + 1)), deg(90 * i)));
  const inner = `M ${pt(cx + r, cy)} ${innerParts.join(' ')} Z`;
  return {
    file: '06-lettera-o.svg',
    title: 'Lettera O geometrica (anello, unità x = 24)',
    svg: wrap(`<path d="${outer} ${inner}" fill="#000" fill-rule="evenodd"/>`),
    truth: {
      arcs: [
        { cx, cy, r: R, sweepDeg: 360 },
        { cx, cy, r, sweepDeg: 360 },
      ],
      nearArcs: 0,
      lines: 0,
    },
    analyze: { circles: 2, clean: true, unitX: R - r, relations: ['concentric'] },
  };
}

/** Casetta: simmetrica solo rispetto all'asse verticale x = 100, con finestra circolare. */
const house = (eaveRightY = 90) =>
  `<path d="M40 180 L40 90 L100 30 L160 ${f(eaveRightY)} L160 180 Z"/>` +
  `<circle cx="100" cy="125" r="25"/>`;

function f09(): FixtureDef {
  return {
    file: '09-marchio-simmetrico.svg',
    title: 'Marchio simmetrico (asse verticale)',
    svg: wrap(house()),
    truth: { arcs: [{ cx: 100, cy: 125, r: 25, sweepDeg: 360 }], nearArcs: 0, lines: 5 },
    analyze: { circles: 1, axes: [{ dir: 'v', at: 100 }], clean: true },
  };
}

function f10(): FixtureDef {
  return {
    file: '10-marchio-quasi-simmetrico.svg',
    title: 'Marchio quasi simmetrico (gronda destra 1,5 pt più alta)',
    svg: wrap(house(88.5)),
    truth: { arcs: [{ cx: 100, cy: 125, r: 25, sweepDeg: 360 }], nearArcs: 0, lines: 5 },
    analyze: {
      circles: 1,
      noAxes: true,
      findings: ['near-symmetry'],
      findingDelta: { kind: 'near-symmetry', delta: 1.5, tol: 0.2 },
    },
  };
}

function f11(): FixtureDef {
  return {
    file: '11-anchor-fuori-riga-0.3pt.svg',
    title: 'Tre barre allineate in basso, la terza 0,3 pt più giù',
    svg: wrap(
      '<rect x="20" y="50" width="40" height="100"/>' +
        '<rect x="80" y="70" width="40" height="80"/>' +
        '<rect x="140" y="60" width="40" height="90.3"/>',
    ),
    truth: { arcs: [], nearArcs: 0, lines: 12 },
    analyze: {
      circles: 0,
      findings: ['near-row'],
      findingDelta: { kind: 'near-row', delta: 0.3, tol: 0.001 },
      relations: ['anchor-row'],
    },
  };
}

function f12(): FixtureDef {
  const h = 40 * Math.sqrt(3); // barra a 60°
  return {
    file: '12-diagonali-parallele.svg',
    title: 'Diagonali parallele a 45° e 60° (clustering)',
    svg: wrap(
      '<path d="M20 120 L80 60 L100 60 L40 120 Z"/>' +
        '<path d="M110 30 L130 10 L140 30 Z"/>' +
        `<path d="M120 180 L${f(160)} ${f(180 - h)} L${f(180)} ${f(180 - h)} L140 180 Z"/>`,
    ),
    truth: { arcs: [], nearArcs: 0, lines: 11 },
    analyze: { circles: 0, clean: true },
  };
}

export const FIXTURES: FixtureDef[] = [
  f01(),
  f02(),
  f03(),
  f04(),
  f05(),
  f06(),
  f09(),
  f10(),
  f11(),
  f12(),
];
export { KAPPA };
