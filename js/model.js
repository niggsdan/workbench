// Estado de edição além das cenas: efeitos, texturas, grade por grupo de cenas, ideias, estilo.
// Tudo puro: cada operação recebe o estado e devolve um novo.

import { defaultGrade, cloneGrade } from './grade.js';
import { newId } from './fx.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const r2 = (t) => Math.round(t * 100) / 100;

export const DEFAULT_CINEMA = [
  { key: 'cdd', name: 'CIDADE DE DEUS', dir: 'Dir. Fernando Meirelles', state: 'use' },
  { key: 'aflp', name: 'AMOR À FLOR DA PELE', dir: 'Dir. Wong Kar-wai', state: 'use' },
  { key: 'moon', name: 'MOONLIGHT', dir: 'Dir. Barry Jenkins', state: 'saved' }
];

export function newEdit() {
  return {
    fx: [], ideas: [],
    gb: [], grades: [defaultGrade()], // grupos de cena (G1..Gn): gb são os cortes entre grupos
    general: { on: true, grade: defaultGrade() },
    platform: 'tiktok', container: 'mp4',
    cinema: clone(DEFAULT_CINEMA),
    refPal: null, // paleta de referência anotada pelo usuário (3 listas de hex)
    briefing: { name: '', notes: '' },
    stills: [] // { id, label, group, url }
  };
}

export function sanitizeEdit(x) {
  const d = newEdit();
  if (!x || typeof x !== 'object') return d;
  const okGrade = (g) => g && Array.isArray(g.serial) && Array.isArray(g.par) && Array.isArray(g.post);
  if (Array.isArray(x.fx)) d.fx = x.fx.filter((f) => f && typeof f.id === 'string' && num(f.a) && num(f.b) && f.b >= f.a && typeof f.kind === 'string' && f.params && typeof f.params === 'object').map((f) => ({ kf: [], sfx: null, why: '', auto: false, accepted: true, ...f }));
  if (Array.isArray(x.ideas)) d.ideas = x.ideas.filter((i) => i && num(i.a) && num(i.b) && i.b > i.a).map((i) => ({ id: i.id || newId(), a: i.a, b: i.b, name: String(i.name || 'Ideia') }));
  if (Array.isArray(x.gb) && x.gb.every(num) && Array.isArray(x.grades) && x.grades.length === x.gb.length + 1 && x.grades.every(okGrade)) { d.gb = x.gb; d.grades = x.grades; }
  if (x.general && okGrade(x.general.grade)) d.general = { on: x.general.on !== false, grade: x.general.grade };
  if (['youtube', 'tiktok', 'instagram'].includes(x.platform)) d.platform = x.platform;
  if (x.container === 'mov') d.container = 'mov';
  if (Array.isArray(x.cinema) && x.cinema.every((c) => c && typeof c.key === 'string' && typeof c.name === 'string')) d.cinema = x.cinema.map((c) => ({ dir: '', ...c, state: c.state === 'use' ? 'use' : 'saved' }));
  if (Array.isArray(x.refPal) && x.refPal.length === 3 && x.refPal.every((l) => Array.isArray(l) && l.every((h) => /^#[0-9a-f]{6}$/i.test(h)))) d.refPal = x.refPal;
  if (x.briefing && typeof x.briefing === 'object') d.briefing = { name: String(x.briefing.name || ''), notes: String(x.briefing.notes || '') };
  if (Array.isArray(x.stills)) d.stills = x.stills.filter((s) => s && typeof s.url === 'string' && s.url.startsWith('data:image/')).slice(0, 24);
  return d;
}

// ---------- grupos de cena (G1..Gn) ----------
export const groupAt = (edit, t) => { let i = 0; while (i < edit.gb.length && t >= edit.gb[i] - 1e-6) i++; return i; };
export const groupRange = (edit, i, duration) => [i === 0 ? 0 : edit.gb[i - 1], i < edit.gb.length ? edit.gb[i] : duration];
export const groupCount = (edit) => edit.gb.length + 1;

// Junta cenas vizinhas de cor parecida. colors: [[r,g,b]] médio por cena. Devolve os cortes entre grupos.
export function autoGroupBounds(scenes, colors, maxDist = 46) {
  let groups = scenes.map((s, i) => ({ a: s.a, c: colors[i] || [128, 128, 128], n: 1 }));
  const dist = (x, y) => Math.hypot(x.c[0] - y.c[0], x.c[1] - y.c[1], x.c[2] - y.c[2]);
  const target = Math.max(1, Math.ceil(scenes.length / 2));
  while (groups.length > 1) {
    let best = -1; let bd = Infinity;
    for (let i = 0; i < groups.length - 1; i++) { const d = dist(groups[i], groups[i + 1]); if (d < bd) { bd = d; best = i; } }
    if (groups.length <= target && bd > maxDist) break;
    if (bd > maxDist * 1.6) break;
    const g1 = groups[best]; const g2 = groups[best + 1];
    const n = g1.n + g2.n;
    groups.splice(best, 2, { a: g1.a, n, c: g1.c.map((v, k) => (v * g1.n + g2.c[k] * g2.n) / n) });
  }
  return groups.slice(1).map((g) => r2(g.a));
}

export function setGroups(edit, gb) {
  const e = clone(edit);
  const old = e.gb; const oldGrades = e.grades;
  e.gb = gb;
  e.grades = [];
  for (let i = 0; i <= gb.length; i++) {
    const start = i === 0 ? 0 : gb[i - 1];
    const before = groupAt({ gb: old }, start + 1e-3);
    e.grades.push(oldGrades[before] ? cloneGrade(oldGrades[before]) : defaultGrade());
  }
  return e;
}

// Divide o grupo no corte t (deve ser início de uma cena). O novo grupo herda a grade.
export function splitGroup(edit, t) {
  if (t <= 0.05 || edit.gb.some((x) => Math.abs(x - t) < 0.05)) return edit;
  const e = clone(edit); const i = groupAt(e, t);
  e.gb.splice(i, 0, r2(t));
  e.grades.splice(i + 1, 0, cloneGrade(e.grades[i]));
  return e;
}
export function joinGroup(edit, i) {
  if (i <= 0 || i >= edit.grades.length) return edit;
  const e = clone(edit);
  e.gb.splice(i - 1, 1); e.grades.splice(i, 1);
  return e;
}
// Depois de mudar as cenas: cada corte de grupo gruda no corte de cena mais próximo, ou some.
export function reconcile(edit, scenes) {
  const starts = scenes.slice(1).map((s) => s.a);
  const e = clone(edit);
  const gb = []; const grades = [e.grades[0]];
  e.gb.forEach((t, i) => {
    const near = starts.reduce((b, s) => (b === null || Math.abs(s - t) < Math.abs(b - t) ? s : b), null);
    if (near !== null && Math.abs(near - t) < 0.75 && (!gb.length || near > gb[gb.length - 1] + 0.01)) { gb.push(r2(near)); grades.push(e.grades[i + 1]); }
  });
  e.gb = gb; e.grades = grades;
  return e;
}

// ---------- efeitos ----------
export const fxById = (edit, id) => edit.fx.find((f) => f.id === id) || null;
export function addFx(edit, item) { const e = clone(edit); e.fx.push(item); return e; }
export function updateFx(edit, id, patch) {
  const e = clone(edit); const f = e.fx.find((x) => x.id === id);
  if (f) Object.assign(f, typeof patch === 'function' ? patch(f) || {} : patch);
  return e;
}
export function removeFx(edit, id) { const e = clone(edit); e.fx = e.fx.filter((f) => f.id !== id); return e; }
export function acceptAll(edit) { const e = clone(edit); e.fx.forEach((f) => { f.accepted = true; }); return e; }

// Move um item mantendo a duração dentro de [0, duration]. snaps: tempos em que o ímã gruda.
export function moveTimes(a, b, da, duration, snaps = [], tol = 0.12) {
  const len = b - a; let na = Math.min(Math.max(0, a + da), Math.max(0, duration - len));
  for (const s of snaps) { if (Math.abs(na - s) <= tol) { na = s; break; } if (Math.abs(na + len - s) <= tol) { na = s - len; break; } }
  na = Math.min(Math.max(0, na), Math.max(0, duration - len));
  return [r2(na), r2(na + len)];
}

// ---------- ideias (cortes por plataforma) ----------
export function addIdea(edit, a, b, name) { const e = clone(edit); e.ideas.push({ id: newId(), a: r2(a), b: r2(b), name: name || 'Ideia ' + (e.ideas.length + 1) }); e.ideas.sort((x, y) => x.a - y.a); return e; }
export function removeIdea(edit, id) { const e = clone(edit); e.ideas = e.ideas.filter((i) => i.id !== id); return e; }
export function renameIdea(edit, id, name) { const e = clone(edit); const i = e.ideas.find((x) => x.id === id); if (i) i.name = name; return e; }

// ---------- peças de entrega por plataforma ----------
// Devolve [{ name, a, b }] em tempo de linha do tempo. YouTube e Instagram: vídeo inteiro. TikTok: uma peça por ideia (ou inteiro).
export function pieces(edit, scenes, duration, platformKey, perScene = false) {
  if (perScene) return scenes.map((s, i) => ({ name: 'C' + (i + 1), a: s.a, b: s.b }));
  if (platformKey === 'tiktok' && edit.ideas.length) return edit.ideas.map((i) => ({ name: i.name, a: i.a, b: i.b }));
  return [{ name: 'completo', a: 0, b: duration }];
}
