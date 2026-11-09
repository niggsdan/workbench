// De onde o material chega: arquivos soltos, pasta do computador, arrastar e soltar.
// Tudo vira "entradas" { name, path, size, mime, file|handle } pra Library.add().

export function entriesFromFiles(list) {
  return [...list].map((f) => ({ name: f.name, path: f.webkitRelativePath || f.name, size: f.size, mime: f.type, file: f }));
}

// Percorre uma pasta aberta com a File System Access API (Chrome/Edge). Não copia nada: só lê quando precisar.
export async function walkHandle(dir, base = '', depth = 0, out = [], cap = 5000) {
  for await (const [name, h] of dir.entries()) {
    if (name.startsWith('.')) continue;
    if (h.kind === 'directory') {
      if (depth < 6) await walkHandle(h, base + name + '/', depth + 1, out, cap);
    } else {
      if (out.length >= cap) return out;
      const f = await h.getFile();
      out.push({ name, path: base + name, size: f.size, mime: f.type, handle: h, file: f });
    }
  }
  return out;
}

export const canPickFolder = () => typeof window.showDirectoryPicker === 'function';

export async function pickFolder() {
  const dir = await window.showDirectoryPicker({ mode: 'read' });
  return { name: dir.name, entries: await walkHandle(dir, dir.name + '/') };
}

// Arrastar e soltar: aceita arquivos e pastas.
function readAll(reader) {
  return new Promise((resolve, reject) => {
    const all = [];
    const next = () => reader.readEntries((batch) => { if (!batch.length) resolve(all); else { all.push(...batch); next(); } }, reject);
    next();
  });
}
const fileOf = (entry) => new Promise((res, rej) => entry.file(res, rej));

async function walkEntry(entry, base, out, depth = 0) {
  if (entry.name.startsWith('.')) return;
  if (entry.isFile) {
    const f = await fileOf(entry);
    out.push({ name: f.name, path: base + f.name, size: f.size, mime: f.type, file: f });
  } else if (entry.isDirectory && depth < 6) {
    for (const child of await readAll(entry.createReader())) await walkEntry(child, base + entry.name + '/', out, depth + 1);
  }
}

export async function entriesFromDrop(dt) {
  const out = [];
  const items = dt.items ? [...dt.items].filter((i) => i.kind === 'file') : [];
  const roots = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (items.length && roots.every(Boolean)) {
    for (const r of roots) await walkEntry(r, '', out);
    return out;
  }
  return entriesFromFiles(dt.files || []);
}
