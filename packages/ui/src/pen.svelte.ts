// Stato dello strumento penna (scheda RICALCA): strumento attivo, punti selezionati, tracciati
// modificati a mano, annulla/ripeti. Le modifiche vere sono funzioni pure del core (edit.ts).
import { removeNode, toggleCorner, moveNodes, type EditPath, type NodeRef } from '@compasso/core';

export type PenTool = 'select' | 'add' | 'delete' | 'convert';

const key = (r: NodeRef) => `${r.path}:${r.node}`;

/** Un passo dello storico: tracciati modificati a mano e regolazioni del ricalco. */
interface Step {
  paths: EditPath[] | null;
  settings: string;
  /** Passo nato da un cursore (i movimenti ravvicinati dello stesso cursore si fondono). */
  at?: number;
}

export class PenEditor {
  /** Tracciati modificati a mano; null = ancora quelli del ricalco. */
  paths = $state.raw<EditPath[] | null>(null);
  selection = $state.raw<NodeRef[]>([]);
  tool = $state<PenTool>('select');
  #undo = $state.raw<Step[]>([]);
  #redo = $state.raw<Step[]>([]);
  /** Regolazioni attuali (JSON) e come rimetterle: le fornisce la scheda RICALCA. */
  settings: () => string = () => '';
  applySettings: (s: string) => void = () => {};
  /** Tracciati da rimettere quando il ricalco con le regolazioni ripristinate è pronto. */
  pending: EditPath[] | null | undefined = undefined;

  get canUndo() {
    return this.#undo.length > 0;
  }
  get canRedo() {
    return this.#redo.length > 0;
  }
  /** Passi nello storico (indietro / avanti). */
  get undoCount() {
    return this.#undo.length;
  }
  get redoCount() {
    return this.#redo.length;
  }
  get edited() {
    return this.paths !== null;
  }

  isSelected(r: NodeRef) {
    return this.selection.some((s) => key(s) === key(r));
  }
  select(r: NodeRef, add: boolean) {
    if (!add) this.selection = [r];
    else if (this.isSelected(r)) this.selection = this.selection.filter((s) => key(s) !== key(r));
    else this.selection = [...this.selection, r];
  }
  clearSelection() {
    this.selection = [];
  }
  selectAll(base: EditPath[]) {
    this.selection = base.flatMap((p, pi) => p.nodes.map((_, ni) => ({ path: pi, node: ni })));
  }

  #now(): Step {
    return { paths: this.paths, settings: this.settings() };
  }
  /** Salva lo stato attuale per «indietro» (prima di una modifica). */
  checkpoint() {
    this.#undo = [...this.#undo.slice(-199), this.#now()];
    this.#redo = [];
  }
  /** Modifica completa: punto dello storico + nuovo stato. */
  commit(next: EditPath[]) {
    this.checkpoint();
    this.paths = next;
  }
  /** Durante un trascinamento: nuovo stato senza nuovi punti dello storico. */
  preview(next: EditPath[]) {
    this.paths = next;
  }
  #go(from: Step[], to: Step[]): [Step[], Step[]] | null {
    if (!from.length) return null;
    const step = from[from.length - 1]!;
    const back = [...to, this.#now()];
    this.selection = [];
    if (step.settings !== this.settings()) {
      // regolazioni diverse: si rimettono e i tracciati arrivano col nuovo ricalco
      this.pending = step.paths;
      this.applySettings(step.settings);
    } else this.paths = step.paths;
    return [from.slice(0, -1), back];
  }
  undo() {
    const r = this.#go(this.#undo, this.#redo);
    if (r) [this.#undo, this.#redo] = r;
  }
  redo() {
    const r = this.#go(this.#redo, this.#undo);
    if (r) [this.#redo, this.#undo] = r;
  }
  /**
   * Il ricalco è stato rifatto con nuove regolazioni. Se nasce da indietro/avanti si rimettono i
   * tracciati di quel passo; se nasce da un cursore si registra il passo (le modifiche a mano non
   * valgono più ma restano nello storico). Restituisce true se c'erano modifiche a mano azzerate.
   */
  settled(previous: string): boolean {
    if (this.pending !== undefined) {
      this.paths = this.pending;
      this.pending = undefined;
      return false;
    }
    const last = this.#undo[this.#undo.length - 1];
    const now = Date.now();
    const lost = this.paths !== null;
    // movimenti ravvicinati (es. trascinando un cursore) = un solo passo
    if (!(last?.at && now - last.at < 1500 && !lost))
      this.#undo = [...this.#undo.slice(-199), { paths: this.paths, settings: previous, at: now }];
    else this.#undo = [...this.#undo.slice(0, -1), { ...last, at: now }];
    this.#redo = [];
    this.paths = null;
    this.selection = [];
    return lost;
  }
  /** Nuovo schizzo: si riparte da zero. */
  reset() {
    this.paths = null;
    this.selection = [];
    this.pending = undefined;
    this.#undo = [];
    this.#redo = [];
  }

  deleteSelected(base: EditPath[]) {
    if (!this.selection.length) return;
    // dall'ultimo al primo: gli indici di quelli ancora da togliere non cambiano
    const sorted = [...this.selection].sort((a, b) => b.path - a.path || b.node - a.node);
    let next = base;
    for (const r of sorted) next = removeNode(next, r);
    this.commit(next);
    this.selection = [];
  }
  toggleSelected(base: EditPath[]) {
    if (!this.selection.length) return;
    let next = base;
    for (const r of this.selection) next = toggleCorner(next, r);
    this.commit(next);
  }
  nudge(base: EditPath[], dx: number, dy: number) {
    if (!this.selection.length) return;
    this.commit(moveNodes(base, this.selection, dx, dy));
  }
}
