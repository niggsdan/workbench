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
    this.small = mk(); this.small2 = mk(); this.scratch = mk(); this.scratch2 = mk();
    this.ring = []; this.ringT = null; this.hold = mk(); this.holdN = 0; this.mosh = mk(); this.moshOk = false; this.stut = { id: null, frames: [], n: 0 };
    this.fishKey = ''; this.fishMap = null;
  }

  // ---------- auxiliares dos efeitos do Eyecandy ----------
  copyTo(c, canvas, W, H) { if (c.width !== W) c.width = W; if (c.height !== H) c.height = H; const g = ctx2(c); g.globalAlpha = 1; g.globalCompositeOperation = 'copy'; g.drawImage(canvas, 0, 0); g.globalCompositeOperation = 'source-over'; return c; }
  ringAt(k) { const i = this.ring.length - 1 - k; return i >= 0 ? this.ring[Math.max(0, i)] : null; }
  pushRing(canvas, W, H, t) {
    if (this.ringT !== null && Math.abs(t - this.ringT) < 1e-4) return;
    this.ringT = t;
    let c = this.ring.length >= 32 ? this.ring.shift() : mk(W, H);
    this.ring.push(this.copyTo(c, canvas, W, H));
  }
  filterPass(g, canvas, W, H, f, alpha = 1) {
    if (alpha <= 0.01) return;
    this.copyTo(this.scratch, canvas, W, H);
    g.save(); g.filter = f; g.globalAlpha = Math.min(1, alpha); g.drawImage(this.scratch, 0, 0); g.restore();
  }
  blurMasked(g, canvas, W, H, px, mask) {
    this.copyTo(this.scratch, canvas, W, H);
    const b = this.scratch2; b.width = W; b.height = H; const bg = ctx2(b);
    bg.filter = 'blur(' + px + 'px)'; bg.drawImage(this.scratch, 0, 0); bg.filter = 'none';
    if (mask) { bg.globalCompositeOperation = 'destination-out'; bg.fillStyle = mask(bg); bg.fillRect(0, 0, W, H); bg.globalCompositeOperation = 'source-over'; }
    g.drawImage(b, 0, 0);
  }
  looksGeo(g, canvas, W, H, looks) {
    for (const L of looks) {
      const a = L.e; const P = L.params; if (a <= 0.01) continue;
      if (L.key === 'kaleido') {
        this.copyTo(this.scratch, canvas, W, H); const n = Math.round(P.n); const R = Math.hypot(W, H);
        const spin = (P.spin / 100) * L.dt * 1.2;
        g.save(); g.globalAlpha = a; g.translate(W / 2, H / 2);
        for (let i = 0; i < n; i++) {
          g.save(); g.rotate(spin + (i * 2 * Math.PI) / n); if (i % 2) g.scale(1, -1);
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / n - 0.01, Math.PI / n + 0.01); g.closePath(); g.clip();
          g.drawImage(this.scratch, -W / 2, -H / 2); g.restore();
        }
        g.restore();
      } else if (L.key === 'dup') {
        this.copyTo(this.scratch, canvas, W, H); const n = Math.round(P.n);
        g.save(); g.globalAlpha = a; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g.drawImage(this.scratch, (x * W) / n, (y * H) / n, W / n, H / n); g.restore();
      } else if (L.key === 'pip') {
        const src = this.ringAt(Math.round(P.delay)) || canvas; const s = P.size / 100; const w = W * s; const h = H * s; const m = Math.min(W, H) * 0.04;
        const c = Math.round(P.pos); const x = c % 2 ? W - w - m : m; const y = c > 1 ? H - h - m : m;
        g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.drawImage(src, x, y, w, h); g.restore();
      } else if (L.key === 'pixel') {
        const sz = Math.max(2, P.size * (W / 640) * a); const sw = Math.max(2, Math.round(W / sz)); const sh = Math.max(2, Math.round(H / sz));
        this.small.width = sw; this.small.height = sh; const sg = ctx2(this.small); sg.imageSmoothingEnabled = true; sg.drawImage(canvas, 0, 0, sw, sh);
        g.save(); g.imageSmoothingEnabled = false; g.drawImage(this.small, 0, 0, W, H); g.restore();
      } else if (L.key === 'fisheye') this.fisheye(g, canvas, W, H, (P.amt / 100) * a);
      else if (L.key === 'tiltshift') {
        const cy = H * P.pos / 100; const band = H * 0.12;
        this.blurMasked(g, canvas, W, H, P.blur * (W / 640) * a, (bg) => { const gr = bg.createLinearGradient(0, 0, 0, H); const f = (y) => Math.min(1, Math.max(0, y / H));
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(f(cy - band * 2.2), 'rgba(0,0,0,0)'); gr.addColorStop(f(cy - band * 0.6), 'rgba(0,0,0,1)'); gr.addColorStop(f(cy + band * 0.6), 'rgba(0,0,0,1)'); gr.addColorStop(f(cy + band * 2.2), 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; });
        this.filterPass(g, canvas, W, H, 'saturate(' + P.sat + '%) contrast(1.06)', a);
      } else if (L.key === 'shallow') {
        const r = Math.min(W, H) * P.size / 100;
        this.blurMasked(g, canvas, W, H, P.blur * (W / 640) * a, (bg) => { const gr = bg.createRadialGradient(W / 2, H * 0.45, r * 0.55, W / 2, H * 0.45, r * 1.25); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; });
      } else if (L.key === 'focal') this.blurMasked(g, canvas, W, H, P.blur * (W / 640) * a, null);
    }
  }
  fisheye(g, canvas, W, H, k) {
    if (k < 0.01) return;
    const key = W + 'x' + H + ':' + Math.round(k * 50);
    if (this.fishKey !== key) {
      const map = new Int32Array(W * H); const cx = W / 2; const cy = H / 2; const R = Math.hypot(cx, cy); const kk = Math.round(k * 50) / 50;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x - cx) / R; const dy = (y - cy) / R; const r = Math.hypot(dx, dy);
        const f = r ? (1 - kk) + kk * Math.pow(r, 1.6) / r * r : 1; const sx = Math.round(cx + dx * f * R); const sy = Math.round(cy + dy * f * R);
        map[y * W + x] = sx >= 0 && sx < W && sy >= 0 && sy < H ? sy * W + sx : -1;
      }
      this.fishKey = key; this.fishMap = map;
    }
    const src = g.getImageData(0, 0, W, H); const out = g.createImageData(W, H); const s = src.data; const o = out.data; const m = this.fishMap;
    for (let i = 0; i < m.length; i++) { const j = m[i]; const p = i * 4; if (j < 0) { o[p + 3] = 255; continue; } const q = j * 4; o[p] = s[q]; o[p + 1] = s[q + 1]; o[p + 2] = s[q + 2]; o[p + 3] = 255; }
    g.putImageData(out, 0, 0);
  }
  looksTime(g, canvas, W, H, looks) {
    for (const L of looks) {
      const a = L.e; const P = L.params;
      if (L.key === 'mblur') { const p = this.ringAt(1); if (p) { g.save(); g.globalAlpha = Math.min(0.92, (P.amt / 100) * a); g.drawImage(p, 0, 0); g.restore(); } }
      else if (L.key === 'echo') { const n = Math.round(P.n); g.save(); g.globalCompositeOperation = 'screen'; for (let k = n; k >= 1; k--) { const p = this.ringAt(k * 2); if (!p) continue; g.globalAlpha = (P.amt / 100) * a * (1 - k / (n + 1)) * 0.7; g.drawImage(p, 0, 0); } g.restore(); }
      else if (L.key === 'double') { const p = this.ringAt(Math.round(P.delay)); if (p) { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = (P.mix / 100) * a; g.drawImage(p, 0, 0); g.restore(); } }
      else if (L.key === 'step') { const h = Math.round(P.hold); if (this.holdN % h === 0 || this.hold.width !== W) this.copyTo(this.hold, canvas, W, H); this.holdN++; g.drawImage(this.hold, 0, 0); }
      else if (L.key === 'stutter') {
        const n = Math.round(P.len); const s = this.stut;
        if (s.id !== L.id) { s.id = L.id; s.frames = []; s.n = 0; }
        if (s.frames.length < n) s.frames.push(this.copyTo(mk(W, H), canvas, W, H));
        else { g.drawImage(s.frames[s.n % n], 0, 0); s.n++; }
      } else if (L.key === 'datamosh') {
        if (!this.moshOk || this.mosh.width !== W || this.mosh.height !== H) { this.copyTo(this.mosh, canvas, W, H); this.moshOk = true; }
        const bs = Math.max(4, Math.round(P.block * (W / 640))); const keep = (P.amt / 100) * a;
        const prev = this.copyTo(this.scratch, this.mosh, W, H);
        const mg = ctx2(this.mosh); mg.drawImage(prev, 0, 0);
        for (let y = 0; y < H; y += bs) for (let x = 0; x < W; x += bs) {
          if (Math.random() > keep) mg.drawImage(canvas, x, y, bs, bs, x, y, bs, bs);
          else if (Math.random() < 0.25) mg.drawImage(prev, x, y, bs, bs, x + (Math.random() - 0.5) * bs * 0.6, y + bs * 0.3, bs, bs);
        }
        g.drawImage(this.mosh, 0, 0);
      }
    }
    if (!looks.some((L) => L.key === 'datamosh')) this.moshOk = false;
    if (!looks.some((L) => L.key === 'step')) this.holdN = 0;
  }
  looksStyle(g, canvas, W, H, looks, t) {
    for (const L of looks) {
      const a = L.e; const P = L.params; if (a <= 0.01) continue; const k = (P.amt != null ? P.amt / 100 : 1);
      if (L.key === 'colorshift') this.filterPass(g, canvas, W, H, 'hue-rotate(' + Math.round(L.dt * P.speed) + 'deg) saturate(' + P.sat + '%)', a);
      else if (L.key === 'hardlight') this.filterPass(g, canvas, W, H, 'contrast(' + (1 + 0.6 * k) + ') saturate(' + (1 + 0.25 * k) + ')', a);
      else if (L.key === 'silhouette') this.filterPass(g, canvas, W, H, 'contrast(' + (1 + 3 * k) + ') brightness(' + (1 - 0.35 * k) + ') saturate(' + (1 - 0.5 * k) + ')', a);
      else if (L.key === 'haze') { this.filterPass(g, canvas, W, H, 'contrast(' + (1 - 0.35 * k) + ') brightness(' + (1 + 0.12 * k) + ')', a); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(235,225,215,' + 0.12 * k * a + ')'; g.fillRect(0, 0, W, H); g.restore(); }
      else if (L.key === 'xray') this.filterPass(g, canvas, W, H, 'grayscale(1) invert(1) contrast(1.45) sepia(.35) hue-rotate(170deg)', a * k);
      else if (L.key === 'night') {
        this.filterPass(g, canvas, W, H, 'grayscale(1) brightness(1.6) contrast(1.25) sepia(1) hue-rotate(55deg) saturate(4)', a * k);
        const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + 0.9 * a + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        const tile = this.tiles[(Math.random() * 4) | 0]; g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.35 * a; for (let y = 0; y < H; y += 160) for (let x = 0; x < W; x += 160) g.drawImage(tile, x, y); g.restore();
      } else if (L.key === 'thermal') {
        const im = g.getImageData(0, 0, W, H); const d = im.data; const m = a * k;
        const pal = [[10, 10, 60], [70, 0, 140], [190, 0, 120], [240, 80, 20], [255, 200, 0], [255, 255, 220]];
        for (let i = 0; i < d.length; i += 4) {
          const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255 * 5; const j = Math.min(4, l | 0); const f = l - j; const c0 = pal[j]; const c1 = pal[j + 1];
          d[i] += (c0[0] + (c1[0] - c0[0]) * f - d[i]) * m; d[i + 1] += (c0[1] + (c1[1] - c0[1]) * f - d[i + 1]) * m; d[i + 2] += (c0[2] + (c1[2] - c0[2]) * f - d[i + 2]) * m;
        }
        g.putImageData(im, 0, 0);
      } else if (L.key === 'glitch') {
        this.copyTo(this.scratch, canvas, W, H); const amt = k * a; const sh = Math.round(W * 0.012 * amt * (0.5 + Math.random()));
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * amt;
        g.filter = 'sepia(1) saturate(8) hue-rotate(-50deg)'; g.drawImage(this.scratch, -sh, 0);
        g.filter = 'sepia(1) saturate(8) hue-rotate(150deg)'; g.drawImage(this.scratch, sh, 0); g.restore();
        const n = Math.round(2 + 8 * amt);
        for (let i = 0; i < n; i++) { const y = Math.random() * H; const h = H * (0.005 + Math.random() * 0.05 * amt); const dx = (Math.random() - 0.5) * W * 0.12 * amt; g.drawImage(this.scratch, 0, y, W, h, dx, y, W, h); }
      } else if (L.key === 'spotlight') {
        const r = Math.min(W, H) * P.r / 100; const gr = g.createRadialGradient(W / 2, H * 0.45, r * 0.6, W / 2, H * 0.45, r * 1.15);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + (P.dark / 100) * a + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      } else if (L.key === 'lightflash') {
        const gr = g.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.8);
        gr.addColorStop(0, 'rgba(255,240,210,' + (P.bright / 100) * a + ')'); gr.addColorStop(1, 'rgba(255,160,80,' + 0.5 * (P.bright / 100) * a + ')');
        g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
      }
    }
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
    let rot = 0; let zm = fx.zoom; let tx = 0; let ty = 0;
    const nz = (x) => Math.sin(x * 1.7) * 0.5 + Math.sin(x * 3.1 + 1.3) * 0.3 + Math.sin(x * 5.3 + 0.4) * 0.2;
    for (const L of fx.looks) {
      const P = L.params; const a = L.e;
      if (L.key === 'dutch') { rot += (P.deg * Math.PI / 180) * a; zm *= 1 + (P.scale / 100 - 1) * a; }
      else if (L.key === 'roll') { const u = L.len ? Math.min(1, L.dt / L.len) : 0; const ez = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; rot += (P.turns / 100) * 2 * Math.PI * ez; zm *= P.scale / 100; }
      else if (L.key === 'handheld') { const sp = 0.5 + 2.5 * P.speed / 100; const k = (P.amt / 100) * a; tx += nz(cfg.t * sp) * W * 0.025 * k; ty += nz(cfg.t * sp + 7) * H * 0.02 * k; rot += nz(cfg.t * sp + 3) * 0.012 * k; zm *= 1 + 0.06 * k; }
      else if (L.key === 'wiggle') { const fi = Math.floor(cfg.t * 30 / Math.max(1, Math.round(P.frames))); tx += (fi % 2 ? 1 : -1) * W * 0.03 * (P.amt / 100) * a; zm *= 1 + 0.08 * a; }
    }
    const drawOnce = (alpha, ox, oy) => {
      g.save(); g.globalAlpha = alpha;
      g.translate(W / 2 + ox + jx + tx, H / 2 + oy + jy + ty); if (rot) g.rotate(rot); g.scale(zm, zm); g.translate(-W / 2, -H / 2);
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

    // efeitos do Eyecandy: tempo e geometria (antes da cor)
    this.pushRing(canvas, W, H, cfg.t);
    if (fx.looks.length) { this.looksTime(g, canvas, W, H, fx.looks); this.looksGeo(g, canvas, W, H, fx.looks); }
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
    if (tex.fade) this.filterPass(g, canvas, W, H, 'sepia(' + (0.35 * tex.fade / 100) + ') saturate(' + (1 - 0.3 * tex.fade / 100) + ') contrast(' + (1 - 0.15 * tex.fade / 100) + ') brightness(' + (1 + 0.05 * tex.fade / 100) + ')', 1);
    if (tex.frame) {
      const k = tex.frame / 100; const m = Math.min(W, H) * (0.015 + 0.05 * k); const rr = Math.min(W, H) * (0.03 + 0.09 * k);
      const wx = jit ? (Math.random() - 0.5) * m * 0.3 : 0;
      g.save(); g.fillStyle = '#060606'; g.beginPath(); g.rect(0, 0, W, H);
      if (g.roundRect) g.roundRect(m + wx, m, W - 2 * m, H - 2 * m, rr); else g.rect(m, m, W - 2 * m, H - 2 * m);
      g.fill('evenodd');
      const gr = g.createLinearGradient(0, 0, m * 3, 0); gr.addColorStop(0, 'rgba(0,0,0,' + 0.5 * k + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, m * 3, H);
      g.restore();
    }
    if (tex.flicker) { const a = Math.random() * (tex.flicker / 100) * 0.16; g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a * 1.4 + ')'; g.fillRect(0, 0, W, H); }

    if (fx.looks.length) this.looksStyle(g, canvas, W, H, fx.looks, cfg.t);
    const rb = fx.looks.find((L) => L.key === 'ratio');
    if (rb) { const h = H * (rb.params.to / 100) / 2 * rb.e; g.fillStyle = '#000'; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h); }
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
