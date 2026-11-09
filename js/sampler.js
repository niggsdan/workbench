// Lê o vídeo no navegador e mede a diferença entre quadros vizinhos.
// Usa um <video> escondido: busca quadro a quadro (seek), reduz pra miniatura e compara.
// Vídeo longo demora: por isso o passo cresce com a duração.
// Próximo passo previsto: WebCodecs (decodificação direta) e Worker pra ficar mais rápido.

import { frameDiff } from './detect.js';

const W = 48;
const H = 27;

function once(el, ev, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { el.removeEventListener(ev, ok); reject(new Error('Tempo esgotado esperando ' + ev)); }, ms);
    const ok = () => { clearTimeout(t); resolve(); };
    el.addEventListener(ev, ok, { once: true });
  });
}

async function seek(v, t) {
  const done = once(v, 'seeked');
  v.currentTime = t;
  await done;
}

export const stepFor = (duration) => (duration <= 120 ? 0.1 : duration <= 600 ? 0.25 : 0.5);

export async function sampleVideo(src, { onProgress, signal } = {}) {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = src;
  await once(v, 'loadedmetadata', 15000);
  const duration = v.duration;
  const step = stepFor(duration);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  const gray = () => {
    const px = g.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) out[j] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    return out;
  };
  const series = [];
  let prev = null;
  try {
    for (let t = 0; t < duration; t = Math.round((t + step) * 1000) / 1000) {
      if (signal && signal.aborted) throw new DOMException('Análise cancelada', 'AbortError');
      await seek(v, Math.min(t, Math.max(0, duration - 0.05)));
      g.drawImage(v, 0, 0, W, H);
      const cur = gray();
      if (prev) series.push({ t, d: frameDiff(prev, cur) });
      prev = cur;
      if (onProgress) onProgress(Math.min(1, t / duration));
    }
  } finally {
    v.removeAttribute('src');
    v.load();
  }
  return { duration, step, series };
}
