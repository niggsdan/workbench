// Histórico de ações (Desfazer / Refazer) por snapshots.
// Só entra aqui o que muda o PROJETO. Seleção, zoom e playhead ficam de fora.

const clone = (x) => JSON.parse(JSON.stringify(x));

export class History {
  constructor(initial, label = 'Início', limit = 60) {
    this.limit = limit;
    this.items = [{ state: clone(initial), label, key: null }];
    this.i = 0;
  }

  get current() { return this.items[this.i].state; }
  get label() { return this.items[this.i].label; }
  get step() { return this.i + 1; }
  get total() { return this.items.length; }
  get canUndo() { return this.i > 0; }
  get canRedo() { return this.i < this.items.length - 1; }
  get undoLabel() { return this.canUndo ? this.items[this.i].label : ''; }
  get redoLabel() { return this.canRedo ? this.items[this.i + 1].label : ''; }

  // key agrupa gestos contínuos (arrastar um slider vira UM passo só)
  push(state, label, key = null) {
    const top = this.items[this.i];
    if (key && top.key === key && this.i === this.items.length - 1 && this.i > 0) {
      top.state = clone(state);
      top.label = label;
      return;
    }
    this.items = this.items.slice(0, this.i + 1);
    this.items.push({ state: clone(state), label, key });
    if (this.items.length > this.limit) this.items.shift();
    this.i = this.items.length - 1;
  }

  seal() { this.items[this.i].key = null; } // fim do gesto

  undo() { if (!this.canUndo) return false; this.i -= 1; return true; }
  redo() { if (!this.canRedo) return false; this.i += 1; return true; }
}
