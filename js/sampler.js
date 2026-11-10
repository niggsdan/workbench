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
  let lastPx = null;
  const gray = () => {
    const px = g.getImageData(0, 0, W, H).data;
    lastPx = px;
    const out = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) out[j] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    return out;
  };
  const series = [];
  const thumbs = [];
  let nextThumb = 0;
  let prev = null;
  try {
    for (let t = 0; t < duration; t = Math.round((t + step) * 1000) / 1000) {
      if (signal && signal.aborted) throw new DOMException('Análise cancelada', 'AbortError');
      await seek(v, Math.min(t, Math.max(0, duration - 0.05)));
      g.drawImage(v, 0, 0, W, H);
      const cur = gray();
      if (t >= nextThumb) { thumbs.push({ t, w: W, h: H, rgba: new Uint8ClampedArray(lastPx) }); nextThumb = t + Math.max(0.5, step); }
      if (prev) series.push({ t, d: frameDiff(prev, cur) });
      prev = cur;
      if (onProgress) onProgress(Math.min(1, t / duration));
    }
  } finally {
    v.removeAttribute('src');
    v.load();
  }
  return { duration, step, series, thumbs };
}

// Quadros por segundo de verdade: toca um instante e mede o intervalo entre quadros apresentados.
async function measureFps(v) {
  if (!v.requestVideoFrameCallback) return 30;
  const times = [];
  await new Promise((resolve) => {
    let n = 0; const stop = () => { v.pause(); resolve(); };
    const cb = (now, meta) => { times.push(meta.mediaTime); if (++n < 14) v.requestVideoFrameCallback(cb); else stop(); };
    v.requestVideoFrameCallback(cb); v.play().catch(stop); setTimeout(stop, 2500);
  });
  const d = []; for (let i = 1; i < times.length; i++) { const x = times[i] - times[i - 1]; if (x > 0.004) d.push(x); }
  if (d.length < 3) return 30;
  d.sort((a, b) => a - b); const fps = 1 / d[d.length >> 1];
  const std = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 119.88, 120].sort((a, b) => Math.abs(a - fps) - Math.abs(b - fps))[0];
  return Math.abs(std - fps) / std < 0.04 ? std : Math.round(fps);
}

// Leva cada corte pro quadro exato da mudança: olha quadro a quadro numa janela em volta e pega o maior salto.
export async function refineCuts(src, cuts, { win = 0.3, onProgress, signal } = {}) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
  await once(v, 'loadedmetadata', 15000);
  const fps = await measureFps(v);
  const W2 = 64; const H2 = 36; const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const g = c.getContext('2d', { willReadFrequently: true });
  const gray = () => { const px = g.getImageData(0, 0, W2, H2).data; const out = new Uint8Array(W2 * H2); for (let i = 0, j = 0; i < px.length; i += 4, j++) out[j] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0; return out; };
  const step = 1 / fps; const out = [];
  try {
    for (let k = 0; k < cuts.length; k++) {
      if (signal && signal.aborted) throw new DOMException('cancelado', 'AbortError');
      const c0 = cuts[k]; let prev = null; let best = { d: -1, f: Math.round(c0 * fps) };
      const f0 = Math.max(1, Math.floor((c0 - win) * fps)); const f1 = Math.min(Math.floor((v.duration - 0.01) * fps), Math.ceil((c0 + win) * fps));
      for (let f = f0 - 1; f <= f1; f++) {
        await seek(v, Math.min(v.duration - 0.01, (f + 0.5) * step)); // meio do quadro: sem ambiguidade
        g.drawImage(v, 0, 0, W2, H2); const cur = gray();
        if (prev) { const d = frameDiff(prev, cur); if (d > best.d) best = { d, f }; }
        prev = cur;
      }
      out.push(Math.round((best.f / fps) * 1000) / 1000);
      if (onProgress) onProgress((k + 1) / cuts.length);
    }
  } finally { v.removeAttribute('src'); v.load(); }
  return { cuts: out, fps };
}
