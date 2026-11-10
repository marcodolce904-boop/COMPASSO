// Tema sincronizzato con Illustrator (§8.5): sfondo del pannello = sfondo dell'interfaccia;
// con le interfacce chiare si attivano i token chiari (tokens.css, [data-theme='light']).
export function themeFor(color: string): { background: string; theme: 'dark' | 'light' } | null {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(color);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.round(Number(v)));
  const luminance = (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
  return { background: `rgb(${r}, ${g}, ${b})`, theme: luminance > 0.5 ? 'light' : 'dark' };
}

export function applyHostTheme(color: string): void {
  const t = themeFor(color);
  if (!t) return;
  const root = document.documentElement;
  root.dataset['theme'] = t.theme;
  root.style.setProperty('--c-bg-panel', t.background);
}
