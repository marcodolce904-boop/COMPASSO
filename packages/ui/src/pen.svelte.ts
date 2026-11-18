// Stato dello strumento penna (scheda RICALCA): strumento attivo, punti selezionati, tracciati
// modificati a mano, annulla/ripeti. Le modifiche vere sono funzioni pure del core (edit.ts).
import { removeNode, toggleCorner, moveNodes, type EditPath, type NodeRef } from '@compasso/core';

export type PenTool = 'select' | 'add' | 'delete' | 'convert';

const key = (r: NodeRef) => `${r.path}:${r.node}`;

export class PenEditor {
  /** Tracciati modificati a mano; null = ancora quelli del ricalco. */
  paths = $state.raw<EditPath[] | null>(null);
  selection = $state.raw<NodeRef[]>([]);
  tool = $state<PenTool>('select');
  #undo = $state.raw<(EditPath[] | null)[]>([]);
  #redo = $state.raw<(EditPath[] | null)[]>([]);

  get canUndo() {
    return this.#undo.length > 0;
  }
  get canRedo() {
    return this.#redo.length > 0;
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

  /** Salva lo stato attuale per annulla (prima di una modifica). */
  checkpoint() {
    this.#undo = [...this.#undo.slice(-99), this.paths];
    this.#redo = [];
  }
  /** Modifica completa: punto di annulla + nuovo stato. */
  commit(next: EditPath[]) {
    this.checkpoint();
    this.paths = next;
  }
  /** Durante un trascinamento: nuovo stato senza nuovi punti di annulla. */
  preview(next: EditPath[]) {
    this.paths = next;
  }
  undo() {
    if (!this.#undo.length) return;
    this.#redo = [...this.#redo, this.paths];
    this.paths = this.#undo[this.#undo.length - 1]!;
    this.#undo = this.#undo.slice(0, -1);
    this.selection = [];
  }
  redo() {
    if (!this.#redo.length) return;
    this.#undo = [...this.#undo, this.paths];
    this.paths = this.#redo[this.#redo.length - 1]!;
    this.#redo = this.#redo.slice(0, -1);
    this.selection = [];
  }
  /**
   * Il ricalco è cambiato (nuove regolazioni): le modifiche a mano non valgono più, ma restano
   * recuperabili con annulla.
   */
  rebase(): boolean {
    if (this.paths === null) return false;
    this.checkpoint();
    this.paths = null;
    this.selection = [];
    return true;
  }
  /** Nuovo schizzo: si riparte da zero. */
  reset() {
    this.paths = null;
    this.selection = [];
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
