// Compositor: desenha um quadro final (reenquadre + efeitos + cor + textura + overlay + texto) num canvas.
// Serve a prévia (Editar e Cor) e o render da Entrega, com o mesmo código.

import { fxState, textureState } from './fx.js';
import { applyGrade, bloom } from './grade.js';

const mk = (w = 2, h = 2) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctx2 = (c) => c.getContext('2d', { willReadFrequently: true });

export const ratioNum = (r) => { const [w, h] = r.split(':').map(Number); return w / h; };
export function outSize(ratio, longSide) {
  const a = ratioNum(ratio);
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return a >= 1 ? { w: even(longSide), h: even(longSide / a) } : { w: even(longSide * a), h: even(longSide) };
}

export class Compositor {
  constructor() {
    this.tiles = [];
    for (let k = 0; k < 4; k++) {
      const c = mk(160, 160); const g = ctx2(c); const im = g.createImageData(160, 160);
      for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0); this.tiles.push(c);
    }
    this.snap = mk(); this.snapId = null;
    this.small = mk(); this.small2 = mk(); this.scratch = mk();
  }

  // cfg: { src, sw, sh, t, ratio, ox, fx(items), fxOn, comps, tex?, overlays: Map, W, H }
  render(canvas, cfg) {
    const { src, sw, sh, W, H } = cfg;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const g = ctx2(canvas);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (!src || !sw || !sh) return { active: [] };

    const items = cfg.fxOn === false ? [] : cfg.fx || [];
    const fx = fxState(items, cfg.t);
    const tex = textureState(items, cfg.t);
    const info = { active: fx.active, fx };

    // retângulo de origem (cobrir) ou quadro inteiro (16:9 com fonte de outra proporção)
    const sa = sw / sh; const ta = W / H;
    let sx = 0; let sy = 0; let cw = sw; let ch = sh; let dx = 0; let dy = 0; let dw = W; let dh = H;
    if (cfg.ratio === '16:9' && Math.abs(sa - ta) > 0.02) {
      if (sa > ta) { dh = W / sa; dy = (H - dh) / 2; } else { dw = H * sa; dx = (W - dw) / 2; }
    } else if (sa > ta) { cw = sh * ta; sx = (sw - cw) * ((cfg.ox == null ? 50 : cfg.ox) / 100); } else { ch = sw / ta; sy = (sh - ch) / 2; }

    // congela / split: guarda o quadro do começo do efeito
    const holdId = fx.freeze !== null ? items.find((i) => i.key === 'freeze' && fx.active.includes(i.id)) : (fx.split ? items.find((i) => i.key === 'split' && fx.active.includes(i.id)) : null);
    if (holdId) {
      if (this.snapId !== holdId.id) {
        this.snap.width = W; this.snap.height = H;
        const sg = ctx2(this.snap); sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H); sg.drawImage(src, sx, sy, cw, ch, dx, dy, dw, dh);
        this.snapId = holdId.id;
      }
    } else this.snapId = null;

    const jit = (tex.jitter || 0) / 100;
    const jx = jit ? (Math.random() - 0.5) * 2 * jit * 0.012 * W : 0; const jy = jit ? (Math.random() - 0.5) * 2 * jit * 0.012 * H : 0;
    const frame = fx.freeze !== null && this.snapId ? null : src;
    const drawOnce = (alpha, ox, oy) => {
      g.save(); g.globalAlpha = alpha;
      g.translate(W / 2 + ox + jx, H / 2 + oy + jy); g.scale(fx.zoom, fx.zoom); g.translate(-W / 2, -H / 2);
      if (frame) g.drawImage(src, sx, sy, cw, ch, dx, dy, dw, dh); else g.drawImage(this.snap, 0, 0);
      g.restore();
    };
    if (fx.blur > 0.02) {
      const n = 9; const amt = fx.blur * 0.2;
      for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5; drawOnce(1 / (i + 1), fx.dir[0] * (u * amt * W) + fx.offset[0] * W, fx.dir[1] * (u * amt * H) + fx.offset[1] * H); }
    } else drawOnce(1, 0, 0);

    if (fx.split && this.snapId) { // metade de baixo: quadro do começo do efeito
      const y = H * fx.split.pos; g.save(); g.beginPath(); g.rect(0, y, W, H - y); g.clip(); g.drawImage(this.snap, 0, 0); g.restore();
      g.fillStyle = '#f0f0f0'; g.fillRect(0, y - 1, W, 2);
    }

    // cor
    const comps = cfg.comps || [];
    const hala = []; let amountExtra = (tex.halation || 0) / 100;
    for (const c of comps) if (c) hala.push(...c.hala);
    const doPix = comps.some((c) => c && c.stages.length) || fx.bw > 0;
    if (doPix) {
      const im = g.getImageData(0, 0, W, H);
      applyGrade(im.data, comps);
      if (fx.bw > 0) { const d = im.data; const k = fx.bw; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; d[i] += (l - d[i]) * k; d[i + 1] += (l - d[i + 1]) * k; d[i + 2] += (l - d[i + 2]) * k; } }
      g.putImageData(im, 0, 0);
    }
    const bl = hala.map((h) => ({ ...h })); if (amountExtra > 0) bl.push({ amount: amountExtra, radius: 0.4, thr: 0.62 });
    for (const h of bl) this.halation(g, canvas, W, H, h);

    // lente e textura
    if (tex.softness) { // suavidade: cópia desfocada por redução
      const sw2 = Math.max(8, W >> 3); const sh2 = Math.max(8, H >> 3);
      this.small.width = sw2; this.small.height = sh2; const s = ctx2(this.small); s.imageSmoothingQuality = 'high'; s.drawImage(canvas, 0, 0, sw2, sh2);
      g.save(); g.globalAlpha = Math.min(0.7, (tex.softness / 100) * 0.7); g.imageSmoothingEnabled = true; g.drawImage(this.small, 0, 0, W, H); g.restore();
    }
    if (tex.tracking) this.tracking(g, canvas, W, H, tex.tracking / 100);
    if (tex.grain) {
      const tile = this.tiles[(Math.random() * 4) | 0]; const sc = Math.max(1, W / 420);
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = Math.min(0.6, (tex.grain / 100) * 0.42);
      const ox = -Math.random() * 160 * sc; const oy = -Math.random() * 160 * sc;
      for (let y = oy; y < H; y += 160 * sc) for (let x = ox; x < W; x += 160 * sc) g.drawImage(tile, x, y, 160 * sc, 160 * sc);
      g.restore();
    }
    if (tex.dust) this.dust(g, W, H, tex.dust / 100);
    if (tex.leak) this.leak(g, W, H, tex.leak / 100, cfg.t);
    if (tex.vignette) {
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.9, (tex.vignette / 100) * 0.9) + ')');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (tex.flicker) { const a = Math.random() * (tex.flicker / 100) * 0.16; g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a * 1.4 + ')'; g.fillRect(0, 0, W, H); }

    // overlays em vídeo (modo Screen)
    for (const it of items) {
      if (it.kind !== 'ov' || cfg.t < it.a || cfg.t >= it.b) continue;
      const v = cfg.overlays && cfg.overlays.get(it.lib);
      if (!v || !v.videoWidth) continue;
      const s = it.params.scale / 100; const oa = v.videoWidth / v.videoHeight;
      let w = W * s; let h = w / oa; if (h < H * s) { h = H * s; w = h * oa; }
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = it.params.opacity / 100; g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h); g.restore();
    }
    // textos
    for (const it of items) if (it.kind === 'tt' && cfg.t >= it.a && cfg.t < it.b) this.text(g, W, H, it);
    // flash por cima de tudo
    if (fx.flash > 0.01) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, fx.flash) + ')'; g.fillRect(0, 0, W, H); }
    return info;
  }

  halation(g, canvas, W, H, h) {
    const w2 = Math.max(16, W >> 3); const h2 = Math.max(16, H >> 3);
    this.small.width = w2; this.small.height = h2;
    const s = ctx2(this.small); s.drawImage(canvas, 0, 0, w2, h2);
    const im = s.getImageData(0, 0, w2, h2);
    const out = bloom({ data: im.data, w: w2, h: h2 }, h.thr, h.radius);
    this.small2.width = w2; this.small2.height = h2;
    const s2 = ctx2(this.small2); const o = s2.createImageData(w2, h2); o.data.set(out); s2.putImageData(o, 0, 0);
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.min(1, h.amount * 1.6); g.imageSmoothingEnabled = true; g.drawImage(this.small2, 0, 0, W, H); g.restore();
  }

  tracking(g, canvas, W, H, k) {
    const sc = this.scratch; sc.width = W; sc.height = H; ctx2(sc).drawImage(canvas, 0, 0);
    const n = 2 + Math.round(k * 4);
    for (let i = 0; i < n; i++) {
      const y = Math.random() * H; const hh = H * (0.01 + Math.random() * 0.04 * k); const d = (Math.random() - 0.5) * W * 0.08 * k;
      g.drawImage(sc, 0, y, W, hh, d, y, W, hh);
    }
    g.save(); g.fillStyle = 'rgba(255,255,255,' + 0.05 * k + ')';
    for (let y = 0; y < H; y += 3) if (Math.random() < 0.5 * k) g.fillRect(0, y, W, 1);
    g.restore();
  }

  dust(g, W, H, k) {
    g.save();
    const n = Math.floor(Math.random() * 12 * k);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W; const y = Math.random() * H;
      g.fillStyle = Math.random() < 0.6 ? 'rgba(255,255,255,' + (0.3 + Math.random() * 0.4) + ')' : 'rgba(0,0,0,' + (0.3 + Math.random() * 0.4) + ')';
      if (Math.random() < 0.35) g.fillRect(x, Math.random() * H * 0.5, Math.max(1, W / 700), H * (0.1 + Math.random() * 0.4)); // risco vertical
      else g.fillRect(x, y, 1 + Math.random() * (W / 300), 1 + Math.random() * (W / 300));
    }
    g.restore();
  }

  leak(g, W, H, k, t) {
    const cx = W * (0.5 + 0.5 * Math.sin(t * 0.7)); const cy = H * 0.1;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(255,150,60,' + 0.7 * k + ')'); gr.addColorStop(0.5, 'rgba(255,70,40,' + 0.25 * k + ')'); gr.addColorStop(1, 'rgba(255,60,40,0)');
    g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  }

  text(g, W, H, it) {
    const fs = Math.round(Math.min(W, H) * (it.key === 'tarja' ? 0.045 : 0.05));
    g.save(); g.textAlign = it.key === 'tarja' ? 'left' : 'center'; g.textBaseline = 'middle';
    const family = "'Plus Jakarta Sans', system-ui, sans-serif";
    if (it.key === 'tarja') {
      const bh = fs * (it.params.sub ? 3.1 : 2.1); const y = H * 0.74;
      g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, y, W, bh);
      g.fillStyle = '#8f1d33'; g.fillRect(0, y, Math.max(4, W * 0.012), bh);
      g.fillStyle = '#fff'; g.font = '800 ' + fs + 'px ' + family; g.fillText(String(it.params.text || ''), W * 0.045, y + bh * (it.params.sub ? 0.34 : 0.5), W * 0.9);
      if (it.params.sub) { g.fillStyle = '#e5e5e5'; g.font = '600 ' + Math.round(fs * 0.7) + 'px ' + family; g.fillText(String(it.params.sub), W * 0.045, y + bh * 0.72, W * 0.9); }
    } else {
      g.font = '800 ' + fs + 'px ' + family;
      const txt = String(it.params.text || ''); const w = Math.min(W * 0.92, g.measureText(txt).width + fs);
      g.fillStyle = 'rgba(0,0,0,.65)'; const y = H * 0.84;
      g.beginPath(); g.roundRect ? g.roundRect(W / 2 - w / 2, y - fs * 0.8, w, fs * 1.6, fs * 0.3) : g.rect(W / 2 - w / 2, y - fs * 0.8, w, fs * 1.6); g.fill();
      g.fillStyle = '#fff'; g.fillText(txt, W / 2, y, W * 0.9);
    }
    g.restore();
  }
}

// reduz um canvas pra RGBA pequeno (scopes e paleta)
export function sampleCanvas(canvas, w = 160) {
  const h = Math.max(2, Math.round((w * canvas.height) / canvas.width));
  const c = sampleCanvas.c || (sampleCanvas.c = mk());
  c.width = w; c.height = h;
  const g = ctx2(c); g.drawImage(canvas, 0, 0, w, h);
  return { data: g.getImageData(0, 0, w, h).data, w, h };
}

// miniatura graduada: rgba (w*h) -> ImageData
export function gradedThumb(t, comps) {
  const d = new Uint8ClampedArray(t.rgba); applyGrade(d, comps);
  return new ImageData(d, t.w, t.h);
}
