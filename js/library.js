// Biblioteca de mídia do projeto: o que foi adicionado (arquivos, pasta, Drive).
import { kindOf, roleOfPath } from './media.js';

let seq = 0;

export class Library {
  constructor() { this.items = []; }

  // entry: { name, path?, size?, mime?, file?, handle?, driveId? }
  // Devolve o item novo, ou o que já existia (mesmo caminho e tamanho).
  add(entry) {
    const path = entry.path || entry.name;
    const dup = this.items.find((i) => i.path === path && i.size === (entry.size || 0));
    if (dup) return dup;
    const item = {
      id: 'm' + (++seq),
      name: entry.name,
      path,
      size: entry.size || 0,
      kind: kindOf(entry.name, entry.mime),
      role: roleOfPath(path),
      file: entry.file || null, handle: entry.handle || null, driveId: entry.driveId || null,
      status: 'novo', // novo | verificando | convertendo | pronto | convertido | erro
      note: '', progress: 0,
      play: null, // Blob que o navegador toca (o próprio arquivo ou a conversão)
      converted: null, duration: 0
    };
    this.items.push(item);
    return item;
  }

  get(id) { return this.items.find((i) => i.id === id) || null; }
  clear() { this.items = []; }

  byRole() {
    const out = { Falas: [], Cenas: [], Overlays: [], Outros: [] };
    for (const i of this.items) out[i.role].push(i);
    for (const k of Object.keys(out)) out[k].sort((a, b) => a.path.localeCompare(b.path, 'pt-BR', { numeric: true }));
    return out;
  }

  counts() {
    const c = { video: 0, audio: 0, image: 0, other: 0 };
    for (const i of this.items) c[i.kind] += 1;
    return c;
  }
}
