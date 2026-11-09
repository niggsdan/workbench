// Estado compartilhado entre as telas (Editar, Cor, Entrega) e utilitários.
import { History } from './history.js';
import { Library } from './library.js';
import { newEdit } from './model.js';
import { Compositor } from './render.js';
import { compileGrade } from './grade.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const p2 = (n) => String(n).padStart(2, '0');
export const fmtT = (t) => { const tt = Math.round(t * 10); return p2(Math.floor(tt / 600)) + ':' + p2(Math.floor((tt % 600) / 10)) + ',' + (tt % 10); };
export const fmtClock = (t) => Math.floor(t / 60) + ':' + p2(Math.floor(t % 60));
export const dsec = (a, b) => (Math.round((b - a) * 10) / 10).toFixed(1).replace('.', ',') + ' s';
export const dis = (ok) => (ok ? 'false' : 'true');
export const N = (i) => 'C' + (i + 1);
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export const video = document.getElementById('video');
export const still = document.getElementById('still');

export const app = {
  lib: new Library(),
  activeId: null, view: null, // 'video' | 'audio' | 'image' | null
  name: '', size: 0, url: '', duration: 0, cands: [], thumbs: [],
  hist: null, ratio: '9:16', ph: 0, idx: -1,
  busy: false, abort: null, error: '', notice: '', pending: null,
  drive: { token: null, stack: [], list: [], msg: '', link: '', busy: false },
  tab: 'editar',
  ui: { etab: 'tec', search: '', sel: null, itab: 'efeito', tool: 'Auto-FX', fxPreview: true, snap: true, blade: false,
    node: null, editing: 'shot', cv: 'atual', split: 0.5, review: null, selIdea: null, stillSel: null },
  luts: [], // { name, cube }
  refImg: null, // canvas com imagem de referência (Cor)
  projectName: '', source: '', savedAt: 0, dirty: true,
  comp: new Compositor(),
  overlays: new Map(), // id da biblioteca -> <video>
  exporting: null
};

export const st = () => (app.hist ? app.hist.current : null);
export const edit = () => (app.hist ? app.hist.current.edit : null);

// ganchos que cada tela preenche
export const hooks = { renderAll() {}, preview() {}, toast() {}, say() {}, seek() {} };
export const say = (t) => hooks.say(t);

export function commit(label, patch, key = null) {
  const cur = clone(st());
  const next = typeof patch === 'function' ? patch(cur) || cur : { ...cur, ...patch };
  app.hist.push(next, label, key);
  app.dirty = true;
  hooks.renderAll();
}
export const mutEdit = (label, fn, key = null) => commit(label, (s) => { s.edit = fn(s.edit); return s; }, key);

// grade compilada com cache
const cache = new Map();
export function compiled(grade) {
  if (!grade) return null;
  const cubes = {}; for (const l of app.luts) cubes[l.name] = l.cube;
  const k = JSON.stringify(grade) + '|' + app.luts.map((l) => l.name).join(',');
  let c = cache.get(k);
  if (!c) { c = compileGrade(grade, cubes); cache.set(k, c); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return c;
}
export function compsAt(e, group, withGeneral = true) {
  const out = [compiled(e.grades[group] || e.grades[0])];
  if (withGeneral && e.general.on) out.push(compiled(e.general.grade));
  return out;
}

export function freshHistory(scenes, sens, label) {
  return new History({ scenes, sens, edit: newEdit() }, label);
}

// avisos que somem sozinhos
let toastT = 0;
export function toast(msg, ms = 6000) {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms);
}
hooks.toast = toast;
