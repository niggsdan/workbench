// Sequência multitrilha: faixas de vídeo (V1, V2…) e de áudio (A1, A2…), clipes com
// início na sequência (start), ponto de entrada na mídia (in) e duração (dur).
// A parte de cima é pura (testável); o player no fim segue um relógio próprio e
// faz cada <video>/<audio> acompanhar o tempo da sequência.
const r2 = (x) => Math.round(x * 100) / 100;
let n = 0;
const nid = () => 'c' + Date.now().toString(36) + (++n);

export function newSeq(w = 1080, h = 1920, fps = 30) { return { w, h, fps, tracks: [{ id: 'V1', kind: 'video' }, { id: 'A1', kind: 'audio' }], clips: [] }; }

export function sanitizeSeq(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.tracks) || !Array.isArray(x.clips)) return null;
  const s = newSeq(+x.w > 0 ? Math.round(+x.w) : 1080, +x.h > 0 ? Math.round(+x.h) : 1920, +x.fps > 0 ? +x.fps : 30);
  s.tracks = x.tracks.filter((t) => t && /^[VA]\d+$/.test(t.id)).map((t) => ({ id: t.id, kind: t.id[0] === 'V' ? 'video' : 'audio' }));
  if (!s.tracks.some((t) => t.kind === 'video')) s.tracks.unshift({ id: 'V1', kind: 'video' });
  if (!s.tracks.some((t) => t.kind === 'audio')) s.tracks.push({ id: 'A1', kind: 'audio' });
  const ok = new Set(s.tracks.map((t) => t.id));
  s.clips = x.clips.filter((c) => c && ok.has(c.track) && typeof c.lib === 'string' && [c.start, c.in, c.dur].every(Number.isFinite) && c.dur > 0)
    .map((c) => ({ id: c.id || nid(), track: c.track, lib: c.lib, name: String(c.name || ''), kind: ['video', 'audio', 'image'].includes(c.kind) ? c.kind : 'video', start: Math.max(0, c.start), in: Math.max(0, c.in), dur: c.dur, src: Number.isFinite(c.src) ? c.src : 0 }));
  return s;
}

export const seqEnd = (s) => (s && s.clips.length ? Math.max(...s.clips.map((c) => c.start + c.dur)) : 0);
export const trackNum = (id) => +id.slice(1);
export const tracksOf = (s, kind) => s.tracks.filter((t) => t.kind === kind).sort((a, b) => trackNum(a.id) - trackNum(b.id));
const inside = (c, t) => t >= c.start - 1e-6 && t < c.start + c.dur - 1e-6;
export const clipsAt = (s, t) => s.clips.filter((c) => inside(c, t));
// vídeo de cima vence (V2 cobre V1), como no Premiere
export function topVideoAt(s, t) {
  let best = null;
  for (const c of s.clips) if (c.track[0] === 'V' && inside(c, t) && (!best || trackNum(c.track) > trackNum(best.track))) best = c;
  return best;
}
const overlaps = (s, track, a, b, except) => s.clips.some((c) => c.id !== except && c.track === track && a < c.start + c.dur - 1e-6 && b > c.start + 1e-6);

export function addTrack(s, kind) {
  const L = kind === 'video' ? 'V' : 'A'; const k = Math.max(0, ...s.tracks.filter((t) => t.kind === kind).map((t) => trackNum(t.id))) + 1;
  const t = { id: L + k, kind }; s.tracks.push(t); return t.id;
}

// põe um clipe; se a faixa pedida está ocupada nesse trecho, cria faixa nova (nada se apaga)
export function addClip(s, { lib, name, kind, dur, start = null, track = null, src = 0 }) {
  const want = kind === 'audio' ? 'audio' : 'video';
  if (!track || !s.tracks.some((t) => t.id === track && t.kind === want)) track = tracksOf(s, want)[0].id;
  if (start === null) start = s.clips.filter((c) => c.track === track).reduce((m, c) => Math.max(m, c.start + c.dur), 0);
  start = r2(Math.max(0, start));
  if (overlaps(s, track, start, start + dur)) track = tracksOf(s, want).find((t) => !overlaps(s, t.id, start, start + dur))?.id || addTrack(s, want);
  const c = { id: nid(), track, lib, name, kind, start, in: 0, dur: r2(dur), src: src || dur };
  s.clips.push(c); return c;
}

export function moveClip(s, id, start, track) {
  const c = s.clips.find((x) => x.id === id); if (!c) return s;
  const want = c.kind === 'audio' ? 'A' : 'V';
  if (track && track[0] === want && s.tracks.some((t) => t.id === track)) c.track = track;
  c.start = r2(Math.max(0, start));
  return s;
}

// corta uma ponta: side 'l' mexe no início (e no ponto de entrada), 'r' no fim
export function trimClip(s, id, side, t) {
  const c = s.clips.find((x) => x.id === id); if (!c) return s;
  const max = c.kind === 'image' ? 3600 : (c.src || c.in + c.dur);
  if (side === 'l') {
    const end = c.start + c.dur; let ns = Math.min(t, end - 0.1); ns = Math.max(ns, c.start - c.in, 0);
    c.in = r2(c.in + ns - c.start); c.start = r2(ns); c.dur = r2(end - ns);
  } else {
    c.dur = r2(Math.max(0.1, Math.min(t - c.start, max - c.in)));
  }
  return s;
}

export function splitClip(s, id, t) {
  const c = s.clips.find((x) => x.id === id); if (!c || !(t > c.start + 0.05 && t < c.start + c.dur - 0.05)) return null;
  const d1 = r2(t - c.start); const b = { ...c, id: nid(), start: r2(t), in: r2(c.in + d1), dur: r2(c.dur - d1) };
  c.dur = d1; s.clips.push(b); return b;
}

export function removeClip(s, id) { s.clips = s.clips.filter((c) => c.id !== id); return s; }

// faixas vazias além da primeira de cada tipo somem
export function tidy(s) {
  s.tracks = s.tracks.filter((t) => s.clips.some((c) => c.track === t.id) || tracksOf(s, t.kind)[0].id === t.id);
  return s;
}

// ---------- player ----------
// Relógio de parede: o tempo da sequência anda sozinho e cada mídia segue esse tempo
// (corrige se escorregar mais de 0,25 s). Assim os buracos e as trocas de clipe funcionam.
export class Player {
  constructor({ primary, getSeq, getEl, rate = () => 1, onState = () => {} }) {
    Object.assign(this, { primary, getSeq, getEl, rate, onState });
    this.t = 0; this.playing = false; this.w0 = 0; this.t0 = 0; this.active = null;
  }
  now() {
    if (!this.playing) return this.t;
    const p = performance.now(); this.t = this.t0 + (p - this.w0) / 1000 * this.rate(); this.t0 = this.t; this.w0 = p;
    return this.t;
  }
  seek(t) { this.t = Math.max(0, t); this.t0 = this.t; this.w0 = performance.now(); this.sync(true); }
  play() {
    const s = this.getSeq(); if (!s) return;
    if (this.t >= seqEnd(s) - 0.05) this.t = 0;
    this.playing = true; this.t0 = this.t; this.w0 = performance.now(); this.sync(true); this.onState(true);
  }
  pause() { if (!this.playing) return; this.now(); this.playing = false; this.sync(true); this.onState(false); }
  get paused() { return !this.playing; }
  // avança e devolve o tempo; para no fim da sequência
  step() {
    const s = this.getSeq(); if (!s) return this.t;
    const t = this.now();
    if (this.playing && t >= seqEnd(s)) { this.t = seqEnd(s); this.pause(); return this.t; }
    this.sync(false); return this.t;
  }
  jump(t) { this.t = t; this.t0 = t; this.w0 = performance.now(); this.sync(true); }
  // fonte da imagem agora: { el, sw, sh } ou null (buraco)
  source(t = this.t) {
    const s = this.getSeq(); if (!s) return null;
    const c = topVideoAt(s, t); const el = c && this.getEl(c);
    if (!el) { // buraco ou mídia carregando: quadro preto no tamanho da sequência (texto e efeitos continuam)
      const b = this.blank || (this.blank = document.createElement('canvas')); const bw = Math.max(2, Math.round(s.w / 20)); const bh = Math.max(2, Math.round(s.h / 20));
      if (b.width !== bw || b.height !== bh) { b.width = bw; b.height = bh; const g = b.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, bw, bh); }
      return { el: b, sw: bw, sh: bh, clip: null };
    }
    const sw = el.videoWidth || el.naturalWidth || 0; const sh = el.videoHeight || el.naturalHeight || 0;
    return sw && sh ? { el, sw, sh, clip: c } : null;
  }
  sync(hard) {
    const s = this.getSeq(); if (!s) return;
    const t = this.t; const live = new Set();
    const top = topVideoAt(s, t);
    const want = s.clips.filter((c) => inside(c, t) && (c.kind === 'audio' || c === top));
    for (const c of want) {
      const el = this.getEl(c); if (!el || el instanceof HTMLImageElement) continue; live.add(el);
      const local = c.in + (t - c.start);
      if (hard || Math.abs(el.currentTime - local) > 0.25) { try { el.currentTime = local; } catch (e) { /* ainda carregando */ } }
      const r = Math.min(4, Math.max(0.25, this.rate())); if (Math.abs(el.playbackRate - r) > 0.01) el.playbackRate = r;
      if (this.playing && el.paused) el.play().catch(() => {});
      if (!this.playing && !el.paused) el.pause();
    }
    for (const el of this.allEls()) if (!live.has(el) && !el.paused) el.pause();
    this.active = top;
  }
  allEls() { return [this.primary, ...(this.pool ? this.pool.values() : [])].filter((el) => el && !(el instanceof HTMLImageElement)); }
}
