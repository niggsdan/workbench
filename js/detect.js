// Detecção de cenas, parte pura (sem vídeo, sem DOM).
//
// Fluxo: o sampler mede a diferença entre quadros vizinhos -> série {t, d}.
// candidates() acha os picos e dá uma nota de 0 a 1 pra cada um.
// selectCuts() escolhe quais picos viram corte conforme a sensibilidade.
// Assim, mexer na sensibilidade NÃO reanalisa o vídeo.

import { MIN_SCENE, r1 } from './project.js';

export const SENS_LABELS = ['Baixa', 'Média-baixa', 'Média', 'Média-alta', 'Alta'];
export const THRESHOLDS = [0.8, 0.65, 0.5, 0.35, 0.2];
export const DEFAULT_SENS = 2;

// a e b: Uint8Array/Array de luminância (0-255) com o mesmo tamanho.
// Mistura diferença média de pixel com distância de histograma (mais robusta a movimento).
export function frameDiff(a, b) {
  const n = a.length;
  if (!n || n !== b.length) return 0;
  const ha = new Array(32).fill(0);
  const hb = new Array(32).fill(0);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(a[i] - b[i]);
    ha[a[i] >> 3] += 1;
    hb[b[i] >> 3] += 1;
  }
  const mad = sum / n / 255;
  let hd = 0;
  for (let k = 0; k < 32; k++) hd += Math.abs(ha[k] - hb[k]);
  hd = hd / (2 * n);
  return Math.min(1, mad * 1.25 + hd * 0.5);
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// series: [{ t, d }] onde d = diferença entre o quadro em t e o anterior.
export function candidates(series, { minGap = MIN_SCENE, win = 8 } = {}) {
  const raw = [];
  for (let i = 0; i < series.length; i++) {
    const d = series[i].d;
    let peak = true;
    for (let j = Math.max(0, i - 2); j <= Math.min(series.length - 1, i + 2); j++) {
      if (series[j].d > d) { peak = false; break; }
    }
    if (!peak) continue;
    const around = [];
    for (let j = i - win; j <= i + win; j++) {
      if (j >= 0 && j < series.length && Math.abs(j - i) > 2) around.push(series[j].d);
    }
    const base = median(around);
    const abs = Math.min(1, d / 0.4); // salto grande em valor absoluto
    const contrast = Math.max(0, Math.min(1, (d / (base + 0.02) - 1) / 3)); // destaca do entorno; plano = 0 (ignora movimento contínuo)
    const score = abs * contrast;
    if (score >= 0.05) raw.push({ t: series[i].t, score });
  }
  // supressão: dentro de minGap, fica só o pico mais forte
  raw.sort((x, y) => y.score - x.score);
  const kept = [];
  for (const c of raw) if (kept.every((k) => Math.abs(k.t - c.t) >= minGap)) kept.push(c);
  return kept.sort((x, y) => x.t - y.t).map((c) => ({ t: r1(c.t), score: Math.round(c.score * 1000) / 1000 }));
}

export function selectCuts(cands, sens, duration) {
  const thr = THRESHOLDS[sens];
  const out = [];
  for (const c of cands) {
    if (c.score < thr) continue;
    if (c.t < MIN_SCENE || c.t > duration - MIN_SCENE) continue;
    if (out.length && c.t - out[out.length - 1] < MIN_SCENE) continue;
    out.push(c.t);
  }
  return out;
}
