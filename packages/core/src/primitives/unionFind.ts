export class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    let r = i;
    while (this.parent[r] !== r) r = this.parent[r]!;
    let c = i;
    while (this.parent[c] !== r) {
      const next = this.parent[c]!;
      this.parent[c] = r;
      c = next;
    }
    return r;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  groups(): number[][] {
    const m = new Map<number, number[]>();
    this.parent.forEach((_, i) => {
      const r = this.find(i);
      const g = m.get(r);
      if (g) g.push(i);
      else m.set(r, [i]);
    });
    return [...m.values()];
  }
}
