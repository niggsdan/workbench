// Motor de cor, parte pura (sem DOM): grade por nós, qualificadores, curvas, LUT .cube, paleta e scopes.
// Trabalha em Uint8ClampedArray RGBA, o mesmo formato do canvas.

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { if (a === b) return x < a ? 0 : 1; const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------- rodas (puck x,y em [-1,1] -> deslocamento por canal) ----------
const PHI = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
export const WHEEL_K = { lift: 0.25, gamma: 0.6, gain: 0.5, offset: 0.15 };
export const puckToVec = (p, k = 1) => PHI.map((f) => k * (p[0] * Math.cos(f) + p[1] * Math.sin(f)));
export function vecToPuck(v, k = 1) {
  let x = 0; let y = 0;
  for (let i = 0; i < 3; i++) { x += v[i] * Math.cos(PHI[i]); y += v[i] * Math.sin(PHI[i]); }
  const px = (2 * x) / (3 * k); const py = (2 * y) / (3 * k);
  const r = Math.hypot(px, py);
  return r > 1 ? [px / r, py / r] : [px, py];
}

// ---------- modelo de grade ----------
export const defaultPrim = () => ({ lift: [0, 0], gamma: [0, 0], gain: [0, 0], offset: [0, 0], contrast: 1, pivot: 0.435, temp: 0, tint: 0, sat: 100, hi: 0, sh: 0 });
export const defaultCurve = () => [[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1]];
export const defaultQual = (kind) => ({
  range: kind === 'ceu' ? { h: [190, 230], s: [18, 80], l: [45, 95] } : { h: [8, 28], s: [22, 70], l: [28, 82] },
  soft: 0.35, adj: { hue: 0, sat: 0, lum: 0 }
});
export const defaultHala = () => ({ amount: 0, radius: 0.4, thr: 0.62 });

let nid = 0;
export const newNode = (kind, extra = {}) => {
  const base = { id: 'n' + (++nid) + '_' + Math.random().toString(36).slice(2, 5), kind, on: true, name: '' };
  if (kind === 'prim') Object.assign(base, { prim: defaultPrim(), lut: null });
  if (kind === 'curve') Object.assign(base, { pts: defaultCurve() });
  if (kind === 'qual') Object.assign(base, defaultQual(extra.sub), { sub: extra.sub || 'pele' });
  if (kind === 'hala') Object.assign(base, defaultHala());
  return Object.assign(base, extra.name ? { name: extra.name } : {});
};

// Topologia: serial -> paralelo (somado no Mixer) -> pós (camadas). Entrada e Saída são fixas.
export function defaultGrade() {
  return {
    serial: [newNode('prim', { name: 'N1 · Primária' }), newNode('curve', { name: 'N2 · Curvas' })],
    par: [newNode('qual', { sub: 'pele', name: 'N3 · Pele' }), newNode('qual', { sub: 'ceu', name: 'N4 · Céu' })],
    post: [newNode('hala', { name: 'N5 · Halation' })]
  };
}
export const allNodes = (g) => [...g.serial, ...g.par, ...g.post];
export const findNode = (g, id) => allNodes(g).find((n) => n.id === id) || null;
export const cloneGrade = clone;

export function isNeutralPrim(p) {
  const z = (a) => !a[0] && !a[1];
  return z(p.lift) && z(p.gamma) && z(p.gain) && z(p.offset) && p.contrast === 1 && !p.temp && !p.tint && p.sat === 100 && !p.hi && !p.sh;
}

// ---------- matemática por canal ----------
function primFn(p, ch) {
  const lift = puckToVec(p.lift, WHEEL_K.lift)[ch];
  const gamma = puckToVec(p.gamma, WHEEL_K.gamma)[ch];
  const gain = puckToVec(p.gain, WHEEL_K.gain)[ch];
  const off = puckToVec(p.offset, WHEEL_K.offset)[ch];
  const tempS = (p.temp / 1000) * 0.6;
  const tintS = (p.tint / 100) * 0.15;
  const mul = ch === 0 ? 1 + tempS + tintS * 0.5 : ch === 2 ? 1 - tempS + tintS * 0.5 : 1 - tintS;
  const ig = 1 / Math.max(0.2, 1 + gamma);
  return (c) => {
    let x = c + off;
    x += lift * (1 - x);
    x *= 1 + gain;
    x = x < 0 ? 0 : Math.pow(x, ig);
    x *= mul;
    return p.pivot + (x - p.pivot) * p.contrast;
  };
}

const lutOf = (fn) => { const o = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) o[i] = Math.round(clamp(fn(i / 255)) * 255); return o; };

// curva monótona (Fritsch–Carlson)
export function curveFn(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  const n = p.length;
  if (n < 2) return (x) => x;
  const dx = []; const m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0] || 1e-6); m.push((p[i + 1][1] - p[i][1]) / dx[i]); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  return (x) => {
    if (x <= p[0][0]) return p[0][1];
    if (x >= p[n - 1][0]) return p[n - 1][1];
    let i = 0; while (x > p[i + 1][0]) i++;
    const h = dx[i]; const s = (x - p[i][0]) / h;
    const s2 = s * s; const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p[i][1] + (s3 - 2 * s2 + s) * h * t[i] + (-2 * s3 + 3 * s2) * p[i + 1][1] + (s3 - s2) * h * t[i + 1];
  };
}

// ---------- HSL ----------
export function rgb2hsl(r, g, b) {
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  let h = 0; let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function hsl2rgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const hh = (((h % 360) + 360) % 360) / 360;
  return [f(hh + 1 / 3), f(hh), f(hh - 1 / 3)];
}

const box = (v, lo, hi, soft) => { const w = Math.max(1e-4, (hi - lo) * soft * 0.5); return smooth(lo - w, lo, v) * (1 - smooth(hi, hi + w, v)); };
function hueMask(h, lo, hi, soft) {
  const c = (lo + hi) / 2; const half = (hi - lo) / 2;
  let d = Math.abs(h - c); if (d > 180) d = 360 - d;
  const w = Math.max(1e-3, half * soft);
  return 1 - smooth(half, half + w, d);
}

// ---------- estágios (alteram o buffer no lugar) ----------
function stageLUT(d, lr, lg, lb) {
  for (let i = 0; i < d.length; i += 4) { d[i] = lr[d[i]]; d[i + 1] = lg[d[i + 1]]; d[i + 2] = lb[d[i + 2]]; }
}
function stageSHS(d, sat, hi, sh) {
  const s = sat / 100; const hw = (hi / 100) * 0.25; const sw = (sh / 100) * 0.25;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255; const g = d[i + 1] / 255; const b = d[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const add = (1 - smooth(0, 0.5, l)) * sw + smooth(0.5, 1, l) * hw;
    d[i] = (l + (r - l) * s + add) * 255; d[i + 1] = (l + (g - l) * s + add) * 255; d[i + 2] = (l + (b - l) * s + add) * 255;
  }
}
function qualDelta(r, g, b, q) {
  const [h, s, l] = rgb2hsl(r, g, b);
  const m = hueMask(h, q.range.h[0], q.range.h[1], q.soft) * box(s * 100, q.range.s[0], q.range.s[1], q.soft) * box(l * 100, q.range.l[0], q.range.l[1], q.soft);
  if (m < 0.002) return null;
  const [rr, gg, bb] = hsl2rgb(h + q.adj.hue, clamp(s * (1 + q.adj.sat / 100)), clamp(l + (q.adj.lum / 100) * 0.5));
  return [(rr - r) * m, (gg - g) * m, (bb - b) * m];
}
function stagePar(d, qs) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255; const g = d[i + 1] / 255; const b = d[i + 2] / 255;
    let dr = 0; let dg = 0; let db = 0;
    for (const q of qs) { const x = qualDelta(r, g, b, q); if (x) { dr += x[0]; dg += x[1]; db += x[2]; } }
    if (dr || dg || db) { d[i] = (r + dr) * 255; d[i + 1] = (g + dg) * 255; d[i + 2] = (b + db) * 255; }
  }
}

// ---------- LUT 3D (.cube) ----------
export function parseCube(text) {
  let size = 0; let title = ''; let lo = [0, 0, 0]; let hi = [1, 1, 1];
  const vals = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    if (/^TITLE/i.test(line)) { title = line.replace(/^TITLE\s*/i, '').replace(/^"|"$/g, ''); continue; }
    if (/^LUT_1D_SIZE/i.test(line)) throw new Error('LUT 1D ainda não é aceita. Use uma LUT 3D (.cube).');
    if (/^LUT_3D_SIZE/i.test(line)) { size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (/^DOMAIN_MIN/i.test(line)) { lo = line.split(/\s+/).slice(1).map(Number); continue; }
    if (/^DOMAIN_MAX/i.test(line)) { hi = line.split(/\s+/).slice(1).map(Number); continue; }
    const p = line.split(/\s+/).map(Number);
    if (p.length === 3 && p.every(Number.isFinite)) vals.push(p[0], p[1], p[2]);
  }
  if (!size || size < 2) throw new Error('Esse .cube não tem LUT_3D_SIZE.');
  if (vals.length !== size * size * size * 3) throw new Error('O .cube está incompleto (esperava ' + size ** 3 + ' linhas).');
  const table = new Float32Array(vals.length);
  for (let i = 0; i < vals.length; i++) { const c = i % 3; table[i] = clamp((vals[i] - lo[c]) / (hi[c] - lo[c] || 1)); }
  return { size, table, title };
}

function cubeStage(d, cube, amount = 1) {
  const n = cube.size; const t = cube.table; const m = n - 1;
  for (let i = 0; i < d.length; i += 4) {
    const fr = (d[i] / 255) * m; const fg = (d[i + 1] / 255) * m; const fb = (d[i + 2] / 255) * m;
    const r0 = Math.min(m - 1, fr | 0); const g0 = Math.min(m - 1, fg | 0); const b0 = Math.min(m - 1, fb | 0);
    const rr = fr - r0; const gg = fg - g0; const bb = fb - b0;
    const at = (r, g, b) => ((b * n + g) * n + r) * 3;
    const o = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const c000 = t[at(r0, g0, b0) + c]; const c100 = t[at(r0 + 1, g0, b0) + c]; const c010 = t[at(r0, g0 + 1, b0) + c]; const c110 = t[at(r0 + 1, g0 + 1, b0) + c];
      const c001 = t[at(r0, g0, b0 + 1) + c]; const c101 = t[at(r0 + 1, g0, b0 + 1) + c]; const c011 = t[at(r0, g0 + 1, b0 + 1) + c]; const c111 = t[at(r0 + 1, g0 + 1, b0 + 1) + c];
      const x00 = c000 + (c100 - c000) * rr; const x10 = c010 + (c110 - c010) * rr; const x01 = c001 + (c101 - c001) * rr; const x11 = c011 + (c111 - c011) * rr;
      const y0 = x00 + (x10 - x00) * gg; const y1 = x01 + (x11 - x01) * gg;
      o[c] = y0 + (y1 - y0) * bb;
    }
    d[i] = (d[i] + (o[0] * 255 - d[i]) * amount); d[i + 1] = (d[i + 1] + (o[1] * 255 - d[i + 1]) * amount); d[i + 2] = (d[i + 2] + (o[2] * 255 - d[i + 2]) * amount);
  }
}

// ---------- compilar e aplicar ----------
// cubes: { nomeDaLut: cube }. Devolve { stages, hala, neutral }.
export function compileGrade(g, cubes = {}) {
  const stages = []; const hala = [];
  const addNode = (n) => {
    if (!n.on) return;
    if (n.kind === 'prim') {
      const p = n.prim;
      if (!(isNeutralPrim(p))) {
        const f = [0, 1, 2].map((c) => primFn(p, c));
        const [lr, lg, lb] = f.map(lutOf);
        stages.push((d) => stageLUT(d, lr, lg, lb));
        if (p.sat !== 100 || p.hi || p.sh) stages.push((d) => stageSHS(d, p.sat, p.hi, p.sh));
      }
      const cube = n.lut && cubes[n.lut];
      if (cube) stages.push((d) => cubeStage(d, cube));
    } else if (n.kind === 'curve') {
      const id = n.pts.every(([x, y]) => Math.abs(x - y) < 1e-3);
      if (!id) { const l = lutOf(curveFn(n.pts)); stages.push((d) => stageLUT(d, l, l, l)); }
    } else if (n.kind === 'hala') {
      if (n.amount > 0) hala.push({ amount: n.amount, radius: n.radius, thr: n.thr });
    }
  };
  g.serial.forEach(addNode);
  const qs = g.par.filter((n) => n.on && n.kind === 'qual' && (n.adj.hue || n.adj.sat || n.adj.lum));
  if (qs.length) stages.push((d) => stagePar(d, qs));
  g.post.forEach(addNode);
  return { stages, hala, neutral: !stages.length && !hala.length };
}

export function applyGrade(d, comps) {
  for (const c of comps) if (c) for (const s of c.stages) s(d);
}

// Assa a grade numa LUT 3D identidade (sem halation) e devolve o texto .cube.
export function bakeCube(comps, size = 33, title = 'Workbench') {
  const n = size; const d = new Uint8ClampedArray(n * n * n * 4);
  let k = 0;
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    d[k++] = Math.round((r / (n - 1)) * 255); d[k++] = Math.round((g / (n - 1)) * 255); d[k++] = Math.round((b / (n - 1)) * 255); d[k++] = 255;
  }
  applyGrade(d, comps);
  const out = ['TITLE "' + title + '"', 'LUT_3D_SIZE ' + n, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0', ''];
  for (let i = 0; i < d.length; i += 4) out.push((d[i] / 255).toFixed(6) + ' ' + (d[i + 1] / 255).toFixed(6) + ' ' + (d[i + 2] / 255).toFixed(6));
  return out.join('\n') + '\n';
}

// ---------- halation (brilho nas luzes) ----------
// small: { data, w, h } RGBA reduzido. Devolve RGBA só com o brilho (pra compor em "screen").
export function bloom(small, thr, radius) {
  const { data, w, h } = small; const n = w * h;
  const buf = new Float32Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const l = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) / 255;
    const v = clamp((l - thr) / Math.max(0.05, 1 - thr));
    buf[i * 3] = v; buf[i * 3 + 1] = v * 0.38; buf[i * 3 + 2] = v * 0.18;
  }
  const r = Math.max(1, Math.round(radius * w * 0.18));
  let a = buf; let b = new Float32Array(buf.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) { // horizontal
      let acc = 0; for (let x = -r; x <= r; x++) acc += a[(y * w + clamp(x, 0, w - 1)) * 3 + c];
      for (let x = 0; x < w; x++) { b[(y * w + x) * 3 + c] = acc / (2 * r + 1); acc += a[(y * w + Math.min(w - 1, x + r + 1)) * 3 + c] - a[(y * w + Math.max(0, x - r)) * 3 + c]; }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) { // vertical
      let acc = 0; for (let y = -r; y <= r; y++) acc += a[(clamp(y, 0, h - 1) * w + x) * 3 + c];
      for (let y = 0; y < h; y++) { b[(y * w + x) * 3 + c] = acc / (2 * r + 1); acc += a[(Math.min(h - 1, y + r + 1) * w + x) * 3 + c] - a[(Math.max(0, y - r) * w + x) * 3 + c]; }
    }
    [a, b] = [b, a];
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { out[i * 4] = a[i * 3] * 255; out[i * 4 + 1] = a[i * 3 + 1] * 255; out[i * 4 + 2] = a[i * 3 + 2] * 255; out[i * 4 + 3] = 255; }
  return out;
}

// ---------- paleta ----------
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Claros / Médios / Escuros, 6 cores cada.
export function extractPalette(rgba, per = 6) {
  const bands = [new Map(), new Map(), new Map()];
  for (let i = 0; i < rgba.length; i += 16) { // amostra 1 a cada 4 pixels
    const r = rgba[i]; const g = rgba[i + 1]; const b = rgba[i + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const band = l >= 0.6 ? 0 : l >= 0.28 ? 1 : 2;
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const e = bands[band].get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; bands[band].set(key, e);
  }
  return bands.map((m) => {
    const list = [...m.values()].sort((a, b) => b.n - a.n).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
    const pick = [];
    for (const c of list) {
      if (pick.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 28)) pick.push(c);
      if (pick.length === per) break;
    }
    for (const c of list) { if (pick.length >= per) break; if (!pick.includes(c)) pick.push(c); }
    return pick.map((c) => hex(...c));
  });
}
const avg = (cols) => { const a = [0, 0, 0]; if (!cols.length) return [128, 128, 128]; for (const c of cols) { const r = hexToRgb(c); a[0] += r[0]; a[1] += r[1]; a[2] += r[2]; } return a.map((v) => v / cols.length); };

// Compara a paleta atual com a de referência e devolve uma Primária de partida (lift, gain, gamma).
export function primFromPalettes(cur, ref) {
  const [cl, cm, cd] = cur.map(avg); const [rl, rm, rd] = ref.map(avg);
  const gain = [0, 1, 2].map((c) => clamp(rl[c] / Math.max(20, cl[c]) - 1, -0.4, 0.4));
  const lift = [0, 1, 2].map((c) => clamp((rd[c] - cd[c]) / 255, -0.12, 0.12));
  const mg = [0, 1, 2].map((c) => clamp(Math.log(Math.max(0.05, rm[c] / 255)) / Math.log(Math.max(0.05, cm[c] / 255)) - 1, -0.5, 0.5));
  const zm = (v) => { const m = (v[0] + v[1] + v[2]) / 3; return v.map((x) => x - m); };
  const p = defaultPrim();
  p.gain = vecToPuck(zm(gain), WHEEL_K.gain);
  p.lift = vecToPuck(zm(lift), WHEEL_K.lift);
  p.gamma = vecToPuck(zm(mg.map((x) => -x)), WHEEL_K.gamma);
  return p;
}

// ---------- scopes ----------
export function histogram(rgba, bins = 64) {
  const h = [new Uint32Array(bins), new Uint32Array(bins), new Uint32Array(bins), new Uint32Array(bins)];
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]; const g = rgba[i + 1]; const b = rgba[i + 2];
    h[0][(r * bins) >> 8]++; h[1][(g * bins) >> 8]++; h[2][(b * bins) >> 8]++;
    h[3][(((0.2126 * r + 0.7152 * g + 0.0722 * b) | 0) * bins) >> 8]++;
  }
  return h;
}
// Waveform de luma: grade cols x rows com contagem.
export function waveform(rgba, w, h, cols = 120, rows = 64) {
  const g = new Uint16Array(cols * rows);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const l = (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
    const cx = Math.min(cols - 1, ((x * cols) / w) | 0); const cy = rows - 1 - Math.min(rows - 1, (l * rows) | 0);
    g[cy * cols + cx]++;
  }
  return { grid: g, cols, rows };
}
// Vectorscope (Cb/Cr).
export function vectorscope(rgba, size = 64) {
  const g = new Uint16Array(size * size);
  for (let i = 0; i < rgba.length; i += 8) {
    const r = rgba[i] / 255; const gg = rgba[i + 1] / 255; const b = rgba[i + 2] / 255;
    const y = 0.299 * r + 0.587 * gg + 0.114 * b;
    const cb = (b - y) * 0.564; const cr = (r - y) * 0.713; // -0.5..0.5
    const x = clamp(Math.round((cb + 0.5) * (size - 1)), 0, size - 1); const yy = clamp(Math.round((0.5 - cr) * (size - 1)), 0, size - 1);
    g[yy * size + x]++;
  }
  return { grid: g, size };
}
