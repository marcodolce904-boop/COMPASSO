import { reportFileName, type CompassoReport } from '@compasso/core';
import { fs, os, path } from '../lib/cep/node';

/**
 * Salva la segnalazione sul Desktop (o nella cartella utente se il Desktop non c'è) e restituisce
 * il percorso. Solo scrittura locale: niente viene inviato.
 */
export function saveReportFile(rep: CompassoReport, now = new Date()): string {
  const home = os.homedir();
  const desktop = path.join(home, 'Desktop');
  const dir = fs.existsSync(desktop) ? desktop : home;
  const file = path.join(dir, reportFileName(now));
  fs.writeFileSync(file, JSON.stringify(rep, null, 1), 'utf8');
  return file;
}
