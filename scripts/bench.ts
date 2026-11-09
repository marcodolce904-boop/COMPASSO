// Benchmark di analyze() (SPEC §9): loghi sintetici da ~200 e ~2.000 anchor.
import { analyze, parseSvg } from '../packages/core/src';

function syntheticLogo(targetAnchors: number): string {
  const parts: string[] = [];
  let anchors = 0;
  let i = 0;
  while (anchors < targetAnchors) {
    const x = (i % 20) * 50;
    const y = Math.floor(i / 20) * 50;
    switch (i % 4) {
      case 0:
        parts.push(`<rect x="${x}" y="${y}" width="40" height="30" rx="8"/>`); // 8 anchor
        anchors += 8;
        break;
      case 1:
        parts.push(`<circle cx="${x + 20}" cy="${y + 20}" r="${12 + (i % 7)}"/>`); // 4
        anchors += 4;
        break;
      case 2:
        parts.push(`<polygon points="${x},${y + 40} ${x + 20},${y} ${x + 40},${y + 40}"/>`); // 3
        anchors += 3;
        break;
      default:
        parts.push(
          `<path d="M${x} ${y + 40} L${x} ${y} A20 20 0 0 1 ${x + 40} ${y} L${x + 40} ${y + 40} Z"/>`,
        );
        anchors += 5;
    }
    i++;
  }
  return `<svg>${parts.join('')}</svg>`;
}

function bench(label: string, anchorsTarget: number, targetMs: number, runs = 7) {
  const geom = parseSvg(syntheticLogo(anchorsTarget));
  analyze(geom); // riscaldamento
  const times: number[] = [];
  let anchors = 0;
  for (let k = 0; k < runs; k++) {
    const r = analyze(geom);
    times.push(r.durationMs);
    anchors = r.stats.anchors;
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)]!;
  const ok = median < targetMs ? 'OK' : 'LENTO';
  console.log(
    `${label}: ${anchors} anchor → mediana ${median.toFixed(1)} ms (obiettivo < ${targetMs} ms) ${ok}`,
  );
  return median < targetMs;
}

const a = bench('piccolo', 200, 150);
const b = bench('grande', 2000, 1500, 3);
if (!a || !b) process.exitCode = 1;
