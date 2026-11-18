// Banco di prova del ricalco: `pnpm bench:trace`. Per ogni figura e livello di difficoltà
// ricalca lo schizzo e misura scarto, pezzi mancanti, anchor e spigoli; poi spegne una parte
// del metodo alla volta (ablazione) per vedere quanto conta.
import { downscale, trace, traceDefaults, type TraceTuning } from '../packages/core/src';
import {
  FIGURES,
  LEVEL_WIDTH,
  score,
  sketch,
  type Level,
  type Score,
} from '../packages/core/test/helpers/tracebench';

const levels: Level[] = ['facile', 'normale', 'difficile'];
const SEEDS = [1, 2, 3];
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : ' - ');

function run(level: Level, tuning: Partial<TraceTuning> = {}) {
  const rows: { fig: string; s: Score; ms: number }[] = [];
  for (const fig of FIGURES)
    for (const seed of SEEDS) {
      const img = sketch(fig, level, seed);
      const t = performance.now();
      const out = trace(img, traceDefaults(fig.w, fig.h), { x: 0, y: 0, scale: 1 }, tuning);
      rows.push({
        fig: fig.name,
        s: score(out.geometry, fig, LEVEL_WIDTH[level]),
        ms: performance.now() - t,
      });
    }
  return rows;
}

function summary(rows: ReturnType<typeof run>) {
  const n = rows.length;
  const avg = (f: (s: Score) => number) => {
    const v = rows.map((r) => f(r.s)).filter(Number.isFinite);
    return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
  };
  return {
    meanDev: avg((s) => s.meanDev),
    maxDev: avg((s) => s.maxDev),
    missing: avg((s) => s.missing) * 100,
    anchorsRatio: avg((s) => s.anchors / s.ideal),
    cornerErr: avg((s) => s.cornerErr),
    pathsOk: (rows.filter((r) => r.s.paths === r.s.expectedPaths).length / n) * 100,
    oriented: avg((s) => s.oriented) * 100,
    ms: rows.reduce((a, r) => a + r.ms, 0) / n,
  };
}

const args = process.argv.slice(2);
if (!args.includes('--solo-ablazione')) {
  for (const level of levels) {
    console.log(
      `\n== ${level} (spessore ${LEVEL_WIDTH[level]} px, media su ${SEEDS.length} disegni) ==`,
    );
    console.log(
      'figura            tracciati  anchor/ideale  scarto medio  scarto max  mancante  spigoli',
    );
    const rows = run(level);
    for (const fig of FIGURES) {
      const rs = rows.filter((r) => r.fig === fig.name).map((r) => r.s);
      const m = (f: (s: Score) => number) => rs.reduce((a, s) => a + f(s), 0) / rs.length;
      console.log(
        fig.name.padEnd(18) +
          `${rs.map((s) => s.paths).join('/')} (${fig.paths.length})`.padEnd(11) +
          `${f1(m((s) => s.anchors))}/${fig.ideal}`.padEnd(15) +
          `${f1(m((s) => s.meanDev))} px`.padEnd(14) +
          `${f1(m((s) => s.maxDev))} px`.padEnd(12) +
          `${f1(m((s) => s.missing) * 100)}%`.padEnd(10) +
          (fig.corners.length ? `${f1(m((s) => s.cornerErr))} px` : '-'),
      );
    }
  }
}

const variants: [string, Partial<TraceTuning>][] = [
  ['metodo completo', {}],
  ['media semplice (appiattisce)', { keepCurves: false }],
  ['media curve, finestra 1×', { curveWindow: 1 }],
  ['media curve, finestra 2×', { curveWindow: 2 }],
  ['senza media tra punti', { average: false }],
  ['senza ricampionamento', { resample: false }],
  ['senza direzione (spigoli)', { corners: false }],
  ['senza spigoli esatti', { exactCorners: false }],
  ['senza ricucitura', { joinGaps: false }],
  ['senza verso (orario)', { orient: false }],
  ['senza ingrandimento', { upscale: false }],
];
for (const level of ['normale', 'difficile'] as Level[]) {
  console.log(`\n== ablazione, livello ${level} (medie su tutte le figure) ==`);
  console.log(
    'variante                    scarto  max    mancante  anchor/ideale  spigoli  tracciati ok  verso ok   ms',
  );
  for (const [name, tu] of variants) {
    const s = summary(run(level, tu));
    console.log(
      name.padEnd(28) +
        `${f1(s.meanDev)}`.padEnd(8) +
        `${f1(s.maxDev)}`.padEnd(7) +
        `${f1(s.missing)}%`.padEnd(10) +
        `${s.anchorsRatio.toFixed(2)}`.padEnd(15) +
        `${f1(s.cornerErr)}`.padEnd(9) +
        `${f1(s.pathsOk)}%`.padEnd(14) +
        `${f1(s.oriented)}%`.padEnd(11) +
        `${s.ms.toFixed(0)}`,
    );
  }
}

// foto piccole: lo stesso schizzo ridotto a 1/3 (≈ 170–210 px), riportato in scala per il confronto
console.log('\n== foto piccole (1/3 della risoluzione, livello normale) ==');
console.log('variante                    scarto  max    anchor/ideale  spigoli  tracciati ok');
for (const [name, tu] of [
  ['con ingrandimento', {}],
  ['senza ingrandimento', { upscale: false }],
] as [string, Partial<TraceTuning>][]) {
  const rows: { fig: string; s: Score; ms: number }[] = [];
  for (const fig of FIGURES)
    for (const seed of SEEDS) {
      const { image } = downscale(
        sketch(fig, 'normale', seed),
        Math.ceil(Math.max(fig.w, fig.h) / 3),
      );
      const out = trace(
        image,
        traceDefaults(image.width, image.height),
        { x: 0, y: 0, scale: 3 },
        tu,
      );
      rows.push({ fig: fig.name, s: score(out.geometry, fig, LEVEL_WIDTH.normale), ms: 0 });
    }
  const s = summary(rows);
  console.log(
    name.padEnd(28) +
      `${f1(s.meanDev)}`.padEnd(8) +
      `${f1(s.maxDev)}`.padEnd(7) +
      `${s.anchorsRatio.toFixed(2)}`.padEnd(15) +
      `${f1(s.cornerErr)}`.padEnd(9) +
      `${f1(s.pathsOk)}%`,
  );
}
