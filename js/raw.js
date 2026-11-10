// Prévia de foto RAW: acha as imagens JPEG guardadas dentro do arquivo e devolve a maior que decodifica.
// Funciona com RW2 (Lumix), ORF (Olympus/OM), CR2/CR3 (Canon), NEF (Nikon), ARW (Sony), RAF (Fuji), DNG e outros.

// Fim real de um JPEG que começa em `s` (SOI): pula os segmentos até o SOS e anda pelos dados até o EOI.
export function jpegEnd(b, s) {
  let i = s + 2; const n = b.length;
  while (i + 4 <= n) {
    if (b[i] !== 0xff) return -1;
    const m = b[i + 1];
    if (m === 0xd9) return i + 2;
    if (m === 0xff) { i++; continue; }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return -1;
    i += 2 + len;
    if (m === 0xda) { // dados comprimidos: termina num FFD9 que não seja byte escapado nem RST
      while (i + 1 < n) {
        if (b[i] === 0xff) { const x = b[i + 1]; if (x === 0xd9) return i + 2; if (x === 0x00 || (x >= 0xd0 && x <= 0xd7) || x === 0xff) { i += x === 0xff ? 1 : 2; continue; } i += 2; continue; }
        i++;
      }
      return -1;
    }
  }
  return -1;
}

// Todas as JPEGs de primeiro nível no arquivo: [{ start, end, size }], maiores primeiro.
export function findJpegs(b) {
  const out = []; let i = 0; const n = b.length;
  while (i + 3 < n) {
    if (b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff) {
      const e = jpegEnd(b, i);
      if (e > i) { out.push({ start: i, end: e, size: e - i }); i = e; continue; }
    }
    i++;
  }
  return out.sort((x, y) => y.size - x.size);
}

export async function rawPreview(file) {
  const b = new Uint8Array(await file.arrayBuffer());
  const list = findJpegs(b).filter((j) => j.size > 20000);
  for (const j of list) {
    const blob = new Blob([b.subarray(j.start, j.end)], { type: 'image/jpeg' });
    try { const bmp = await createImageBitmap(blob); const w = bmp.width; const h = bmp.height; bmp.close && bmp.close(); if (w >= 320) return { blob, width: w, height: h }; } catch (e) { /* tenta a próxima */ }
  }
  throw new Error('não achei uma prévia dentro desse RAW');
}
