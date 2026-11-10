// Painéis que abrem e fecham, e bordas arrastáveis. O vídeo ocupa o espaço que sobra.
import { app, $, $$ } from './store.js';

const DEF = {
  editar: { mat: true, fx: true, pal: true, insp: true, tl: true, det: true, afx: false, leftW: 310, rightW: 310, bottomH: 40 },
  cor: { left: true, scopes: true, insp: true, bottom: true, leftW: 300, rightW: 340, bottomH: 30 }
};
let L = JSON.parse(JSON.stringify(DEF));
try { const s = JSON.parse(localStorage.getItem('wb.layout') || 'null'); if (s) { for (const v of ['editar', 'cor']) Object.assign(L[v], s[v] || {}); if (!s.v2) L.editar.bottomH = Math.max(L.editar.bottomH, 40); } } catch (e) { /* padrão */ }
const save = () => { try { localStorage.setItem('wb.layout', JSON.stringify({ ...L, v2: 1 })); } catch (e) { /* sem espaço */ } };

export const PANELS = {
  editar: [['mat', 'Material'], ['fx', 'Efeitos'], ['pal', 'Paleta'], ['insp', 'Ajustes'], ['tl', 'Timeline'], ['det', 'Cenas (detector)'], ['afx', 'Auto-FX']],
  cor: [['left', 'Álbum e paleta'], ['scopes', 'Scopes'], ['insp', 'Ajustes'], ['bottom', 'Nós e grupos']]
};

export function applyLayout() {
  const e = L.editar; const ve = $('#view-editar');
  const left = e.mat || e.fx;
  ve.style.gridTemplateColumns = (left ? e.leftW : 52) + 'px minmax(0,1fr) ' + (e.insp ? e.rightW + 'px' : '0px');
  ve.style.gridTemplateRows = 'minmax(0,1fr) ' + (e.tl ? e.bottomH + 'vh' : 'auto');
  ve.classList.toggle('no-left', !left); ve.classList.toggle('no-insp', !e.insp); ve.classList.toggle('no-tl', !e.tl); ve.classList.toggle('no-pal', !e.pal);
  $('#detector').hidden = e.det === false; $('#autofx').hidden = !e.afx;
  $('#material').hidden = !e.mat; $('#efeitos').hidden = !e.fx; $('#pal').hidden = !e.pal;
  ve.querySelector('.stack').hidden = !left;
  const c = L.cor; const vc = $('#view-cor');
  vc.style.gridTemplateColumns = (c.left ? c.leftW + 'px' : '0px') + ' minmax(0,1fr) ' + (c.insp ? c.rightW + 'px' : '0px');
  vc.style.gridTemplateRows = 'minmax(0,1fr) ' + (c.bottom ? c.bottomH + 'vh' : '0px');
  vc.classList.toggle('no-left', !c.left); vc.classList.toggle('no-insp', !c.insp); vc.classList.toggle('no-bottom', !c.bottom); vc.classList.toggle('no-scopes', !c.scopes);
  renderPanelMenu();
  app.dirty = true;
}

let menuOpen = false;
export function renderPanelMenu() {
  const el = $('#panels'); if (!el) return;
  const v = app.tab === 'cor' ? 'cor' : app.tab === 'editar' ? 'editar' : null;
  el.hidden = !v; if (!v) return;
  const closed = PANELS[v].filter(([k]) => !L[v][k]).length;
  el.innerHTML = `<button type="button" class="btn pl-btn" data-act="panel-menu" aria-expanded="${menuOpen}">Painéis${closed ? ' · ' + closed + ' fechado' + (closed > 1 ? 's' : '') : ''} ▾</button>
    <div class="pl-menu" ${menuOpen ? '' : 'hidden'}>${PANELS[v].map(([k, l]) => `<button type="button" data-act="panel" data-v="${v}" data-k="${k}" aria-pressed="${!!L[v][k]}"><span class="ck">${L[v][k] ? '✓' : ''}</span>${l}</button>`).join('')}
    <button type="button" class="pl-reset" data-act="panel-reset">↺ Tamanho padrão</button><div class="note" style="padding:4px 8px">Dica: arraste as bordas entre os painéis e o vídeo.</div></div>`;
}

export function togglePanel(v, k, on) {
  L[v][k] = on === undefined ? !L[v][k] : on; save(); applyLayout();
}

export const actions = {
  'panel-menu'() { menuOpen = !menuOpen; renderPanelMenu(); },
  panel(el) { togglePanel(el.dataset.v, el.dataset.k); },
  'panel-close'(el) { togglePanel(app.tab === 'cor' ? 'cor' : 'editar', el.dataset.k, false); },
  'panel-reset'() { const v = app.tab === 'cor' ? 'cor' : 'editar'; L[v] = JSON.parse(JSON.stringify(DEF[v])); save(); applyLayout(); }
};

// bordas arrastáveis: esquerda, direita e a de cima da timeline
let drag = null;
function down(ev) {
  const h = ev.target.closest('[data-split]'); if (!h) return;
  const v = h.closest('.view').id === 'view-cor' ? 'cor' : 'editar';
  drag = { v, k: h.dataset.split, x0: ev.clientX, y0: ev.clientY, w0: L[v].leftW, r0: L[v].rightW, b0: L[v].bottomH };
  h.setPointerCapture && h.setPointerCapture(ev.pointerId); document.body.classList.add('resizing'); ev.preventDefault();
}
function move(ev) {
  if (!drag) return; const o = L[drag.v]; const vw = innerWidth;
  if (drag.k === 'left') o.leftW = Math.round(Math.max(220, Math.min(vw * 0.4, drag.w0 + ev.clientX - drag.x0)));
  else if (drag.k === 'right') o.rightW = Math.round(Math.max(240, Math.min(vw * 0.4, drag.r0 - (ev.clientX - drag.x0))));
  else o.bottomH = Math.round(Math.max(14, Math.min(70, drag.b0 - (ev.clientY - drag.y0) / innerHeight * 100)) * 10) / 10;
  applyLayout();
}
function up() { if (drag) { drag = null; save(); document.body.classList.remove('resizing'); } }

export function bindLayout() {
  document.addEventListener('click', (e) => { if (menuOpen && e.target.isConnected && !e.target.closest('#panels')) { menuOpen = false; renderPanelMenu(); } });
  document.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  applyLayout();
}
