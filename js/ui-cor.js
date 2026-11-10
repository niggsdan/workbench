// Tela Cor: álbum de stills, paleta, LUTs, visualizador, scopes, nós, grupos de cena e inspetor de cor.
import { app, $, esc, fmtT, clone, clamp, video, still, st, edit, proj, mutEdit, mutProj, hooks, toast, compsAt, compiled } from './store.js';
app.ui.wheelStyle = localStorage.getItem('wb.wheels') || 'resolve';
import * as M from './model.js';
import * as G from './grade.js';
import { outSize, sampleCanvas, gradedThumb } from './render.js';
import { mutLight } from './ui-editar.js';

const EX_PAL = [['#f2d9a8', '#e8c27a', '#f5e6c8', '#e0b36a', '#f0cf94', '#fbefd2'], ['#c98a3d', '#a8692b', '#b9803a', '#8f5a2a', '#d09a52', '#9c6a35'], ['#3b2412', '#2a1a0e', '#4a2c14', '#1d130a', '#33200f', '#140e08']];
const titleCase = (t) => String(t).toLowerCase().split(' ').map((w, i) => (i && ['de', 'da', 'do', 'das', 'dos', 'à', 'e', 'a', 'o'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const gi = () => (edit() ? M.groupAt(edit(), app.ph) : 0);
const groupScenes = (e, i) => { const [a, b] = M.groupRange(e, i, app.duration); return st().scenes.filter((s) => s.a >= a - 1e-6 && s.a < b - 1e-6).length; };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
const fmtN = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d).replace('.', ',');
const signed = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d).replace('.', ',');

export const target = () => { const e = edit(); if (!e) return null; return app.ui.editing === 'general' ? e.general.grade : e.grades[gi()]; };
function mutGrade(label, fn, key = null, light = false) {
  const g = gi(); const gen = app.ui.editing === 'general';
  const f = (e) => { const gr = gen ? e.general.grade : e.grades[g]; const r = fn(gr); if (r) { if (gen) e.general.grade = r; else e.grades[g] = r; } return e; };
  if (light) mutLight(label, f, key); else mutEdit(label, f, key);
}
const curNode = () => { const g = target(); if (!g) return null; return G.findNode(g, app.ui.node) || g.serial.find((n) => n.kind === 'prim') || g.serial[0]; };

// ---------- esquerda ----------
const stillImgs = new Map();
const stillImg = (s) => { let i = stillImgs.get(s.id); if (!i) { i = new Image(); i.src = s.url; stillImgs.set(s.id, i); } return i; };
function renderAlbum() {
  const e = edit(); const list = e ? e.stills : [];
  $('#c-album').innerHTML = `<div class="p-head"><div class="p-title"><h2 class="tool">Álbum de stills</h2><span style="display:flex;gap:4px"><button type="button" class="btn sm" data-act="still-grab" ${e && app.view ? '' : 'aria-disabled="true"'}>Guardar quadro</button><button type="button" class="pclose" data-act="panel-close" data-k="left" title="Fechar painel" aria-label="Fechar painel">–</button></span></div></div>
    <div class="stills">${list.length ? list.map((s) => `<button type="button" class="still" data-act="still-pick" data-id="${s.id}" aria-pressed="${app.ui.stillSel === s.id}" title="Usar como referência no visualizador"><img src="${s.url}" alt="">${esc(s.label)}</button>`).join('') : '<div class="note" style="grid-column:1/-1">Guarde quadros pra comparar cenas. Clique num still pra usar como referência no visualizador.</div>'}</div>
    ${list.length ? `<div class="p-foot" style="display:flex;justify-content:space-between;align-items:center">Clique pra comparar. <button type="button" class="link-btn" data-act="still-del" ${app.ui.stillSel ? '' : 'disabled'}>Apagar selecionado</button></div>` : ''}`;
}
const sw = (cols) => '<div class="sw">' + (cols || []).map((c) => `<i style="background:${c}"></i>`).join('') + '</div>';
function renderPal() {
  const e = edit(); const ref = M.refPalette(proj()) || EX_PAL; const i = gi();
  const blk = (p) => ['Claros', 'Médios', 'Escuros'].map((l, k) => `<div class="lb">${l}</div>${sw(p ? p[k] : [])}`).join('');
  $('#c-pal').innerHTML = `<div class="p-head"><h2 class="tool">Paleta</h2></div><div class="pal-c">
    <div style="font-weight:800;font-size:12px">Teu material · G${i + 1}${st() ? ' · ' + plural(groupScenes(e, i), 'cena', 'cenas') : ''}</div>${blk(app.palCor)}
    <div style="font-weight:800;font-size:12px;margin-top:14px">Referência</div><div class="note">${M.refPalette(proj()) ? 'Da referência do projeto' : 'Exemplo, a paleta é anotada por você'}</div>${blk(ref)}
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px"><button type="button" class="btn" data-act="ref-load">Carregar imagem de referência</button>
    <button type="button" class="btn solid" data-act="pal-sim" ${st() ? '' : 'aria-disabled="true"'} title="Cria um nó que leva as cores do teu material pras cores do filme, e você ajusta cada uma">Simular a cor do filme</button>
    <button type="button" class="btn" data-act="pal-start" ${st() ? '' : 'aria-disabled="true"'}>Só ajustar as rodas</button></div></div>`;
}
function renderLuts() {
  const g = target(); const prim = g ? (curNode() && curNode().kind === 'prim' ? curNode() : g.serial.find((n) => n.kind === 'prim')) : null;
  $('#c-luts').innerHTML = `<div class="p-head"><h2 class="tool">LUTs</h2></div><div style="padding:0 12px 12px">
    <button type="button" class="btn dash" style="width:100%;height:36px" data-act="lut-import">Importar LUT (.cube)</button>
    ${app.luts.length ? app.luts.map((l) => { const used = prim && prim.lut === l.name; return `<button type="button" class="lut-row" data-act="lut-toggle" data-name="${esc(l.name)}" title="${used ? 'Tirar' : 'Aplicar'} no nó ${esc(prim ? prim.name : '')}"><span>${esc(l.name)}</span><span>${used ? esc((prim.name || '').split(' ·')[0]) : 'não usado'}</span></button>`; }).join('') : '<div class="note" style="margin-top:8px">Nenhuma LUT importada. A LUT entra dentro do nó Primária selecionado.</div>'}</div>`;
}

// ---------- visualizador ----------
function renderViewer() {
  const e = edit(); const i = gi(); const s = st();
  const [a, b] = e && s ? M.groupRange(e, i, app.duration) : [0, 0];
  const style = proj() ? (proj().cinema.filter((c) => c.state === 'use').map((c) => titleCase(c.name)).join(' + ') || 'sem estilo') : '';
  const refLabel = app.ui.stillSel ? 'Still' : app.refImg ? 'Referência' : 'Original';
  $('#c-viewer').innerHTML = `<div class="v-head"><div><b>${app.ui.editing === 'general' ? 'Grade geral · todas as cenas' : `G${i + 1} · ${s ? plural(groupScenes(e, i), 'cena', 'cenas') : '—'} · ${fmtT(a).slice(0, 7)} → ${fmtT(b).slice(0, 7)}`}</b>
      <small>Referência: ${esc(style)} · grade geral ${e && e.general.on ? 'ligada' : 'desligada'}</small></div>
    <div class="seg">${[['atual', 'Atual'], ['ref', refLabel], ['split', 'Dividir']].map(([k, l]) => `<button type="button" data-act="cv" data-v="${k}" aria-pressed="${app.ui.cv === k}">${l}</button>`).join('')}</div></div>
    <div class="v-stage">${app.view ? `<div class="v-wrap" id="cv-wrap"><canvas id="cv-cor" aria-label="Visualizador de cor"></canvas>${app.ui.cv === 'split' ? `<span class="tag a">${refLabel}</span><span class="tag b">Atual</span><span class="vline" id="vline" style="left:${app.ui.split * 100}%"></span>` : `<span class="tag b">${app.ui.cv === 'ref' ? refLabel : 'Atual'}</span>`}</div>` : '<div class="muted">Abra um vídeo na aba Editar pra corrigir a cor.</div>'}</div>
    <div class="v-foot"><span class="mono" style="color:var(--txt)" id="c-tc">${fmtT(app.ph)} <span class="muted">/ ${fmtT(app.duration)}</span></span>
      <span style="display:flex;gap:6px"><button type="button" class="btn sq sm" data-act="step-back" aria-label="Voltar">◀</button><button type="button" class="btn sm solid" data-act="play" aria-label="Tocar ou pausar">${!app.player.playing ? 'Tocar' : 'Pausar'}</button><button type="button" class="btn sq sm" data-act="step-fwd" aria-label="Avançar">▶</button></span>
      <span>Prévia em meia resolução, o render final é em cheia</span></div>`;
}
function renderScopes() {
  $('#c-scopes').innerHTML = `<section class="card scope"><div class="p-title"><h3>Waveform</h3><button type="button" class="pclose" data-act="panel-close" data-k="scopes" title="Fechar painel" aria-label="Fechar painel">–</button></div><canvas id="sc-wave" width="240" height="110"></canvas></section>
    <section class="card scope"><h3>Vectorscope</h3><canvas id="sc-vec" width="240" height="130"></canvas></section>
    <section class="card scope"><h3>Histograma</h3><canvas id="sc-hist" width="240" height="120"></canvas></section>`;
}

// ---------- nós ----------
const KIND_TXT = { prim: 'Balanço geral da cena', curve: 'Contraste e rolagem de luzes', qual: 'Secundária por qualificador', hala: 'Brilho nas luzes fortes', pal: 'Simula as cores do filme de referência' };
function graphLayout(g) {
  const nodes = []; const links = []; const rowH = 46; const k = Math.max(1, g.par.length);
  const H = Math.max(180, k * rowH + 70); const cy = H / 2 - 15;
  let x = 14; const put = (id, label, w, y, extra = {}) => { const n = { id, label, x, y, w, ...extra }; nodes.push(n); return n; };
  let prev = put('in', 'Entrada', 64, cy, { io: true }); x += 64 + 24;
  for (const n of g.serial) { const nn = put(n.id, n.name || n.kind, 108, cy, { off: !n.on }); links.push([prev, nn]); prev = nn; x += 108 + 24; }
  let parNodes = [];
  if (g.par.length) {
    const top = cy - ((g.par.length - 1) * rowH) / 2;
    parNodes = g.par.map((n, i) => put(n.id, n.name || 'Qualificador', 108, top + i * rowH, { off: !n.on }));
    parNodes.forEach((pn) => links.push([prev, pn, 'fork'])); x += 108 + 24;
    const mix = put('mix', 'Mixer', 64, cy, { io: true }); parNodes.forEach((pn) => links.push([pn, mix, 'join'])); prev = mix; x += 64 + 24;
  }
  for (const n of g.post) { const nn = put(n.id, n.name || n.kind, 108, cy, { off: !n.on }); links.push([prev, nn]); prev = nn; x += 108 + 24; }
  const out = put('out', 'Saída', 60, cy, { io: true }); links.push([prev, out]);
  return { nodes, links, W: x + 60 + 14, H };
}
function renderNodes() {
  const e = edit(); const g = target(); const i = gi();
  if (!g) { $('#c-nodes').innerHTML = '<div class="n-head"><h2 class="tool">Nós</h2></div><div class="muted">Abra um vídeo pra montar a grade.</div>'; return; }
  const L = graphLayout(g); const sel = app.ui.node || (curNode() && curNode().id);
  const path = ([a, b]) => { const x1 = a.x + a.w; const y1 = a.y + 15; const x2 = b.x; const y2 = b.y + 15; const mx = (x1 + x2) / 2; return `<path d="M${x1} ${y1} H${mx} V${y2} H${x2}" fill="none" stroke="#6a7078" stroke-width="2"/>`; };
  $('#c-nodes').innerHTML = `<div class="n-head"><h2 class="tool">Nós</h2><button type="button" class="pclose" data-act="panel-close" data-k="bottom" title="Fechar painel" aria-label="Fechar painel">–</button><span class="sub">${app.ui.editing === 'general' ? 'Grade geral (por cima de todas as cenas)' : `G${i + 1} · grade da cena + grade geral`}</span><div class="grow"></div>
      <div class="seg sm"><button type="button" data-act="editing" data-v="shot" aria-pressed="${app.ui.editing !== 'general'}">Editando G${i + 1}</button><button type="button" data-act="editing" data-v="general" aria-pressed="${app.ui.editing === 'general'}">Grade geral</button></div>
      <button type="button" class="btn sm" data-act="node-add" data-v="serial">+ Nó em série</button><button type="button" class="btn sm" data-act="node-add" data-v="par">+ Paralelo</button><button type="button" class="btn sm" data-act="node-add" data-v="post">+ Camada</button><button type="button" class="btn sm" data-act="pal-sim">+ Paleta do filme</button>
      <button type="button" class="btn sm" data-act="general-toggle" aria-pressed="${e.general.on}">${e.general.on ? 'Grade geral ligada' : 'Grade geral desligada'}</button></div>
    <div class="n-graph" style="height:${L.H + 10}px"><div style="position:relative;width:${L.W}px;height:${L.H}px"><svg width="${L.W}" height="${L.H}">${L.links.map(path).join('')}</svg>
      ${L.nodes.map((n) => `<button type="button" class="nd${n.off ? ' off' : ''}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px" data-act="node" data-id="${n.id}" aria-pressed="${sel === n.id}" title="${esc(n.label)}">${esc(n.label)}</button>`).join('')}</div>
      <span class="n-note">Nós em série, em paralelo e camadas, como no Resolve</span></div>`;
}

// ---------- grupos ----------
function renderShots() {
  const e = edit(); if (!e || !st()) { $('#c-shots').innerHTML = '<div class="muted">Os grupos de cena aparecem quando um vídeo for aberto.</div>'; return; }
  const n = M.groupCount(e); const i = gi();
  const D = app.duration; const pc = (t) => (t / D * 100).toFixed(3) + '%';
  const mini = `<div class="cmini" id="cmini" title="Clique pra ir até o ponto"><div class="cl"><span>Cor</span><div class="ln" data-cl="1">${Array.from({ length: n }, (_, k) => { const [a, b] = M.groupRange(e, k, D); return `<i class="${k === i ? 'on' : ''}" style="left:${pc(a)};width:${((b - a) / D * 100).toFixed(3)}%">G${k + 1}</i>`; }).join('')}</div></div>
    <div class="cl"><span>Cenas</span><div class="ln" data-cl="1">${st().scenes.map((sc, k) => `<i class="sc${k % 2 ? ' alt' : ''}" style="left:${pc(sc.a)};width:${((sc.b - sc.a) / D * 100).toFixed(3)}%">C${k + 1}</i>`).join('')}</div></div><u id="cmini-ph" style="left:${pc(app.ph)}"></u></div>`;
  $('#c-shots').innerHTML = mini + '<div class="shot-row">' + Array.from({ length: n }, (_, k) => `<button type="button" class="shot" data-act="shot" data-i="${k}" aria-pressed="${k === i}"><canvas width="96" height="54" data-thumb="${k}"></canvas><span class="r"><b>G${k + 1}</b><span>${plural(groupScenes(e, k), 'cena', 'cenas')}</span></span></button>`).join('')
    + `<div style="display:flex;flex-direction:column;gap:6px;justify-content:center;flex:none"><button type="button" class="btn sm" data-act="grp-split" title="Começa um grupo novo no corte de cena mais próximo do playhead">Dividir no corte</button><button type="button" class="btn sm" data-act="grp-join" ${i > 0 ? '' : 'aria-disabled="true"'}>Juntar com anterior</button><button type="button" class="btn sm" data-act="grp-auto">Agrupar por cor</button></div></div>`;
  drawThumbs();
}
export function drawThumbs() {
  const e = edit(); if (!e || !app.thumbs.length) return;
  document.querySelectorAll('#c-shots canvas[data-thumb]').forEach((c) => {
    const k = +c.dataset.thumb; const [a, b] = M.groupRange(e, k, app.duration); const mid = (a + b) / 2;
    const th = app.thumbs.reduce((best, t) => (!best || Math.abs(t.t - mid) < Math.abs(best.t - mid) ? t : best), null);
    if (!th) return; const im = gradedThumb(th, compsAt(e, k));
    const tmp = document.createElement('canvas'); tmp.width = th.w; tmp.height = th.h; tmp.getContext('2d').putImageData(im, 0, 0);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(tmp, 0, 0, c.width, c.height);
  });
}

// ---------- inspetor ----------
const PRIM = [
  ['contrast', 'Contraste', 0.5, 2, 0.01, (v) => fmtN(v, 2)], ['pivot', 'Pivô', 0.1, 0.9, 0.005, (v) => fmtN(v, 3)], ['temp', 'Temperatura', -1000, 1000, 10, (v) => signed(v)],
  ['tint', 'Matiz', -100, 100, 0.5, (v) => fmtN(v, 1)], ['sat', 'Saturação', 0, 200, 1, (v) => String(Math.round(v))], ['hi', 'Realces', -100, 100, 1, (v) => signed(v)], ['sh', 'Sombras', -100, 100, 1, (v) => signed(v)]
];
const HALA = [['amount', 'Intensidade', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'], ['radius', 'Raio', 0.05, 1, 0.01, (v) => Math.round(v * 100) + '%'], ['thr', 'Limite das luzes', 0.3, 0.95, 0.01, (v) => Math.round(v * 100) + '%']];
const QADJ = [['hue', 'Girar matiz', -60, 60, 1, (v) => signed(v) + '°'], ['sat', 'Saturação', -100, 100, 1, (v) => signed(v)], ['lum', 'Luminância', -100, 100, 1, (v) => signed(v)]];
const pctOf = (v, min, max) => ((v - min) / (max - min) * 100).toFixed(1) + '%';
const slider = (path, [k, l, min, max, step, f], v) => `<div class="sl"><div class="h">${l}<span data-val>${f(v)}</span></div><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${pctOf(v, min, max)}" data-act="cslider" data-path="${path}" data-k="${k}" aria-label="${l}"></div>`;
const HUE = 'background:linear-gradient(90deg,#e04a4a,#e0d04a,#4ae07a,#4ae0d8,#4a7ae0,#e04ad0,#e04a4a)';
const SAT = 'background:linear-gradient(90deg,#555,#e0a04a)'; const LUM = 'background:linear-gradient(90deg,#000,#fff)';
function rangeHtml(nd, k, label, max, bg) {
  const [lo, hi] = nd.range[k];
  return `<div class="range"><div class="h">${label}<span>${Math.round(lo)}–${Math.round(hi)}</span></div><div class="strip" style="${bg}" data-range="${k}" data-max="${max}"><div class="win" style="left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%"><b class="l" data-edge="l"></b><b class="r" data-edge="r"></b></div></div></div>`;
}
function curveHtml(nd) {
  const f = G.curveFn(nd.pts); let d = ''; for (let i = 0; i <= 64; i++) { const x = i / 64; d += (i ? 'L' : 'M') + (x * 100).toFixed(2) + ' ' + ((1 - clamp(f(x), 0, 1)) * 100).toFixed(2); }
  return `<svg class="curve" id="curve" viewBox="0 0 100 100"><line x1="25" y1="0" x2="25" y2="100"/><line x1="50" y1="0" x2="50" y2="100"/><line x1="75" y1="0" x2="75" y2="100"/><line x1="0" y1="25" x2="100" y2="25"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="75" x2="100" y2="75"/><line x1="0" y1="100" x2="100" y2="0" style="stroke:#4a4f56;stroke-dasharray:2 2"/><path d="${d}"/>${nd.pts.map((p, i) => `<circle class="pt" cx="${p[0] * 100}" cy="${(1 - p[1]) * 100}" r="2.6" data-i="${i}"/>`).join('')}</svg><div class="note">Arraste os pontos. Clique na curva pra criar, duplo clique pra apagar.</div>`;
}
function renderInsp() {
  const g = target(); const el = $('#c-insp');
  if (!g) { el.innerHTML = '<div class="hint-empty">Abra um vídeo pra corrigir a cor. Cada grupo de cenas (G1, G2…) tem a sua grade, e a grade geral entra por cima de tudo.</div>'; return; }
  const id = app.ui.node || curNode().id;
  const io = { in: ['Entrada', 'Entrada', 'O clipe entra aqui, direto da fonte, já reenquadrado.'], mix: ['Mixer', 'Junção', 'Soma o resultado dos nós em paralelo e segue para o próximo nó.'], out: ['Saída', 'Saída', 'Resultado final da cena. Se a grade geral estiver ligada, ela entra por cima daqui.'] }[id];
  const foot = `<div class="foot"><button type="button" class="btn solid" data-act="grade-copy">Copiar grade</button><button type="button" class="btn" data-act="grade-paste" ${app.gradeClip ? '' : 'aria-disabled="true"'}>Colar nas outras</button><button type="button" class="btn" data-act="grade-reset">Resetar</button></div>`;
  if (io) { el.innerHTML = `<div class="chips"><span class="kchip o">${io[1]}</span></div><h3 class="big">${io[0]}</h3><div class="why">${io[2]}</div>${foot}`; return; }
  const nd = G.findNode(g, id) || curNode(); const where = g.serial.includes(nd) ? 'Nó em série' : g.par.includes(nd) ? 'Nó em paralelo' : 'Camada';
  let body = '';
  if (nd.kind === 'prim') {
    const p = nd.prim;
    const lum = app.ui.wheelStyle === 'lumetri';
    const W = lum ? [['lift', 'Sombras', ''], ['gamma', 'Meios-tons', ''], ['gain', 'Realces', '']] : [['lift', 'Lift', 'sombras'], ['gamma', 'Gamma', 'meios-tons'], ['gain', 'Gain', 'realces'], ['offset', 'Offset', 'tudo']];
    const rgb = (w) => { const v = G.puckToVec(p[w], G.WHEEL_K[w]); const y = (p[w + 'Y'] || 0) * { lift: 0.25, gamma: 0.6, gain: 0.6, offset: 0.2 }[w]; return v.map((x) => (x + y >= 0 ? ' ' : '−') + Math.abs(x + y).toFixed(2).replace('.', ',')); };
    body = `<div><div style="display:flex;justify-content:space-between;align-items:center"><h3>Rodas de cor</h3><div class="seg sm"><button type="button" data-act="wheel-style" data-v="resolve" aria-pressed="${!lum}">Resolve</button><button type="button" data-act="wheel-style" data-v="lumetri" aria-pressed="${lum}">Lumetri</button></div></div>
      <div class="wheels2 ${lum ? 'lum' : ''}">${W.map(([w, l, sub]) => { const y = p[w + 'Y'] || 0; const c = rgb(w); return `<div class="wheel2">
        <div class="wh-h"><b>${l}</b>${sub ? `<span>${sub}</span>` : ''}<button type="button" class="link-btn" data-act="wheel-reset" data-w="${w}" title="Zerar ${l}">↺</button></div>
        <div class="wh-body"><div class="w" data-wheel="${w}" title="Arraste o ponto. Shift: ajuste fino. Duplo clique: zera."><i style="left:${50 + p[w][0] * 50}%;top:${50 - p[w][1] * 50}%"></i></div>
        ${lum ? `<input type="range" class="vmaster" orient="vertical" min="-1" max="1" step="0.01" value="${y}" data-act="cslider" data-path="prim" data-k="${w}Y" aria-label="Luminância ${l}">` : ''}</div>
        ${lum ? '' : `<input type="range" min="-1" max="1" step="0.01" value="${y}" style="--p:${(y + 1) * 50}%" data-act="cslider" data-path="prim" data-k="${w}Y" aria-label="Master ${l}">`}
        <div class="wh-rgb mono" data-rgb="${w}"><span class="r">R${c[0]}</span><span class="g">G${c[1]}</span><span class="b">B${c[2]}</span><span>Y ${(y >= 0 ? ' ' : '−') + Math.abs(y).toFixed(2).replace('.', ',')}</span></div></div>`; }).join('')}</div></div>
      <div><h3>Ajustes</h3>${PRIM.map((d) => slider('prim', d, p[d[0]])).join('')}</div>
      <div class="note">LUT neste nó: ${nd.lut ? esc(nd.lut) : 'nenhuma'} (escolha em LUTs, à esquerda).</div>`;
  } else if (nd.kind === 'curve') body = `<div><h3>Curva</h3><div style="margin-top:8px">${curveHtml(nd)}</div></div>`;
  else if (nd.kind === 'qual') {
    body = `<div><h3>Qualificador</h3>${rangeHtml(nd, 'h', 'Matiz', 360, HUE)}${rangeHtml(nd, 's', 'Saturação', 100, SAT)}${rangeHtml(nd, 'l', 'Luminância', 100, LUM)}${slider('q', ['soft', 'Suavidade da borda', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'], nd.soft)}</div>
      <div><h3>Correção dentro da seleção</h3>${QADJ.map((d) => slider('adj', d, nd.adj[d[0]])).join('')}</div>
      <div class="note">Só mexe nos pixels dentro da faixa de matiz, saturação e luminância.</div>`;
  } else if (nd.kind === 'hala') body = `<div><h3>Halation</h3>${HALA.map((d) => slider('h', d, nd[d[0]])).join('')}</div>`;
  else if (nd.kind === 'pal') {
    const row = (side, b) => `<div class="palrow">${((nd[side] || [])[b] || []).map((h, i) => `<input type="color" value="${h}" data-act="palsw" data-side="${side}" data-b="${b}" data-i="${i}" aria-label="${side === 'src' ? 'Cor do material' : 'Cor alvo'}">`).join('')}</div>`;
    body = `<div><h3>Do teu material → cor do filme</h3><div class="note" style="margin:4px 0 8px">Clique em qualquer cor pra trocar. A de cima é o que tem no teu vídeo, a de baixo é pra onde ela vai.</div>
      ${['Claros', 'Médios', 'Escuros'].map((l, b) => `<div class="palband"><b>${l}</b>${row('src', b)}<span class="arrow">↓</span>${row('dst', b)}</div>`).join('')}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn sm" data-act="pal-resample">Atualizar do quadro atual</button><button type="button" class="btn sm" data-act="pal-pullref">Puxar da referência</button></div></div>
      <div><h3>Quanto</h3>${slider('pal', ['amount', 'Intensidade', 0, 1.5, 0.01, (v) => Math.round(v * 100) + '%'], nd.amount)}${['Claros', 'Médios', 'Escuros'].map((l, b) => slider('palb' + b, ['b' + b, l, 0, 1.5, 0.01, (v) => Math.round(v * 100) + '%'], nd.bands[b])).join('')}${slider('pal', ['sat', 'Saturação extra', -60, 60, 1, (v) => (v > 0 ? '+' : '') + Math.round(v)], nd.sat)}</div>`;
  }
  el.innerHTML = `<div class="chips"><span class="kchip">${where}</span>${app.ui.editing === 'general' ? '<span class="kchip o">Grade geral</span>' : `<span class="kchip o">G${gi() + 1}</span>`}</div>
    <h3 class="big">${esc(nd.name || nd.kind)}</h3><div class="muted">${app.ui.editing === 'general' ? 'Grade geral' : 'G' + (gi() + 1)} · ${KIND_TXT[nd.kind]}</div>
    <div style="display:flex;gap:6px"><button type="button" class="btn sm" data-act="node-bypass" aria-pressed="${!nd.on}">${nd.on ? 'Desligar nó' : 'Ligar nó'}</button><button type="button" class="btn sm" data-act="node-del">Apagar nó</button></div>
    ${body}${foot}`;
}

// ---------- desenho ----------
let scopeAt = 0; let palAt = 0; const alt = document.createElement('canvas');
export function drawCor() {
  const cv = $('#cv-cor'); if (!cv || !app.view) return;
  const t = app.view === 'video' ? hooks.seqTime() : 0; const so = app.view === 'video' ? hooks.seqSource(t) : null;
  const e = edit(); const src = app.view === 'video' ? (so && so.el) : app.view === 'image' ? still : null; if (!src || !e) return;
  const { w, h } = outSize(app.ratio, 640);
  const sw = so ? so.sw : still.naturalWidth; const sh = so ? so.sh : still.naturalHeight;
  const ox = hooks.sceneCrop(t).ox; const base = { src, sw, sh, t, ratio: app.ratio, ox, fx: e.fx, fxOn: false, overlays: app.overlays, W: w, H: h };
  const gIdx = M.groupAt(e, t);
  const comps = app.ui.editing === 'general' ? [e.general.on ? compiled(e.general.grade) : null] : compsAt(e, gIdx);
  if (app.ui.editing === 'general' && e.general.on) comps.unshift(compiled(e.grades[gIdx]));
  app.comp.render(cv, { ...base, comps });
  const now = performance.now();
  if (app.player.playing ? now - scopeAt > 120 : true) { scopeAt = now; drawScopes(cv); }
  if (now - palAt > 700) { palAt = now; app.palCor = G.extractPalette(sampleCanvas(cv, 64).data); const p = $('#c-pal'); if (p) renderPal(); }
  if (app.ui.cv !== 'atual') {
    const ref = app.ui.stillSel ? stillImg(e.stills.find((s) => s.id === app.ui.stillSel) || {}) : app.refImg;
    alt.width = w; alt.height = h; const ag = alt.getContext('2d');
    if (ref && (ref.naturalWidth || ref.width)) { ag.fillStyle = '#000'; ag.fillRect(0, 0, w, h); const rw = ref.naturalWidth || ref.width; const rh = ref.naturalHeight || ref.height; const s = Math.max(w / rw, h / rh); ag.drawImage(ref, (w - rw * s) / 2, (h - rh * s) / 2, rw * s, rh * s); }
    else app.comp.render(alt, { ...base, comps: [] });
    const g = cv.getContext('2d');
    if (app.ui.cv === 'ref') g.drawImage(alt, 0, 0);
    else { const x = Math.round(w * app.ui.split); g.drawImage(alt, 0, 0, x, h, 0, 0, x, h); }
  }
  const tc = $('#c-tc'); if (tc) tc.innerHTML = fmtT(app.ph) + ' <span class="muted">/ ' + fmtT(app.duration) + '</span>';
  const ph = $('#cmini-ph'); if (ph && app.duration) { const ln = document.querySelector('#cmini .ln'); ph.style.left = 'calc(' + (ln ? ln.offsetLeft : 0) + 'px + ' + (t / app.duration) + ' * (100% - ' + (ln ? ln.offsetLeft : 0) + 'px))'; }
}
function drawScopes(cv) {
  const sm = sampleCanvas(cv, 160);
  const wv = $('#sc-wave'); const vc = $('#sc-vec'); const hs = $('#sc-hist'); if (!wv) return;
  { const { grid, cols, rows } = G.waveform(sm.data, sm.w, sm.h, 120, 55); const g = wv.getContext('2d'); g.fillStyle = '#101113'; g.fillRect(0, 0, wv.width, wv.height);
    const im = g.createImageData(cols, rows); let mx = 1; for (const v of grid) if (v > mx) mx = v;
    for (let i = 0; i < grid.length; i++) { const a = Math.min(1, Math.sqrt(grid[i] / mx) * 1.6); im.data[i * 4] = 120 * a; im.data[i * 4 + 1] = 230 * a; im.data[i * 4 + 2] = 160 * a; im.data[i * 4 + 3] = 255; }
    const tmp = document.createElement('canvas'); tmp.width = cols; tmp.height = rows; tmp.getContext('2d').putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(tmp, 0, 0, wv.width, wv.height);
    g.strokeStyle = 'rgba(255,255,255,.08)'; for (let y = 0; y <= 4; y++) { g.beginPath(); g.moveTo(0, y * wv.height / 4); g.lineTo(wv.width, y * wv.height / 4); g.stroke(); } }
  { const { grid, size } = G.vectorscope(sm.data, 64); const g = vc.getContext('2d'); g.fillStyle = '#101113'; g.fillRect(0, 0, vc.width, vc.height);
    const R = vc.height / 2 - 6; const cx = vc.width / 2; const cy = vc.height / 2; g.strokeStyle = '#3a3e44'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    let mx = 1; for (const v of grid) if (v > mx) mx = v;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = grid[y * size + x]; if (!v) continue; g.fillStyle = `rgba(255,190,150,${Math.min(1, 0.25 + Math.sqrt(v / mx))})`; g.fillRect(cx - R + (x / (size - 1)) * 2 * R - 1, cy - R + (y / (size - 1)) * 2 * R - 1, 2.4, 2.4); } }
  { const hh = G.histogram(sm.data, 48); const g = hs.getContext('2d'); g.fillStyle = '#101113'; g.fillRect(0, 0, hs.width, hs.height);
    const mx = Math.max(1, ...hh[3]); const bw = hs.width / 48; g.fillStyle = '#b6bbc2';
    hh[3].forEach((v, i) => { const hgt = (v / mx) * (hs.height - 8); g.fillRect(i * bw + 1, hs.height - hgt, bw - 2, hgt); }); }
}

export function render() {
  if (app.tab !== 'cor') return;
  renderAlbum(); renderPal(); renderLuts(); renderViewer(); if (!$('#sc-wave')) renderScopes(); renderNodes(); renderShots(); renderInsp();
}

// ---------- ações ----------
export const actions = {
  cv(el) { app.ui.cv = el.dataset.v; renderViewer(); hooks.preview(); },
  editing(el) { app.ui.editing = el.dataset.v; app.ui.node = null; render(); hooks.preview(); },
  node(el) { app.ui.node = el.dataset.id; renderNodes(); renderInsp(); renderLuts(); },
  'node-add'(el) {
    const where = el.dataset.v; const g = target(); if (!g) return;
    const n = where === 'par' ? G.newNode('qual', { sub: 'pele', name: 'N' + (G.allNodes(g).length + 1) + ' · Qualificador' }) : where === 'post' ? G.newNode('hala', { name: 'N' + (G.allNodes(g).length + 1) + ' · Halation' }) : G.newNode('prim', { name: 'N' + (G.allNodes(g).length + 1) + ' · Primária' });
    if (where === 'post') n.amount = 0.3;
    mutGrade('Novo nó: ' + n.name, (gr) => { gr[where].push(n); return gr; }); app.ui.node = n.id; render();
  },
  'node-bypass'() { const id = app.ui.node || curNode().id; mutGrade('Liga/desliga nó', (gr) => { const n = G.findNode(gr, id); n.on = !n.on; return gr; }); },
  'node-del'() {
    const id = app.ui.node || curNode().id; const g = target();
    if (G.allNodes(g).length <= 1) { toast('A grade precisa de pelo menos um nó.'); return; }
    mutGrade('Apagar nó', (gr) => { for (const k of ['serial', 'par', 'post']) gr[k] = gr[k].filter((n) => n.id !== id); return gr; }); app.ui.node = null; render();
  },
  'general-toggle'() { mutEdit('Grade geral ' + (edit().general.on ? 'desligada' : 'ligada'), (e) => { e.general.on = !e.general.on; return e; }); },
  shot(el) { const [a, b] = M.groupRange(edit(), +el.dataset.i, app.duration); app.ui.editing = 'shot'; app.ui.node = null; hooks.seek(Math.min(b - 0.05, a + (b - a) / 2)); render(); },
  'grp-split'() {
    const s = st(); if (!s) return; const t = s.scenes.slice(1).map((x) => x.a).reduce((b, x) => (b === null || Math.abs(x - app.ph) < Math.abs(b - app.ph) ? x : b), null);
    if (t === null) { toast('Esse vídeo tem uma cena só.'); return; }
    mutEdit('Dividir grupo em ' + fmtT(t), (e) => M.splitGroup(e, t)); hooks.seek(t + 0.05);
  },
  'grp-join'() { const i = gi(); if (i > 0) mutEdit('Juntar G' + i + ' e G' + (i + 1), (e) => M.joinGroup(e, i)); },
  'grp-auto'() { hooks.autoGroups(true); },
  'wheel-style'(el) { app.ui.wheelStyle = el.dataset.v; localStorage.setItem('wb.wheels', el.dataset.v); renderInsp(); },
  'wheel-reset'(el) { const w = el.dataset.w; const id = app.ui.node || curNode().id; mutGrade('Zerar ' + w, (gr) => { const n = G.findNode(gr, id); n.prim[w] = [0, 0]; n.prim[w + 'Y'] = 0; return gr; }); },
  'pal-sim'() {
    if (!app.palCor) { toast('Espere a prévia carregar.'); return; }
    const dst = clone(M.refPalette(proj()) || EX_PAL); const src = clone(app.palCor); let id = null;
    mutGrade('Simular a cor do filme', (gr) => {
      let n = G.allNodes(gr).find((x) => x.kind === 'pal');
      if (n) { n.src = src; n.dst = dst; } else { n = G.newNode('pal', { src, dst, name: 'N' + (G.allNodes(gr).length + 1) + ' · Paleta do filme' }); const i = gr.serial.findIndex((x) => x.kind === 'prim'); gr.serial.splice(i + 1, 0, n); }
      id = n.id; return gr;
    });
    app.ui.node = id; render(); toast('Cores simuladas. Clique em qualquer cor no painel da direita pra ajustar.');
  },
  'pal-resample'() { if (!app.palCor) return; const id = app.ui.node; const src = clone(app.palCor); mutGrade('Paleta do quadro atual', (gr) => { G.findNode(gr, id).src = src; return gr; }); },
  'pal-pullref'() { const id = app.ui.node; const dst = clone(M.refPalette(proj()) || EX_PAL); mutGrade('Paleta da referência', (gr) => { G.findNode(gr, id).dst = dst; return gr; }); },
  'cmini'() {},
  'grade-copy'() { app.gradeClip = clone(target()); toast('Grade copiada. Use "Colar nas outras" pra aplicar em todos os outros grupos.'); renderInsp(); },
  'grade-paste'() {
    if (!app.gradeClip) return; const i = gi();
    mutEdit('Colar grade nos outros grupos', (e) => { e.grades = e.grades.map((g, k) => (k === i ? g : clone(app.gradeClip))); return e; }); toast('Grade colada em ' + (M.groupCount(edit()) - 1) + ' grupos.');
  },
  'grade-reset'() { mutGrade('Resetar grade', () => G.defaultGrade()); app.ui.node = null; render(); },
  'still-grab'() {
    const cv = $('#cv-cor') || $('#cv-mon'); if (!cv || !app.view) return;
    const c = document.createElement('canvas'); const w = 240; c.width = w; c.height = Math.round(w * cv.height / cv.width); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', 0.78); const n = edit().stills.length + 1;
    mutEdit('Guardar still', (e) => { e.stills.push({ id: 's' + Date.now().toString(36), label: 'Still ' + String(n).padStart(2, '0') + ' · G' + (gi() + 1), group: gi(), url }); return e; });
  },
  'still-pick'(el) { app.ui.stillSel = app.ui.stillSel === el.dataset.id ? null : el.dataset.id; if (app.ui.stillSel && app.ui.cv === 'atual') app.ui.cv = 'split'; render(); hooks.preview(); },
  'still-del'() { const id = app.ui.stillSel; if (!id) return; mutEdit('Apagar still', (e) => { e.stills = e.stills.filter((s) => s.id !== id); return e; }); app.ui.stillSel = null; render(); },
  'ref-load'() { $('#ref-file').click(); },
  'pal-start'() {
    if (!app.palCor) { toast('Espere a prévia carregar.'); return; }
    const ref = M.refPalette(edit()) || EX_PAL; const p = G.primFromPalettes(app.palCor, ref);
    mutGrade('Ponto de partida pela referência', (gr) => { const n = gr.serial.find((x) => x.kind === 'prim'); if (n) { n.prim = { ...n.prim, lift: p.lift, gamma: p.gamma, gain: p.gain }; } return gr; });
    toast('Rodas ajustadas pra aproximar da paleta de referência. Refine no N1 · Primária.');
  },
  'lut-import'() { $('#lut-file').click(); },
  'lut-toggle'(el) {
    const name = el.dataset.name; const id = curNode() && curNode().kind === 'prim' ? curNode().id : null;
    mutGrade('LUT ' + name, (gr) => { const n = id ? G.findNode(gr, id) : gr.serial.find((x) => x.kind === 'prim'); if (n) n.lut = n.lut === name ? null : name; return gr; });
  }
};

// ---------- entradas contínuas ----------
function sliderInput(ev) {
  const el = ev.target;
  if (el.dataset.act === 'palsw') { const id = app.ui.node; const { side, b, i } = el.dataset; const v = el.value; mutGrade('Cor da paleta', (gr) => { const n = G.findNode(gr, id); n[side][+b][+i] = v; return gr; }, 'pw:' + id + side + b + i, true); hooks.preview(); return; }
  if (el.dataset.act !== 'cslider') return;
  const path = el.dataset.path; const k = el.dataset.k; const v = +el.value; const id = app.ui.node || curNode().id;
  mutGrade('Ajustar ' + k, (gr) => { const n = G.findNode(gr, id); if (path === 'prim') n.prim[k] = v; else if (path === 'adj') n.adj[k] = v; else if (path.startsWith('palb')) n.bands[+path.slice(4)] = v; else n[k] = v; return gr; }, 'c:' + id + k + path, true);
  el.style.setProperty('--p', pctOf(v, +el.min, +el.max));
  const d = [...PRIM, ...HALA, ...QADJ, ['soft', '', 0, 1, 0, (x) => Math.round(x * 100) + '%'], ['amount', '', 0, 1.5, 0, (x) => Math.round(x * 100) + '%'], ['b0', '', 0, 0, 0, (x) => Math.round(x * 100) + '%'], ['b1', '', 0, 0, 0, (x) => Math.round(x * 100) + '%'], ['b2', '', 0, 0, 0, (x) => Math.round(x * 100) + '%'], ['sat', '', 0, 0, 0, (x) => (x > 0 ? '+' : '') + Math.round(x)]].find((x) => x[0] === k && (path !== 'adj' || QADJ.includes(x)) && (path === 'prim' || path === 'adj' || !['sat'].includes(k) || path === 'pal'));
  const sl = el.closest('.sl'); const lab = sl && sl.querySelector('[data-val]'); if (lab && d) lab.textContent = d[5](v);
  if (/Y$/.test(k)) refreshRgb(k.slice(0, -1));
  hooks.preview();
}
function refreshRgb(w) {
  const el = document.querySelector('[data-rgb="' + w + '"]'); const nd = curNode(); if (!el || !nd || nd.kind !== 'prim') return;
  const p = nd.prim; const v = G.puckToVec(p[w], G.WHEEL_K[w]); const y = (p[w + 'Y'] || 0) * { lift: 0.25, gamma: 0.6, gain: 0.6, offset: 0.2 }[w];
  const f = (x) => (x >= 0 ? ' ' : '−') + Math.abs(x).toFixed(2).replace('.', ',');
  el.innerHTML = `<span class="r">R${f(v[0] + y)}</span><span class="g">G${f(v[1] + y)}</span><span class="b">B${f(v[2] + y)}</span><span>Y ${f(p[w + 'Y'] || 0)}</span>`;
}
let cd = null;
function down(ev) {
  const wheel = ev.target.closest('[data-wheel]'); const vline = ev.target.closest('#vline'); const strip = ev.target.closest('[data-range]'); const curve = ev.target.closest('#curve');
  if (wheel) { const nd = G.findNode(target(), app.ui.node || curNode().id); cd = { type: 'wheel', el: wheel, w: wheel.dataset.wheel, x0: ev.clientX, y0: ev.clientY, p0: nd.prim[wheel.dataset.wheel].slice() }; if (!ev.shiftKey) moveWheel(ev); }
  else if (vline) cd = { type: 'split', wrap: $('#cv-wrap') };
  else if (strip) { const r = strip.getBoundingClientRect(); const edge = ev.target.dataset.edge; const win = ev.target.closest('.win'); const nd = G.findNode(target(), app.ui.node || curNode().id); cd = { type: 'range', strip, k: strip.dataset.range, max: +strip.dataset.max, edge: edge || (win ? 'move' : 'jump'), r, x0: ev.clientX, lo: nd.range[strip.dataset.range][0], hi: nd.range[strip.dataset.range][1] }; if (cd.edge === 'jump') { const c = (ev.clientX - r.left) / r.width * cd.max; const half = (cd.hi - cd.lo) / 2; cd.lo = c - half; cd.hi = c + half; cd.edge = 'move'; cd.x0 = ev.clientX; moveRange(ev); } }
  else if (curve) {
    const pt = ev.target.closest('.pt'); const nd = G.findNode(target(), app.ui.node || curNode().id);
    if (pt) cd = { type: 'curve', i: +pt.dataset.i, svg: curve, id: nd.id };
    else { const r = curve.getBoundingClientRect(); const x = clamp((ev.clientX - r.left) / r.width, 0.01, 0.99); const y = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1); mutGrade('Ponto na curva', (gr) => { const n = G.findNode(gr, nd.id); n.pts.push([x, y]); n.pts.sort((a, b) => a[0] - b[0]); return gr; }); return; }
  } else return;
  ev.preventDefault();
}
function moveWheel(ev) {
  const r = cd.el.getBoundingClientRect(); let x; let y;
  if (ev.shiftKey) { x = cd.p0[0] + (ev.clientX - cd.x0) / r.width * 0.4; y = cd.p0[1] - (ev.clientY - cd.y0) / r.height * 0.4; } else { x = ((ev.clientX - r.left) / r.width - 0.5) * 2; y = -((ev.clientY - r.top) / r.height - 0.5) * 2; }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  const id = app.ui.node || curNode().id; const w = cd.w;
  mutGrade('Roda ' + w, (gr) => { G.findNode(gr, id).prim[w] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]; return gr; }, 'w:' + id + w, true);
  const dot = cd.el.querySelector('i'); dot.style.left = 50 + x * 50 + '%'; dot.style.top = 50 - y * 50 + '%'; refreshRgb(w); hooks.preview();
}
function moveRange(ev) {
  const d = (ev.clientX - cd.x0) / cd.r.width * cd.max; let lo = cd.lo; let hi = cd.hi;
  if (cd.edge === 'l') lo = clamp(cd.lo + d, 0, cd.hi - 2); else if (cd.edge === 'r') hi = clamp(cd.hi + d, cd.lo + 2, cd.max); else { const w = cd.hi - cd.lo; lo = clamp(cd.lo + d, 0, cd.max - w); hi = lo + w; }
  const id = app.ui.node || curNode().id; const k = cd.k;
  mutGrade('Faixa do qualificador', (gr) => { G.findNode(gr, id).range[k] = [Math.round(lo), Math.round(hi)]; return gr; }, 'q:' + id + k, true);
  const win = cd.strip.querySelector('.win'); win.style.left = lo / cd.max * 100 + '%'; win.style.width = (hi - lo) / cd.max * 100 + '%';
  cd.strip.parentElement.querySelector('.h span').textContent = Math.round(lo) + '–' + Math.round(hi); hooks.preview();
}
function move(ev) {
  if (!cd) return;
  if (cd.type === 'wheel') moveWheel(ev);
  else if (cd.type === 'split') { const r = cd.wrap.getBoundingClientRect(); app.ui.split = clamp((ev.clientX - r.left) / r.width, 0.02, 0.98); $('#vline').style.left = app.ui.split * 100 + '%'; hooks.preview(); }
  else if (cd.type === 'range') moveRange(ev);
  else if (cd.type === 'curve') {
    const r = cd.svg.getBoundingClientRect(); const g = target(); const nd = G.findNode(g, cd.id); const n = nd.pts.length; const end = cd.i === 0 || cd.i === n - 1;
    let x = clamp((ev.clientX - r.left) / r.width, 0, 1); const y = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1);
    if (end) x = nd.pts[cd.i][0]; else x = clamp(x, nd.pts[cd.i - 1][0] + 0.01, nd.pts[cd.i + 1][0] - 0.01);
    mutGrade('Mexer na curva', (gr) => { G.findNode(gr, cd.id).pts[cd.i] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]; return gr; }, 'cv:' + cd.id, true);
    const wrap = cd.svg.parentElement; wrap.innerHTML = curveHtml(G.findNode(target(), cd.id)); cd.svg = $('#curve'); hooks.preview();
  }
}
function up() { if (cd) { if (cd.type !== 'split' && app.hist) app.hist.seal(); const t = cd.type; cd = null; if (t !== 'split') render(); } }
function dbl(ev) {
  const wheel = ev.target.closest('[data-wheel]');
  if (wheel) { const id = app.ui.node || curNode().id; mutGrade('Zerar roda', (gr) => { G.findNode(gr, id).prim[wheel.dataset.wheel] = [0, 0]; return gr; }); return; }
  const pt = ev.target.closest('#curve .pt');
  if (pt) { const id = app.ui.node || curNode().id; const i = +pt.dataset.i; const nd = G.findNode(target(), id); if (i === 0 || i === nd.pts.length - 1) return; mutGrade('Apagar ponto da curva', (gr) => { G.findNode(gr, id).pts.splice(i, 1); return gr; }); }
}

export function bind() {
  const v = $('#view-cor');
  v.addEventListener('click', (e) => { const ln = e.target.closest('[data-cl]'); if (!ln || !app.duration) return; const r = ln.getBoundingClientRect(); hooks.seek(clamp((e.clientX - r.left) / r.width, 0, 1) * app.duration); });
  v.addEventListener('input', sliderInput);
  v.addEventListener('change', (e) => { if (['cslider', 'palsw'].includes(e.target.dataset.act) && app.hist) { app.hist.seal(); render(); } });
  v.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); v.addEventListener('dblclick', dbl);
  $('#lut-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const cube = G.parseCube(await f.text()); const name = f.name; app.luts = app.luts.filter((l) => l.name !== name).concat([{ name, cube }]); toast('LUT ' + name + ' importada (' + cube.size + '³). Clique nela pra aplicar no nó.'); render(); } catch (err) { toast('Não consegui ler a LUT: ' + err.message); }
  });
  $('#ref-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const img = new Image(); img.src = URL.createObjectURL(f); await img.decode().catch(() => {});
    const c = document.createElement('canvas'); const s = Math.min(1, 640 / Math.max(img.width, img.height)); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    app.refImg = c; const pal = G.extractPalette(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
    const tk = app.palTarget; app.palTarget = null;
    mutProj('Paleta de referência', (ed) => { const r = tk ? ed.cinema.find((x) => x.key === tk) : ed.cinema.find((x) => x.state === 'use'); if (r) r.pal = pal; else ed.refPal = pal; return ed; });
    app.ui.stillSel = null; if (app.ui.cv === 'atual') app.ui.cv = 'split'; render(); hooks.renderAll(); toast('Paleta anotada' + (tk ? ' na referência' : '') + '. Ela vira a referência do projeto no monitor e na aba Cor.');
  });
}
