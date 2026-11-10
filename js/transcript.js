// Transcrição, parte pura: ideias, legendas, SRT, motivo do Auto-FX e cortes de pausa.
// segs: [{ a, b, text }] em segundos do vídeo, em ordem.

const r2 = (t) => Math.round(t * 100) / 100;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export const LANGS = [['portuguese', 'Português'], ['english', 'English'], ['spanish', 'Español']];
export const MODELS = [
  { key: 'base', id: 'onnx-community/whisper-base', label: 'Rápida', size: '≈ 80 MB' },
  { key: 'small', id: 'onnx-community/whisper-small', label: 'Precisa', size: '≈ 250 MB' }
];

export function sanitizeTranscript(x) {
  if (!x || !Array.isArray(x.segs)) return null;
  const segs = x.segs.filter((s) => s && Number.isFinite(s.a) && Number.isFinite(s.b) && s.b > s.a && typeof s.text === 'string')
    .map((s) => ({ a: r2(s.a), b: r2(s.b), text: clean(s.text) })).filter((s) => s.text).sort((p, q) => p.a - q.a);
  return { lang: LANGS.some((l) => l[0] === x.lang) ? x.lang : 'portuguese', model: MODELS.some((m) => m.key === x.model) ? x.model : 'base', segs };
}

// Junta os pedaços de cada janela, tira repetições na emenda e limita à duração.
export function mergeChunks(chunks, offset, duration) {
  const out = [];
  for (const c of chunks || []) {
    const ts = c.timestamp || [];
    let a = Number.isFinite(ts[0]) ? ts[0] + offset : null; let b = Number.isFinite(ts[1]) ? ts[1] + offset : null;
    const text = clean(c.text); if (!text || a === null) continue;
    if (b === null || b <= a) b = a + Math.max(0.6, text.split(' ').length * 0.35);
    out.push({ a: r2(Math.max(0, Math.min(duration, a))), b: r2(Math.max(0, Math.min(duration, b))), text });
  }
  return out.filter((s) => s.b > s.a);
}

// Melhor ponto pra cortar a janela: o trecho mais silencioso entre from e to (amostras), em quadros de 20 ms.
export function quietestPoint(samples, rate, from, to) {
  const win = Math.round(rate * 0.02); let best = to; let bestE = Infinity;
  for (let i = Math.max(0, from); i + win <= Math.min(samples.length, to); i += win) {
    let e = 0; for (let k = i; k < i + win; k++) e += samples[k] * samples[k];
    if (e < bestE) { bestE = e; best = i + (win >> 1); }
  }
  return best;
}

// Janelas de até maxS segundos que terminam no silêncio.
export function windows(samples, rate, maxS = 28, minS = 18) {
  const out = []; let s = 0; const n = samples.length;
  while (s < n) {
    if (n - s <= maxS * rate) { out.push([s, n]); break; }
    const e = quietestPoint(samples, rate, s + minS * rate, s + maxS * rate);
    out.push([s, e]); s = e;
  }
  return out;
}

// ---------- ideias ----------
const TARGET = { tiktok: [10, 45], instagram: [10, 60], youtube: [30, 180] };
const STOP = new Set(['e', 'a', 'o', 'as', 'os', 'de', 'da', 'do', 'que', 'aí', 'ai', 'né', 'tipo', 'então', 'entao', 'é', 'um', 'uma', 'pra', 'para']);
export function ideaName(text, n) {
  const words = clean(text).replace(/[.,!?;:“”"]/g, '').split(' ');
  while (words.length > 1 && STOP.has(words[0].toLowerCase())) words.shift();
  const w = words.slice(0, 4).join(' ');
  return (n + 1) + ' · ' + (w.charAt(0).toUpperCase() + w.slice(1));
}

// Agrupa as falas em ideias: corta em pausa longa ou fim de frase, respeitando o tamanho da plataforma, e gruda no corte de cena.
export function ideasFromTranscript(segs, scenes, duration, platform = 'tiktok') {
  if (!segs.length) return [];
  const [minL, maxL] = TARGET[platform] || TARGET.tiktok;
  const cuts = (scenes || []).slice(1).map((s) => s.a);
  const groups = []; let cur = [segs[0]];
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1]; const s = segs[i];
    const len = prev.b - cur[0].a; const gap = s.a - prev.b;
    const sentence = /[.!?…]$/.test(prev.text);
    const nearCut = cuts.some((c) => c > prev.b - 0.6 && c < s.a + 0.6);
    const strong = gap >= 1.2 || (gap >= 0.6 && (sentence || nearCut)) || (sentence && nearCut);
    if ((len >= minL && strong) || s.b - cur[0].a > maxL) { groups.push(cur); cur = [s]; } else cur.push(s);
  }
  groups.push(cur);
  // ideia curta demais vira parte da anterior
  for (let i = groups.length - 1; i > 0; i--) if (groups[i][groups[i].length - 1].b - groups[i][0].a < minL * 0.5) { groups[i - 1].push(...groups[i]); groups.splice(i, 1); }
  const snap = (t) => { const c = cuts.reduce((b, x) => (b === null || Math.abs(x - t) < Math.abs(b - t) ? x : b), null); return c !== null && Math.abs(c - t) <= 0.6 ? c : t; };
  const out = groups.map((g, i) => ({ a: i === 0 ? (g[0].a < 1.5 ? 0 : g[0].a - 0.2) : g[0].a, b: g[g.length - 1].b, text: g.map((s) => s.text).join(' ') }));
  for (let i = 0; i < out.length; i++) {
    out[i].a = r2(i === 0 ? snap(out[i].a) : out[i].a);
    if (i < out.length - 1) { const mid = snap((out[i].b + out[i + 1].a) / 2); out[i].b = r2(mid); out[i + 1].a = r2(mid); } else out[i].b = r2(Math.min(duration, snap(out[i].b + 0.3)));
  }
  return out.filter((x) => x.b - x.a > 0.5).map((x, i) => ({ a: x.a, b: x.b, name: ideaName(x.text, i) }));
}

// ---------- legendas ----------
export function captionsFromTranscript(segs, maxWords = 6, maxChars = 34) {
  const out = [];
  for (const s of segs) {
    const words = clean(s.text).split(' '); const dur = s.b - s.a;
    const lines = []; let cur = [];
    for (const w of words) {
      if (cur.length && (cur.length >= maxWords || (cur.join(' ') + ' ' + w).length > maxChars)) { lines.push(cur); cur = []; }
      cur.push(w);
    }
    if (cur.length) lines.push(cur);
    const total = words.join(' ').length || 1; let t = s.a;
    lines.forEach((l, i) => { const txt = l.join(' '); const d = i === lines.length - 1 ? s.b - t : dur * (txt.length + 1) / (total + lines.length); out.push({ a: r2(t), b: r2(Math.max(t + 0.3, t + d)), text: txt }); t += d; });
  }
  return out;
}

const srtTime = (t) => { const ms = Math.round(t * 1000); const p = (n, k = 2) => String(n).padStart(k, '0'); return p(Math.floor(ms / 3600000)) + ':' + p(Math.floor(ms / 60000) % 60) + ':' + p(Math.floor(ms / 1000) % 60) + ',' + p(ms % 1000, 3); };
export function toSrt(lines) { return lines.map((l, i) => (i + 1) + '\n' + srtTime(l.a) + ' --> ' + srtTime(l.b) + '\n' + l.text + '\n').join('\n'); }

// ---------- Auto-FX ----------
// Frase que termina perto do corte t (pra explicar o "Por que aqui").
export function phraseNear(segs, t) {
  if (!segs || !segs.length) return null;
  let best = null;
  for (const s of segs) if (s.b <= t + 0.4 && s.b >= t - 2.5 && (!best || s.b > best.b)) best = s;
  if (!best) return null;
  const words = best.text.split(' '); const tail = words.slice(-8).join(' ');
  return (words.length > 8 ? '…' : '') + tail.replace(/[.,;:]$/, '');
}
// Pausas longas dentro da fala (candidatas a jump cut).
export function pauses(segs, min = 1.2, maxN = 6) {
  const out = [];
  for (let i = 1; i < segs.length; i++) { const g = segs[i].a - segs[i - 1].b; if (g >= min) out.push({ a: r2(segs[i - 1].b + 0.15), b: r2(segs[i].a - 0.1), gap: g }); }
  return out.sort((p, q) => q.gap - p.gap).slice(0, maxN).sort((p, q) => p.a - q.a).filter((p) => p.b - p.a > 0.3);
}
