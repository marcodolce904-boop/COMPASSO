import type { SelectedImage } from '../../jsx/ilst/tracejsx';
import { fs, path } from '../lib/cep/node';

/** File immagine letto dal disco, con la posizione sulla tavola se viene dalla selezione. */
export interface PickedImage {
  blob: Blob;
  name: string;
  bounds?: SelectedImage['bounds'];
  /** "Foto" fatta da Illustrator (immagine incorporata, ritagliata, PSD…). */
  captured?: boolean;
}

function readImage(file: string, bounds?: SelectedImage['bounds'], captured = false): PickedImage {
  const buf = fs.readFileSync(file);
  if (captured) {
    // il PNG temporaneo serve solo adesso
    try {
      fs.unlinkSync(file);
    } catch {
      /* resta nella cartella temporanea del sistema */
    }
  }
  const ext = path.extname(file).toLowerCase();
  let type = 'image/jpeg';
  if (ext === '.png') type = 'image/png';
  else if (ext === '.webp') type = 'image/webp';
  return {
    blob: new Blob([new Uint8Array(buf)], { type }),
    name: path.basename(file),
    bounds,
    captured,
  };
}

/** Finestra «apri file» di CEP: percorso scelto o null. */
function chooseFile(title: string): string | null {
  const cep = (
    window as unknown as {
      cep?: { fs?: { showOpenDialogEx?: (...a: unknown[]) => { data?: string[] } } };
    }
  ).cep;
  const res = cep?.fs?.showOpenDialogEx?.(false, false, title, '', ['png', 'jpg', 'jpeg', 'webp']);
  return res && res.data && res.data.length ? res.data[0]! : null;
}

/**
 * L'immagine da ricalcare: quella selezionata in Illustrator (se collegata), altrimenti un file
 * scelto dall'utente. `reason` spiega perché la selezione non è utilizzabile.
 */
export function pickImageFile(
  selected: SelectedImage,
  dialogTitle: string,
): { image: PickedImage | null; reason?: SelectedImage['reason'] } {
  if (selected.ok && selected.path)
    return { image: readImage(selected.path, selected.bounds, !!selected.captured) };
  const file = chooseFile(dialogTitle);
  if (!file) return { image: null, reason: selected.reason };
  return { image: readImage(file) };
}
