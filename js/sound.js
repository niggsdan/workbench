// Sons sintetizados no navegador (WebAudio). Sem arquivo, sem rede.

const noiseCache = new WeakMap();
function noise(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}
const db = (v) => Math.pow(10, v / 20);

// Toca o som `key` em `when` (segundos do relógio do ctx). Devolve a duração aproximada.
export function playSound(ctx, dest, key, when, volDb = -8, length = 0) {
  const t0 = Math.max(when, ctx.currentTime);
  const out = ctx.createGain(); out.gain.value = db(volDb); out.connect(dest);
  const nz = (dur, type, f0, f1, q = 1) => {
    const s = ctx.createBufferSource(); s.buffer = noise(ctx);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    s.connect(f); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
    return f;
  };
  const env = (node, dur, peakAt = 0.4, peak = 1) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + dur * peakAt); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g); g.connect(out); return g;
  };
  const osc = (type, f0, f1, dur) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05); return o;
  };
  switch (key) {
    case 'whoosh': { env(nz(0.5, 'bandpass', 500, 3200, 1.2), 0.5, 0.45, 1); return 0.5; }
    case 'swoosh': { env(nz(0.5, 'bandpass', 4000, 700, 1.4), 0.5, 0.35, 0.9); return 0.5; }
    case 'riser': {
      env(nz(1.3, 'bandpass', 300, 6000, 2), 1.3, 0.92, 0.8);
      env(osc('sawtooth', 160, 900, 1.3), 1.3, 0.92, 0.12); return 1.3;
    }
    case 'impact': {
      env(osc('sine', 110, 38, 0.55), 0.55, 0.04, 1);
      env(nz(0.18, 'lowpass', 1800, 200, 0.7), 0.18, 0.1, 0.8); return 0.55;
    }
    case 'pop': { env(osc('sine', 700, 220, 0.12), 0.14, 0.15, 0.9); return 0.14; }
    case 'ding': {
      env(osc('sine', 1320, 1316, 1.0), 1.0, 0.02, 0.6); env(osc('sine', 1980, 1975, 0.8), 0.8, 0.02, 0.25); return 1.0;
    }
    case 'projector': {
      const dur = Math.max(1, length || 2);
      const s = ctx.createBufferSource(); s.buffer = noise(ctx); s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 24; const lg = ctx.createGain(); lg.gain.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(out); s.start(t0); lfo.start(t0); s.stop(t0 + dur); lfo.stop(t0 + dur); return dur;
    }
    default: return 0;
  }
}
