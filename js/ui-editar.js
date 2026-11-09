// Tela Editar: rail, Efeitos, monitor, detector de cenas, Auto-FX, timeline e inspetor.
import { app, $, $$, esc, p2, fmtT, fmtClock, dsec, dis, N, clone, clamp, video, still, st, edit, commit, mutEdit, say, hooks, toast, compsAt } from './store.js';
import * as P from './project.js';
import { selectCuts, SENS_LABELS } from './detect.js';
import * as M from './model.js';
import * as F from './fx.js';
import { outSize } from './render.js';
import { extractPalette } from './grade.js';
import { sampleCanvas } from './render.js';
import { SOUNDS } from './fx.js';

const SMALL = ['de', 'da', 'do', 'das', 'dos', 'à', 'e', 'a', 'o'];
const nice = (s) => String(s).toLowerCase().split(' ').map((w, i) => (i && SMALL.includes(w) ? w : i ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const titleCase = (s) => String(s).toLowerCase().split(' ').map((w, i) => (i && SMALL.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
const EX_PAL = [
  ['#f2d9a8', '#e8c27a', '#f5e6c8', '#e0b36a', '#f0cf94', '#fbefd2'],
  ['#c98a3d', '#a8692b', '#b9803a', '#8f5a2a', '#d09a52', '#9c6a35'],
  ['#3b2412', '#2a1a0e', '#4a2c14', '#1d130a', '#33200f', '#140e08']
];
const IC = {
  Briefing: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5', 'Transcrição': 'M4 6h16 M4 12h10 M4 18h13',
  Cortes: 'M3.5 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M3.5 18a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M8 7.5L20 18 M8 16.5L20 6',
  Reenquadrar: 'M7 3v14h14 M3 7h14v14', Tarja: 'M3 14h18v5H3z M3 5h10', Legendas: 'M4 5h16v14H4z M8 11h3 M13 11h3 M8 15h8',
  Motion: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z', Sons: 'M4 10v4h4l5 4V6L8 10z M16 9a4 4 0 0 1 0 6',
  Cor: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.1-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z M7.5 11h.01 M10 7.5h.01 M14.5 7.5h.01',
  'Auto-FX': 'M5 19L15 9 M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z M19 12l.7 1.3L21 14l-1.3.7L19 16l-.7-1.3L17 14l1.3-.7z'
};
const TOOLS = Object.keys(IC);

const items = () => (edit() ? edit().fx : []);
export const selItem = () => items().find((f) => f.id === app.ui.sel) || null;
const curScene = () => { const s = st(); return s ? P.sceneAt(s.scenes, app.ph) : 0; };
const curGroup = () => (edit() ? M.groupAt(edit(), app.ph) : 0);

// ---------- rail ----------
export function renderRail() {
  $('#rail').innerHTML = TOOLS.map((n) => `<button type="button" title="${n}" aria-label="${n}" aria-pressed="${app.ui.tool === n}" data-act="tool" data-name="${n}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join('');
}

// ---------- Efeitos ----------
const BADGE = { Ajuste: '', Linguagem: 'ghost', Preset: '', Gerado: 'ghost', Arquivo: 'dash' };
function libRows() {
  const q = app.ui.search.trim().toLowerCase();
  const hit = (...s) => !q || s.join(' ').toLowerCase().includes(q);
  const e = edit();
  if (app.ui.etab === 'tec') return F.TECH.filter((t) => hit(t.name, t.hint)).map((t) => `<button type="button" class="lib-row" data-act="fx-add" data-k="${t.key}"><span class="t"><b>${t.name}</b><span class="h">${t.hint}</span></span><span class="badge ${BADGE[t.badge]}">${t.badge}</span></button>`).join('');
  if (app.ui.etab === 'cin') {
    const rows = (e ? e.cinema : M.DEFAULT_CINEMA).filter((c) => hit(c.name, c.dir)).map((c) => {
      const links = F.CINEMA_SITES.map(([n, u]) => `<a href="${u}${u.endsWith('=') ? encodeURIComponent(c.name.toLowerCase()) : ''}" target="_blank" rel="noopener noreferrer">${n}</a>`).join(' · ');
      return `<div class="lib-row" role="group"><span class="t"><b>${esc(c.name)}</b><span class="h">${esc(c.dir || '')}</span><span class="h2">${links}</span></span><button type="button" class="badge ${c.state === 'use' ? 'use' : 'ghost'}" style="border:${c.state === 'use' ? '0' : '1px solid #6a7078'};cursor:pointer" data-act="cin-toggle" data-k="${c.key}" title="Clique pra ${c.state === 'use' ? 'guardar' : 'usar no projeto'}">${c.state === 'use' ? 'Em uso' : 'Salvo'}</button></div>`;
    }).join('');
    return rows + `<button type="button" class="lib-row" data-act="cin-add"><span class="t"><b>ADICIONAR REFERÊNCIA</b><span class="h">Cole o link de um dos três sites</span></span><span class="badge ghost">Novo</span></button>`;
  }
  return F.TEXTURES.filter((t) => hit(t.name, t.hint)).map((t) => `<button type="button" class="lib-row" data-act="tex-add" data-k="${t.key}"><span class="t"><b>${t.name}</b><span class="h">${t.hint}</span></span><span class="badge ${BADGE[t.badge]}">${t.badge}</span></button>`).join('')
    + `<button type="button" class="lib-row" data-act="ov-add"><span class="t"><b>${F.OVERLAY.name}</b><span class="h">${F.OVERLAY.hint}</span></span><span class="badge dash">Arquivo</span></button>`;
}
const NOTES = { tec: 'Vocabulário Eyecandy: só o nome e a receita. O efeito é produzido aqui.', cin: 'Os links levam pro Film Grab, Flim e Movies in Color. Nenhuma imagem deles fica aqui.', tex: 'Gerado no Workbench. Overlays em arquivo vêm da tua biblioteca.' };
export function renderEfeitos() {
  const t = app.ui.etab;
  $('#efeitos').innerHTML = `<div class="p-head"><h2 class="tool" style="margin-bottom:10px">Efeitos</h2>
    <div class="seg" style="display:flex">${[['tec', 'Técnicas'], ['cin', 'Cinema'], ['tex', 'Textura']].map(([k, l]) => `<button type="button" style="flex:1" aria-pressed="${t === k}" data-act="etab" data-v="${k}">${l}</button>`).join('')}</div>
    <input class="search" id="fx-search" type="text" aria-label="Buscar" placeholder="Buscar nome, filme ou diretor" value="${esc(app.ui.search)}" autocomplete="off"></div>
    <div class="p-list" id="lib-list">${libRows()}</div><div class="p-foot">${NOTES[t]}</div>`;
}
const refreshLib = () => { const l = $('#lib-list'); if (l) l.innerHTML = libRows(); };

// ---------- monitor ----------
export function renderMonitorBar() {
  const e = edit();
  $('#plats').innerHTML = F.PLATFORMS.map((p) => `<button type="button" aria-pressed="${e ? e.platform === p.key : p.key === 'tiktok'}" data-act="platform" data-v="${p.key}">${p.label}</button>`).join('');
  $('#ratios').innerHTML = P.RATIOS.map((r) => `<button type="button" data-act="ratio" data-v="${r}" aria-pressed="${r === app.ratio}">${r}</button>`).join('');
  const use = (e ? e.cinema : M.DEFAULT_CINEMA).filter((c) => c.state === 'use');
  const first = use[0];
  $('#style-pill').textContent = 'Estilo: ' + (first ? titleCase(first.name) + (use.length > 1 ? ' +' + (use.length - 1) : '') : 'nenhum');
  const fp = $('#fxprev'); fp.setAttribute('aria-pressed', String(app.ui.fxPreview));
  $('#play').innerHTML = video.paused ? '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 5h4v14H7z M13 5h4v14h-4z" fill="currentColor"/></svg>';
}

const sw = (cols) => '<div class="sw">' + cols.map((c) => `<i style="background:${c}"></i>`).join('') + '</div>';
export function renderPalette() {
  const cur = app.palCur; const ref = (edit() && edit().refPal) || EX_PAL;
  const blk = (p) => ['Claros', 'Médios', 'Escuros'].map((l, i) => `<div class="lb">${l}</div>${sw(p ? p[i] : [])}`).join('');
  $('#pal').innerHTML = `<div><div class="t">Teu material · cena atual</div>${blk(cur)}</div>
    <div><div class="t">Referência</div><div class="s">${edit() && edit().refPal ? 'Paleta anotada por você' : 'Exemplo, a paleta é anotada por você'}</div>${blk(ref)}</div>
    <button type="button" class="btn" style="margin-top:auto" data-act="go-cor">Abrir na aba Cor</button>`;
}

export function updateChips(info) {
  const e = edit(); const s = st();
  const chip = $('#scene-chip'); const fc = $('#fx-chip');
  if (!s || app.view !== 'video') { chip.hidden = true; fc.hidden = true; return; }
  const i = P.sceneAt(s.scenes, app.ph); const k = P.RATIOS.indexOf(app.ratio);
  chip.hidden = false; chip.textContent = N(i) + (k >= 0 && k < 3 ? ' · ' + app.ratio + ' ' + P.MODES[s.scenes[i].m[k]] : ' · original');
  const act = info && info.active && info.active.length ? e.fx.find((f) => f.id === info.active[0]) : null;
  fc.hidden = !act || !app.ui.fxPreview; if (act) fc.textContent = 'FX · ' + nice(act.name);
}

export function timecode() {
  $('#timecode').innerHTML = fmtT(app.ph) + ' <span class="muted">/ ' + fmtT(app.duration) + '</span>';
}

// ---------- detector ----------
export function renderDetector() {
  const el = $('#detector'); const s = st(); const h = app.hist;
  if (!s) {
    const msg = app.error || app.notice || (app.busy ? 'Lendo o vídeo e procurando os cortes…' : 'Abra um vídeo pra o Workbench achar os cortes de cena.');
    el.innerHTML = `<div class="d-head"><h2 class="tool">Detector de cenas</h2><span class="pill-tag">${app.busy ? 'analisando' : 'sem vídeo'}</span></div><div class="muted">${esc(msg)}</div>`;
    return;
  }
  const { scenes, sens } = s; const i = P.sceneAt(scenes, app.ph); const sc = scenes[i];
  const ctrls = [['Dividir no playhead', 'split', P.canSplit(scenes, i, app.ph)], ['Juntar com a anterior', 'join-prev', P.canJoinPrev(scenes, i)], ['Juntar com a próxima', 'join-next', P.canJoinNext(scenes, i)], ['Corte −0,5 s', 'cut-', P.canMoveCut(scenes, i, -0.5)], ['Corte +0,5 s', 'cut+', P.canMoveCut(scenes, i, 0.5)]];
  const k = P.RATIOS.indexOf(app.ratio); const manual = k >= 0 && k < 3 && sc.m[k] === 2;
  const frames = [['9:16', 25, 0], ['1:1', 44, 1], ['4:5', 35, 2], ['16:9', 78, -1]].map(([r, w, kk]) => {
    const m = kk >= 0 ? sc.m[kk] : -1; const x = kk < 0 ? 62 : m === 2 ? sc.ox[kk] : 50;
    return `<button type="button" class="fmt" data-act="mode" data-k="${kk}" aria-disabled="${dis(kk >= 0)}" aria-label="${kk < 0 ? '16:9 mantém o quadro original' : 'Enquadramento ' + r + ' de ' + N(i) + ': ' + P.MODES[m] + '. Toque para trocar.'}"><span class="box${m === 2 ? ' man' : ''}" style="width:${w}px"><span class="head" style="left:${x}%"></span><span class="body" style="left:${x}%"></span></span><span class="l">${r}</span><span class="md">${kk < 0 ? 'Original' : P.MODES[m]}</span></button>`;
  }).join('');
  el.innerHTML = `<div class="d-head"><h2 class="tool">Detector de cenas</h2><span class="pill-tag">${scenes.length} cenas</span>
    <div class="sens"><span class="muted" style="font-size:11px;font-weight:600">Sensibilidade</span><button type="button" class="btn sm" data-act="sens-" aria-label="Menos sensível" aria-disabled="${dis(sens > 0)}">−</button><span class="lbl">${SENS_LABELS[sens]}</span><button type="button" class="btn sm" data-act="sens+" aria-label="Mais sensível" aria-disabled="${dis(sens < 4)}">+</button></div>
    <div class="status" id="d-status">Última ação: <b>${esc(h.label)}</b> · passo ${h.step} de ${h.total}</div>
    <button type="button" class="btn sm" data-act="undo" aria-disabled="${dis(h.canUndo)}" title="${h.canUndo ? 'Desfazer: ' + esc(h.undoLabel) : 'Nada para desfazer'}">Desfazer</button>
    <button type="button" class="btn sm" data-act="redo" aria-disabled="${dis(h.canRedo)}" title="${h.canRedo ? 'Refazer: ' + esc(h.redoLabel) : 'Nada para refazer'}">Refazer</button></div>
    <div class="ctrls" role="group" aria-label="Ajustes da cena selecionada">${ctrls.map(([l, a, ok]) => `<button type="button" class="btn" data-act="${a}" aria-disabled="${dis(ok)}">${l}</button>`).join('')}</div>
    <div class="d-body"><div class="cards" aria-label="Cenas">${scenes.map((c, n) => `<button type="button" class="sc" data-act="pick" data-i="${n}" aria-pressed="${n === i}"><span class="r1"><b>${N(n)}</b><span class="m">${dsec(c.a, c.b)}</span></span><span class="t">${fmtT(c.a)} → ${fmtT(c.b)}</span><span class="g">9:16 · ${P.MODES[c.m[0]]}</span></button>`).join('')}</div>
    <div class="fmts"><div class="fmts-title">Formatos de ${N(i)} · toque pra trocar</div><div class="fmts-row">${frames}</div>
    <label class="offset" aria-disabled="${dis(manual)}">Posição (${app.ratio})<input type="range" min="0" max="100" value="${manual ? sc.ox[k] : 50}" style="--p:${manual ? sc.ox[k] : 50}%" data-act="offset" ${manual ? '' : 'disabled'}></label></div></div>`;
  const sel = el.querySelector('.sc[aria-pressed="true"]'); if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// muda as cenas e mantém os grupos de cor colados nos cortes
function commitScenes(label, scenes, extra = {}, key = null) {
  commit(label, (s) => { s.scenes = scenes; if (extra.sens != null) s.sens = extra.sens; s.edit = M.reconcile(s.edit, scenes); return s; }, key);
}
function moveCut(d) {
  const { scenes } = st(); const i = curScene(); if (!P.canMoveCut(scenes, i, d)) return;
  const n = P.moveCut(scenes, i, d);
  if (app.ph < n[i].a) app.ph = P.r1(n[i].a + 0.1);
  video.currentTime = app.ph;
  commitScenes('Mover corte de ' + N(i) + ' ' + (d < 0 ? '−' : '+') + '0,5 s', n);
}
function setSens(d) {
  const s = st(); const ns = clamp(s.sens + d, 0, 4); if (ns === s.sens) return;
  commitScenes('Sensibilidade: ' + SENS_LABELS[ns], P.scenesFromCuts(selectCuts(app.cands, ns, app.duration), app.duration), { sens: ns });
}

// ---------- Auto-FX ----------
export function renderAutofx() {
  const e = edit(); const el = $('#autofx');
  const c = e ? F.countSuggested(e.fx) : { fx: 0, tx: 0, sfx: 0 };
  const pend = c.fx + c.tx;
  const ic = '<svg width="18" height="18" viewBox="0 0 24 24"><path d="' + IC['Auto-FX'] + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (!e || !st()) { el.innerHTML = `<div class="ic">${ic}</div><div class="tx"><b>Auto-FX</b><span>Abra um vídeo e o Auto-FX sugere efeitos, texturas e sons a partir dos cortes de cena e do estilo do projeto.</span></div>`; return; }
  const hasAuto = e.fx.some((f) => f.auto);
  const style = e.cinema.filter((x) => x.state === 'use').map((x) => titleCase(x.name))[0] || 'estilo livre';
  el.innerHTML = `<div class="ic">${ic}</div><div class="tx"><b>${hasAuto ? 'Auto-FX leu os cortes de cena e o estilo do projeto' : 'Auto-FX ainda não sugeriu nada'}</b>
    <span>${pend ? `${c.fx} efeitos, ${c.tx} texturas e ${c.sfx} sons sugeridos. Tudo pode ser movido, trocado ou apagado.` : hasAuto ? 'Tudo aceito. Você ainda pode mover, trocar ou apagar na timeline.' : `Sugere efeitos nos cortes mais fortes, texturas pelo estilo (${esc(style)}) e sons. A transcrição entra numa próxima etapa.`}</span></div>
    ${pend ? '<button type="button" class="btn" data-act="autofx-review">Revisar um a um</button><button type="button" class="btn solid" data-act="autofx-accept">Aceitar tudo</button>'
      : `<button type="button" class="btn solid" data-act="autofx-run">${hasAuto ? 'Sugerir de novo' : 'Sugerir agora'}</button>`}`;
}
function autofxRun() {
  const s = st(); if (!s) return;
  const e = s.edit; const style = (e.cinema.find((c) => c.state === 'use') || { key: 'cdd' }).key;
  const sug = F.suggest({ scenes: s.scenes, cands: app.cands, duration: app.duration, platformKey: e.platform, styleKey: style });
  mutEdit('Auto-FX: ' + sug.length + ' sugestões', (ed) => { ed.fx = ed.fx.filter((f) => !(f.auto && !f.accepted)).concat(sug); return ed; });
  app.ui.sel = sug[0] ? sug[0].id : null; app.ui.itab = 'efeito'; hooks.renderAll();
  toast(sug.length + ' sugestões na timeline. Clique em cada uma pra ver o motivo.');
}

// ---------- timeline ----------
const laneTime = (lane, x) => { const r = lane.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * app.duration; };
const pc = (t) => (t / app.duration * 100).toFixed(3) + '%';
const span = (a, b) => `left:${pc(a)};width:${((b - a) / app.duration * 100).toFixed(3)}%`;

function tickStep(d) { for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (d / s <= 12) return s; return 600; }

export function renderTimeline() {
  const el = $('#tl-card'); const s = st(); const e = edit();
  const plat = e ? F.PLATFORMS.find((p) => p.key === e.platform) : F.PLATFORMS[1];
  el.innerHTML = `<div class="tl-head"><div class="l"><h2 class="tool">Timeline</h2><span class="muted" style="font-weight:600">${plat.label.split(' · ')[0]} · ${s ? fmtClock(F.outDuration(e.fx, app.duration)).padStart(5, '0') : '00:00'}</span></div>
    <div class="legend"><span class="k"><i style="background:#e6e7e9"></i>Vídeo</span><span class="k"><i style="background:#6b7077"></i>Cenas</span><span class="k"><i style="background:var(--wine)"></i>FX</span><span class="k"><i style="border:1.5px solid var(--wine-line)"></i>Textura</span>
    <button type="button" class="btn sm" data-act="blade" aria-pressed="${app.ui.blade}" title="Clique numa faixa de cenas pra cortar naquele ponto">Lâmina</button>
    <button type="button" class="btn sm" data-act="snap" aria-pressed="${app.ui.snap}" title="Gruda nos cortes e nas bordas dos outros itens">Ímã</button></div></div>
    <div class="tl-body" id="timeline"></div>`;
  const body = $('#timeline');
  if (!s) { body.innerHTML = '<div class="tl-empty">A timeline aparece quando um vídeo for aberto.</div>'; return; }
  const D = app.duration; const g = (name, html, cls = '', lane = '') => `<div class="row ${cls}"><div class="name${cls === 'fxr' ? ' wine' : ''}">${name}</div><div class="lane" data-lane="${lane}">${html}</div></div>`;
  const ticks = []; for (let t = 0; t <= D; t += tickStep(D)) ticks.push(`<span class="tick" style="left:${pc(t)}">${fmtClock(t)}</span>`);
  const clip = (it, cls, label, a = it.a, b = it.b) => `<div class="clip ${cls}${app.ui.sel === it.id ? ' sel' : ''}${it.auto && !it.accepted ? ' sug' : ''}" data-clip="${it.id}" style="${span(a, b)}" title="${esc(nice(it.name))} · ${fmtT(it.a)} → ${fmtT(it.b)}">${esc(label)}<span class="rz" data-rz="1"></span></div>`;
  const tec = e.fx.filter((f) => f.kind === 'tec').map((f) => clip(f, 'fx', f.key === 'dolly' ? 'Dolly' : 'FX · ' + nice(f.name))).join('');
  const tex = e.fx.filter((f) => f.kind === 'tx').map((f) => clip(f, 'tx', nice(f.name))).join('');
  const ov = e.fx.filter((f) => f.kind === 'ov').map((f) => clip(f, 'ov', f.file || 'overlay')).join('');
  const tt = e.fx.filter((f) => f.kind === 'tt').map((f) => clip(f, 'tt', f.params.text || f.name)).join('');
  const sfx = e.fx.filter((f) => f.sfx).map((f) => { const sd = F.SOUNDS.find((x) => x.key === f.sfx.key) || { dur: 0.5, key: '' }; const a = clamp(f.kind === 'sx' ? f.a : f.a + f.sfx.off, 0, D); const b = Math.min(D, a + (f.sfx.key === 'projector' ? Math.min(2, f.b - f.a) : sd.dur)); return `<div class="clip sfx${app.ui.sel === f.id ? ' sel' : ''}" data-sfx="${f.id}" style="${span(a, Math.max(b, a + 0.4))}" title="Som: ${esc(F.soundName(f.sfx.key))}">${esc(sd.key === 'projector' ? 'projetor' : (f.sfx.key))}</div>`; }).join('');
  const ideas = e.ideas.map((i) => `<div class="clip idea${app.ui.selIdea === i.id ? ' sel' : ''}" data-idea="${i.id}" style="${span(i.a, i.b)}">${esc(i.name)}</div>`).join('');
  const cuts = s.scenes.slice(1).map((sc, n) => `<span class="cutm${n + 1 === curScene() ? ' sel' : ''}" style="left:${pc(sc.a)}"></span>`).join('');
  const ng = M.groupCount(e); const gi = curGroup();
  const groups = Array.from({ length: ng }, (_, i) => { const [a, b] = M.groupRange(e, i, D); return `<div class="clip g${i === gi ? ' on' : ''}" data-grp="${i}" style="${span(a, b)};cursor:pointer">G${i + 1}</div>`; }).join('');
  const scenes = s.scenes.map((sc, n) => `<div class="clip v2${n % 2 ? ' alt' : ''}${n === curScene() ? ' cur' : ''}" data-scn="${n}" style="${span(sc.a, sc.b)};cursor:pointer">${N(n)}</div>`).join('');
  const it = app.lib.get(app.activeId);
  body.innerHTML = `<div class="tl-grid">
    ${g('', ticks.join(''), 'ruler', 'ruler')}
    ${g('Ideias <button type="button" class="btn sm" style="margin-left:6px;height:18px;padding:0 6px" data-act="idea-add" title="Marca uma ideia na cena atual (vira um corte no TikTok)">+</button>', ideas, '', 'ideas')}
    ${g('Cortes de cena', cuts, '', 'cuts')}
    ${g('FX · técnicas', tec, 'fxr', 'fx')}
    ${g('Textura e lente', tex, 'fxr', 'tx')}
    ${g('Overlay', ov, '', 'ov')}
    ${g('Texto', tt, '', 'tt')}
    ${g('SFX', sfx, '', 'sfx')}
    ${g('Cor · grade por cena', groups, '', 'grp')}
    ${g('V2 · Cenas', scenes, '', 'scn')}
    ${g('V1 · Vídeo', `<div class="clip v1" style="left:0;width:100%;cursor:default">${esc(app.name)}</div>`, '', 'v1')}
    ${g('A1 · Transcrição', '<span class="lane-hint">A transcrição entra numa próxima etapa</span>', '', 'a1')}
    ${g('A2 · Áudio', `<div class="clip a" style="left:0;width:100%;cursor:default">${esc(it && it.kind === 'video' ? 'áudio de ' + it.name : 'áudio')}</div>`, '', 'a2')}
    <div class="playhead" aria-hidden="true"><i id="ph-line"></i><u id="ph-knob"></u></div></div>`;
  syncPlayhead();
}
export function syncPlayhead() {
  const line = $('#ph-line'); if (!line || !app.duration) return;
  const t = app.view === 'video' ? video.currentTime : app.ph;
  const left = (clamp(t, 0, app.duration) / app.duration * 100).toFixed(3) + '%';
  line.style.left = left; $('#ph-knob').style.left = left;
}

// arrastar e redimensionar itens da timeline
let drag = null;
function snapTimes(exceptId) {
  const e = edit(); const out = [0, app.duration, app.ph];
  st().scenes.forEach((s) => out.push(s.a));
  e.fx.forEach((f) => { if (f.id !== exceptId) { out.push(f.a, f.b); } });
  return out;
}
function onPointerDown(ev) {
  const c = ev.target.closest('[data-clip],[data-sfx]');
  if (!c || !st()) return;
  const id = c.dataset.clip || c.dataset.sfx; const it = edit().fx.find((f) => f.id === id); if (!it) return;
  app.ui.sel = id; app.ui.itab = 'efeito';
  const lane = c.closest('.lane');
  drag = { id, mode: c.dataset.sfx ? 'sfx' : ev.target.dataset.rz ? 'resize' : 'move', x0: ev.clientX, lane, a0: it.a, b0: it.b, off0: it.sfx ? it.sfx.off : 0, moved: false };
  c.setPointerCapture && c.setPointerCapture(ev.pointerId);
  hooks.renderSel();
  ev.preventDefault();
}
function onPointerMove(ev) {
  if (!drag) return;
  const r = drag.lane.getBoundingClientRect(); const dt = (ev.clientX - drag.x0) / r.width * app.duration;
  if (!drag.moved && Math.abs(ev.clientX - drag.x0) < 3) return;
  drag.moved = true;
  const snaps = app.ui.snap ? snapTimes(drag.id) : [];
  const D = app.duration;
  mutLight('Mover ' + nice(edit().fx.find((f) => f.id === drag.id).name), (e2) => {
    const f = e2.fx.find((x) => x.id === drag.id);
    if (drag.mode === 'move') { const [a, b] = M.moveTimes(drag.a0, drag.b0, dt, D, snaps); f.a = a; f.b = b; }
    else if (drag.mode === 'resize') { let nb = clamp(drag.b0 + dt, drag.a0 + 0.1, D); for (const s of snaps) if (Math.abs(nb - s) < 0.12) { nb = s; break; } f.b = Math.round(nb * 100) / 100; if (f.kind === 'tec') F.techOf(f.key).params.forEach((p) => { if (p.len === true) f.params[p.k] = clamp(Math.round((f.b - f.a) * F.FPS), p.min, p.max); else if (p.len === 's') f.params[p.k] = clamp(Math.round((f.b - f.a) * 10) / 10, p.min, p.max); }); }
    else { const na = clamp(drag.a0 + drag.off0 + dt, 0, D); f.sfx.off = Math.round((na - (f.kind === 'sx' ? 0 : drag.a0)) * 100) / 100; if (f.kind === 'sx') { f.a = Math.round(na * 100) / 100; f.b = f.a + 0.5; } }
    return e2;
  }, 'drag:' + drag.id);
  renderTimeline(); hooks.preview();
}
function onPointerUp() { if (drag) { if (drag.moved) { app.hist.seal(); hooks.renderAll(); } drag = null; } }

// atualiza o histórico sem redesenhar tudo (gestos contínuos)
export function mutLight(label, fn, key) {
  const cur = clone(st()); cur.edit = fn(cur.edit) || cur.edit;
  app.hist.push(cur, label, key); app.dirty = true;
  const stt = $('#d-status'); if (stt) stt.innerHTML = 'Última ação: <b>' + esc(app.hist.label) + '</b> · passo ' + app.hist.step + ' de ' + app.hist.total;
  hooks.renderHeader();
}

function laneClick(ev) {
  const lane = ev.target.closest('[data-lane]'); if (!lane || !app.duration) return;
  const t = laneTime(lane, ev.clientX); const kind = lane.dataset.lane;
  const grp = ev.target.closest('[data-grp]'); const scn = ev.target.closest('[data-scn]'); const idea = ev.target.closest('[data-idea]');
  if (ev.target.closest('[data-clip],[data-sfx]')) return;
  if (grp) { app.ui.node = null; hooks.selectGroup(+grp.dataset.grp); return; }
  if (idea) { app.ui.selIdea = idea.dataset.idea; app.ui.sel = null; app.ui.itab = 'clipe'; hooks.seek(clamp(+edit().ideas.find((i) => i.id === idea.dataset.idea).a + 0.05, 0, app.duration)); hooks.renderAll(); return; }
  if (app.ui.blade && (kind === 'scn' || kind === 'cuts' || kind === 'v1')) {
    const { scenes } = st(); const tt = P.r1(t); const i = P.sceneAt(scenes, tt);
    if (P.canSplit(scenes, i, tt)) { app.ph = tt; commitScenes('Lâmina: dividir ' + N(i) + ' em ' + fmtT(tt), P.split(scenes, i, tt)); hooks.seek(tt); } else toast('Aqui a cena ficaria menor que 0,5 s.');
    return;
  }
  hooks.seek(t);
  if (scn) app.ui.itab = 'clipe';
}

// ---------- inspetor ----------
const pctP = (d, v) => F.pctOf(d, v).toFixed(1) + '%';
function sliderHtml(it, d) {
  const v = it.params[d.k]; const step = d.unit === 's' ? 0.1 : 1;
  return `<div class="sl"><div class="h">${d.label}<span data-val="${d.k}">${F.fmtParam(d, v)}</span></div><input type="range" min="${d.min}" max="${d.max}" step="${step}" value="${v}" style="--p:${pctP(d, v)}" data-act="param" data-id="${it.id}" data-k="${d.k}" aria-label="${d.label}"></div>`;
}
function kfHtml(it) {
  const pts = [...it.kf].sort((a, b) => a.x - b.x);
  const poly = pts.map((p) => p.x + ',' + p.y).join(' ');
  return `<div class="kf" id="kf" data-id="${it.id}" style="position:relative"><svg viewBox="0 0 100 40" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><polyline points="${poly}" vector-effect="non-scaling-stroke" style="fill:none;stroke:var(--wine-line);stroke-width:2"/></svg>${pts.map((p, i) => `<i class="kpt" data-i="${it.kf.indexOf(p)}" style="position:absolute;left:${p.x}%;top:${p.y / 40 * 100}%;width:11px;height:11px;margin:-5.5px;background:var(--wine-line);border:1px solid #fff;transform:rotate(45deg);cursor:grab"></i>`).join('')}</div><div class="note">Arraste os pontos. Clique no vazio pra criar, duplo clique num ponto pra apagar.</div>`;
}
function itemHtml(it) {
  const tex = it.kind === 'tt';
  const defs = F.paramDefs(it);
  const sfx = it.sfx ? `<div class="box"><div class="r"><b>${esc(F.soundName(it.sfx.key))}</b><button type="button" class="btn sm" data-act="sfx-swap" data-id="${it.id}">Trocar som</button></div>
      <div class="r" style="margin-top:6px"><small>${it.kind === 'sx' ? 'Som avulso' : it.sfx.key === 'projector' ? 'Em loop, do começo ao fim' : (it.sfx.off < 0 ? 'Entra ' + String(Math.abs(it.sfx.off)).replace('.', ',') + ' s antes' : it.sfx.off > 0 ? 'Entra ' + String(it.sfx.off).replace('.', ',') + ' s depois' : 'Entra junto com o efeito')}</small><span class="mono">${it.sfx.vol > 0 ? '+' : '−'}${Math.abs(it.sfx.vol)} dB</span></div>
      <div class="sl" style="margin-top:6px"><input type="range" min="-30" max="0" value="${it.sfx.vol}" style="--p:${(it.sfx.vol + 30) / 30 * 100}%" data-act="sfx-vol" data-id="${it.id}" aria-label="Volume do som"></div>
      <div style="margin-top:6px"><button type="button" class="btn sm" data-act="sfx-play" data-id="${it.id}">Ouvir</button> <button type="button" class="btn sm" data-act="sfx-off" data-id="${it.id}">Remover som</button></div></div>`
    : (it.kind === 'sx' ? '' : `<div class="box"><div class="r"><small>Sem som neste item</small><button type="button" class="btn sm" data-act="sfx-add" data-id="${it.id}">Adicionar som</button></div></div>`);
  const textF = tex ? `<div class="field" style="margin-top:8px">Texto<input type="text" value="${esc(it.params.text)}" data-act="text" data-k="text" data-id="${it.id}"></div>${it.key === 'tarja' ? `<div class="field" style="margin-top:8px">Subtítulo<input type="text" value="${esc(it.params.sub)}" data-act="text" data-k="sub" data-id="${it.id}"></div>` : ''}` : '';
  const ovF = it.kind === 'ov' ? `<div class="box" style="margin-top:10px"><div class="r"><b>${esc(it.file || 'overlay')}</b></div><small>Licença gratuita · atribuição ${it.credit.required ? 'obrigatória' : 'não exigida'}</small>
      <div class="field" style="margin-top:6px">Criador<input type="text" placeholder="Nome do criador" value="${esc(it.credit.creator)}" data-act="credit" data-id="${it.id}"></div>
      <label class="toggle" style="margin-top:6px"><input type="checkbox" ${it.credit.required ? 'checked' : ''} data-act="credit-req" data-id="${it.id}"> Exige atribuição (entra em creditos.txt na entrega)</label></div>` : '';
  const chips = `<div class="chips"><span class="kchip">${esc(F.kindLabel(it))}</span>${it.auto && !it.accepted ? '<span class="kchip o">Sugerido pela IA</span>' : ''}</div>`;
  return `${chips}<h3 class="big" style="font-size:26px;text-transform:none;letter-spacing:0;color:var(--txt)">${esc(nice(it.name))}</h3>
    <div class="mono muted" id="i-range">${fmtT(it.a)} → ${fmtT(it.b)}</div>
    <div><h3>Por que aqui</h3><div class="why" style="margin-top:6px">${esc(it.why || '')}</div></div>
    ${defs.length || tex || it.kind === 'ov' ? `<div><h3>${tex ? 'Conteúdo' : 'Parâmetros'}</h3>${textF}${defs.map((d) => sliderHtml(it, d)).join('')}${ovF}</div>` : ''}
    ${it.kf && it.kf.length ? `<div><h3>Keyframes</h3><div style="margin-top:6px">${kfHtml(it)}</div></div>` : ''}
    ${it.kind !== 'tt' ? `<div><h3>Som do efeito</h3><div style="margin-top:6px">${sfx}</div></div>` : ''}
    <div><h3>Receita</h3><div style="margin-top:6px;line-height:1.5">${esc(F.recipeOf(it))}</div></div>
    <div class="foot"><button type="button" class="btn solid" data-act="it-accept" ${it.accepted ? 'aria-disabled="true"' : ''}>${it.accepted ? 'Aceito' : 'Aceitar'}</button>${['tec', 'tx'].includes(it.kind) ? '<button type="button" class="btn" data-act="it-swap">Trocar efeito</button>' : ''}<button type="button" class="btn" data-act="it-del">Apagar</button></div>`;
}
function clipeHtml() {
  const s = st(); if (!s) return '<div class="hint-empty">Abra um vídeo pra ver os dados do clipe.</div>';
  const e = edit(); const i = curScene(); const sc = s.scenes[i]; const gi = curGroup();
  const over = e.fx.filter((f) => f.a < sc.b && f.b > sc.a);
  const idea = e.ideas.find((x) => x.id === app.ui.selIdea);
  return `<div class="chips"><span class="kchip o">Clipe</span></div><h3 class="big" style="font-size:26px;text-transform:none;letter-spacing:0;color:var(--txt)">${N(i)}</h3>
    <div class="mono muted">${fmtT(sc.a)} → ${fmtT(sc.b)} · ${dsec(sc.a, sc.b)}</div>
    <div class="box"><div class="r"><span>Grupo de cor</span><b>G${gi + 1}</b></div><div class="r" style="margin-top:6px"><span>Efeitos nesta cena</span><b>${over.length}</b></div></div>
    <div><h3>Enquadramento</h3>${[0, 1, 2].map((k) => `<div class="r box" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>${P.RATIOS[k]}</span><button type="button" class="btn sm" data-act="mode" data-k="${k}">${P.MODES[sc.m[k]]}</button></div>`).join('')}<div class="note" style="margin-top:6px">Rosto ainda enquadra no centro. Manual deixa você arrastar a posição.</div></div>
    ${idea ? `<div><h3>Ideia</h3><div class="field" style="margin-top:6px">Nome<input type="text" value="${esc(idea.name)}" data-act="idea-name" data-id="${idea.id}"></div><div class="mono muted" style="margin-top:6px">${fmtT(idea.a)} → ${fmtT(idea.b)}</div><div class="foot"><button type="button" class="btn" data-act="idea-del" data-id="${idea.id}">Apagar ideia</button></div></div>` : ''}
    ${over.length ? `<div><h3>Itens aqui</h3>${over.map((f) => `<button type="button" class="lib-row" data-act="sel" data-id="${f.id}"><span class="t"><b>${esc(nice(f.name))}</b><span class="h">${fmtT(f.a)} → ${fmtT(f.b)}</span></span></button>`).join('')}</div>` : ''}`;
}
function exportTabHtml() {
  const e = edit(); if (!e || !st()) return '<div class="hint-empty">Abra um vídeo pra ver o resumo da entrega.</div>';
  const plat = F.PLATFORMS.find((p) => p.key === e.platform);
  return `<div class="chips"><span class="kchip o">Exportação</span></div><h3 class="big" style="font-size:26px;text-transform:none;letter-spacing:0;color:var(--txt)">${plat.label.split(' · ')[0]}</h3>
    <div class="box"><div class="r"><span>Formato</span><b>${app.ratio} · ${e.container.toUpperCase()}</b></div><div class="r" style="margin-top:6px"><span>Duração final</span><b>${fmtClock(F.outDuration(e.fx, app.duration))}</b></div><div class="r" style="margin-top:6px"><span>Efeitos / texturas</span><b>${e.fx.filter((f) => f.kind === 'tec').length} / ${e.fx.filter((f) => f.kind === 'tx').length}</b></div><div class="r" style="margin-top:6px"><span>Grupos de cor</span><b>${M.groupCount(e)}</b></div></div>
    <div class="note">A entrega usa o mesmo desenho da prévia: reenquadre, efeitos, cor, textura, overlay e texto.</div>
    <div class="foot"><button type="button" class="btn solid" data-act="tab" data-v="entrega">Ir para Entrega</button></div>`;
}
export function renderInspector() {
  const it = selItem(); const t = app.ui.itab;
  const tabs = [['efeito', 'Efeito'], ['clipe', 'Clipe'], ['exportacao', 'Exportação']];
  let body;
  if (t === 'efeito') body = it ? itemHtml(it) : `<div class="hint-empty">Nada selecionado. Clique num efeito, textura ou som na timeline, ou escolha um em <b>Efeitos</b> à esquerda. O Auto-FX também sugere tudo pra você revisar.</div>`;
  else if (t === 'clipe') body = clipeHtml(); else body = exportTabHtml();
  $('#inspector').innerHTML = `<div class="insp-tabs">${tabs.map(([k, l]) => `<button type="button" data-act="itab" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}</div>${body}`;
}

// ---------- ações ----------
function addItem(label, item) {
  mutEdit(label, (e) => M.addFx(e, item)); app.ui.sel = item.id; app.ui.itab = 'efeito'; hooks.renderAll();
}
function ovCandidates() { return app.lib.items.filter((i) => i.kind === 'video' && i.id !== app.activeId); }
function openOverlayPicker() {
  const c = ovCandidates();
  if (!c.length) { toast('Pra usar overlay, adicione outro vídeo ao Material (de preferência na pasta Overlays).'); return; }
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>Escolha o overlay</h2><div class="muted">Vídeo da tua biblioteca, em modo Screen e em loop sobre o clipe. O arquivo não sai do teu computador.</div>
    ${c.map((i) => `<button type="button" class="opt" data-act="ov-pick" data-id="${i.id}"><b>${esc(i.name)}</b><span>${esc(i.role)} · ${esc(i.path)}</span></button>`).join('')}
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Cancelar</button></div></div>`;
  dlg.showModal();
}
function openSoundPicker() {
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>Sons</h2><div class="muted">Sintetizados aqui, sem arquivo. Ouça e adicione no playhead (${fmtT(app.ph)}).</div>
    ${SOUNDS.map((s) => `<div class="li" style="display:flex;justify-content:space-between;gap:8px;padding:6px 0"><b>${s.name}</b><span><button type="button" class="btn sm" data-act="snd-play" data-k="${s.key}">Ouvir</button> <button type="button" class="btn sm solid" data-act="snd-add" data-k="${s.key}">Adicionar</button></span></div>`).join('')}
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Fechar</button></div></div>`;
  dlg.showModal();
}
function openBriefing() {
  const e = edit(); const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>Briefing</h2><label for="b-name">Nome do projeto</label><input id="b-name" type="text" value="${esc((e && e.briefing.name) || app.projectName)}">
    <label for="b-notes">Anotações (objetivo, tom, referências, entregas)</label><textarea id="b-notes" rows="6" style="min-height:110px">${esc(e ? e.briefing.notes : '')}</textarea>
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Cancelar</button><button type="button" class="btn solid" data-act="briefing-save">Salvar</button></div></div>`;
  dlg.showModal();
}
function openCinemaAdd() {
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>Adicionar referência</h2><div class="muted">Cole o link de uma página do Film Grab, Flim ou Movies in Color. Só o nome e o link ficam aqui.</div>
    <label for="c-name">Nome do filme</label><input id="c-name" type="text" placeholder="Ex.: Cidade de Deus"><label for="c-url">Link</label><input id="c-url" type="text" placeholder="https://film-grab.com/...">
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Cancelar</button><button type="button" class="btn solid" data-act="cin-save">Adicionar</button></div></div>`;
  dlg.showModal();
}

export const actions = {
  tool(el) {
    const n = el.dataset.name; app.ui.tool = n; renderRail();
    const go = (sel) => { const t = $(sel); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    if (n === 'Briefing') openBriefing();
    else if (n === 'Transcrição') { const dlg = $('#dlg'); dlg.innerHTML = '<div class="dlg"><h2>Transcrição</h2><div class="muted" style="line-height:1.5">A transcrição roda dentro do navegador, sem enviar a fala pra ninguém, e alimenta as ideias, as legendas e o Auto-FX. Ela ainda não está nesta versão: a faixa A1 da timeline já está reservada, e o Auto-FX hoje trabalha com os cortes de cena e o estilo. Enquanto isso, você marca as ideias à mão na faixa Ideias.</div><div class="row2"><button type="button" class="btn solid" data-act="dlg-close">Entendi</button></div></div>'; dlg.showModal(); }
    else if (n === 'Cortes') go('#detector');
    else if (n === 'Reenquadrar') go('.fmts');
    else if (n === 'Tarja' || n === 'Legendas') { if (!st()) { toast('Abra um vídeo primeiro.'); return; } addItem('Adicionar ' + (n === 'Tarja' ? 'tarja' : 'legenda'), F.newText(n === 'Tarja' ? 'tarja' : 'legenda', app.ph, app.duration)); }
    else if (n === 'Motion') { app.ui.etab = 'tec'; renderEfeitos(); go('#efeitos'); }
    else if (n === 'Sons') openSoundPicker();
    else if (n === 'Cor') hooks.go('cor');
    else if (n === 'Auto-FX') { go('#autofx'); if (st() && !edit().fx.some((f) => f.auto)) autofxRun(); }
  },
  etab(el) { app.ui.etab = el.dataset.v; renderEfeitos(); },
  'fx-add'(el) { if (!st()) { toast('Abra um vídeo primeiro.'); return; } addItem('Adicionar ' + nice(F.techOf(el.dataset.k).name), F.newTech(el.dataset.k, app.ph, app.duration)); },
  'tex-add'(el) {
    if (!st()) { toast('Abra um vídeo primeiro.'); return; }
    addItem('Adicionar textura ' + nice(F.texOf(el.dataset.k).name), F.newTexture(el.dataset.k, app.ph, app.duration));
  },
  'ov-add'() { if (!st()) { toast('Abra um vídeo primeiro.'); return; } openOverlayPicker(); },
  'ov-pick'(el) { const i = app.lib.get(el.dataset.id); $('#dlg').close(); addItem('Adicionar overlay', F.newOverlay(i.id, i.name, app.ph, app.duration)); },
  'dlg-close'() { $('#dlg').close(); },
  'cin-toggle'(el) { mutEdit('Estilo: ' + el.dataset.k, (e) => { const c = e.cinema.find((x) => x.key === el.dataset.k); c.state = c.state === 'use' ? 'saved' : 'use'; return e; }); },
  'cin-add'() { openCinemaAdd(); },
  'cin-save'() {
    const name = ($('#c-name').value || '').trim(); const url = ($('#c-url').value || '').trim();
    if (!name) { toast('Dê um nome pro filme.'); return; }
    mutEdit('Nova referência: ' + name, (e) => { e.cinema.push({ key: 'u' + Date.now().toString(36), name: name.toUpperCase(), dir: url ? url.replace(/^https?:\/\//, '').slice(0, 48) : '', url, state: 'saved' }); return e; });
    $('#dlg').close(); app.ui.etab = 'cin'; renderEfeitos();
  },
  'style-open'() { app.ui.etab = 'cin'; renderEfeitos(); $('#efeitos').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  'briefing-save'() {
    const name = $('#b-name').value.trim(); const notes = $('#b-notes').value;
    mutEdit('Briefing', (e) => { e.briefing = { name, notes }; return e; }); if (name) app.projectName = name; $('#dlg').close(); hooks.renderAll();
  },
  platform(el) {
    const p = F.PLATFORMS.find((x) => x.key === el.dataset.v); if (!st()) { app.ratio = p.ratio; renderMonitorBar(); hooks.preview(); return; }
    app.ratio = p.ratio; mutEdit('Plataforma: ' + p.label, (e) => { e.platform = p.key; return e; });
  },
  ratio(el) { app.ratio = el.dataset.v; hooks.renderAll(); },
  fxprev() { app.ui.fxPreview = !app.ui.fxPreview; renderMonitorBar(); hooks.preview(); },
  'go-cor'() { hooks.go('cor'); },
  'step-back'() { if (app.view) hooks.seek(app.ph - 0.1); },
  'step-fwd'() { if (app.view) hooks.seek(app.ph + 0.1); },
  play() { hooks.togglePlay(); },
  pick(el) { const s = st().scenes[+el.dataset.i]; hooks.seek((s.a + s.b) / 2); },
  split() { const { scenes } = st(); const i = curScene(); if (P.canSplit(scenes, i, app.ph)) commitScenes('Dividir ' + N(i) + ' em ' + fmtT(app.ph), P.split(scenes, i, app.ph)); },
  'join-prev'() { const { scenes } = st(); const i = curScene(); if (P.canJoinPrev(scenes, i)) commitScenes('Juntar ' + N(i - 1) + ' e ' + N(i), P.joinPrev(scenes, i)); },
  'join-next'() { const { scenes } = st(); const i = curScene(); if (P.canJoinNext(scenes, i)) commitScenes('Juntar ' + N(i) + ' e ' + N(i + 1), P.joinNext(scenes, i)); },
  'cut-'() { moveCut(-0.5); }, 'cut+'() { moveCut(0.5); },
  mode(el) { const k = +el.dataset.k; if (k < 0) return; const { scenes } = st(); const i = curScene(); const n = P.cycleMode(scenes, i, k); commit('Enquadramento ' + P.RATIOS[k] + ' de ' + N(i) + ': ' + P.MODES[n[i].m[k]], (s) => { s.scenes = n; return s; }); },
  'sens-'() { setSens(-1); }, 'sens+'() { setSens(1); },
  blade() { app.ui.blade = !app.ui.blade; renderTimeline(); },
  snap() { app.ui.snap = !app.ui.snap; renderTimeline(); },
  'idea-add'() {
    const s = st(); if (!s) return; const sc = s.scenes[curScene()];
    if (edit().ideas.some((i) => i.a < sc.b && i.b > sc.a)) { toast('Essa cena já está numa ideia.'); return; }
    mutEdit('Nova ideia', (e) => M.addIdea(e, sc.a, sc.b)); const id = edit().ideas.find((i) => i.a === sc.a).id; app.ui.selIdea = id; app.ui.sel = null; app.ui.itab = 'clipe'; hooks.renderAll();
  },
  'idea-del'(el) { mutEdit('Apagar ideia', (e) => M.removeIdea(e, el.dataset.id)); app.ui.selIdea = null; hooks.renderAll(); },
  itab(el) { app.ui.itab = el.dataset.v; renderInspector(); },
  sel(el) { app.ui.sel = el.dataset.id; app.ui.itab = 'efeito'; const it = selItem(); if (it) hooks.seek(it.a + 0.01); hooks.renderAll(); },
  'it-accept'() { const it = selItem(); if (!it || it.accepted) return; mutEdit('Aceitar ' + nice(it.name), (e) => M.updateFx(e, it.id, { accepted: true })); },
  'it-del'() { const it = selItem(); if (!it) return; mutEdit('Apagar ' + nice(it.name), (e) => M.removeFx(e, it.id)); app.ui.sel = null; hooks.renderAll(); },
  'it-swap'() {
    const it = selItem(); if (!it) return;
    const list = it.kind === 'tec' ? F.TECH.filter((t) => !t.language || it.key === 'dolly') : F.TEXTURES;
    const k = list[(list.findIndex((t) => t.key === it.key) + 1) % list.length];
    const n = it.kind === 'tec' ? F.newTech(k.key, it.a, app.duration) : F.newTexture(k.key, it.a, it.b);
    mutEdit('Trocar efeito por ' + nice(n.name), (e) => M.updateFx(e, it.id, { key: n.key, name: n.name, params: n.params, kf: n.kf, sfx: it.sfx || n.sfx, b: it.kind === 'tx' ? it.b : n.b, why: it.why }));
  },
  'sfx-swap'(el) {
    const it = items().find((f) => f.id === el.dataset.id); const i = F.SOUNDS.findIndex((s) => s.key === it.sfx.key);
    const n = F.SOUNDS[(i + 1) % F.SOUNDS.length]; mutEdit('Trocar som: ' + n.name, (e) => M.updateFx(e, it.id, (f) => ({ sfx: { ...f.sfx, key: n.key }, ...(f.kind === 'sx' ? { name: n.name, key: n.key } : {}) })));
  },
  'sfx-add'(el) { const it = items().find((f) => f.id === el.dataset.id); mutEdit('Adicionar som', (e) => M.updateFx(e, it.id, { sfx: { key: 'pop', off: 0, vol: -10 } })); },
  'sfx-off'(el) { const it = items().find((f) => f.id === el.dataset.id); mutEdit('Remover som', (e) => M.updateFx(e, it.id, { sfx: null })); },
  'sfx-play'(el) { const it = items().find((f) => f.id === el.dataset.id); hooks.previewSound(it.sfx.key, it.sfx.vol); },
  'snd-play'(el) { hooks.previewSound(el.dataset.k, -8); },
  'snd-add'(el) { addItem('Adicionar som', F.newSound(el.dataset.k, app.ph, app.duration)); $('#dlg').close(); },
  'autofx-run'() { autofxRun(); },
  'autofx-accept'() { mutEdit('Aceitar todas as sugestões', (e) => M.acceptAll(e)); toast('Sugestões aceitas.'); },
  'autofx-review'() {
    const pend = edit().fx.filter((f) => f.auto && !f.accepted).sort((a, b) => a.a - b.a);
    if (!pend.length) return; const cur = pend.findIndex((f) => f.id === app.ui.sel);
    const next = pend[(cur + 1) % pend.length]; app.ui.sel = next.id; app.ui.itab = 'efeito'; hooks.seek(next.a + 0.01); hooks.renderAll();
    toast('Revisando ' + (((cur + 1) % pend.length) + 1) + ' de ' + pend.length + '. Aceite, troque ou apague no painel da direita.');
  }
};

// ---------- eventos próprios ----------
function paramInput(ev) {
  const el = ev.target; const act = el.dataset.act;
  if (act === 'offset') {
    const { scenes } = st(); const i = curScene(); const k = P.RATIOS.indexOf(app.ratio); if (k < 0 || k > 2) return;
    const n = P.setOffset(scenes, i, k, +el.value); el.style.setProperty('--p', el.value + '%');
    app.hist.push({ ...clone(st()), scenes: n }, 'Posição ' + app.ratio + ' de ' + N(i), 'ox:' + i + ':' + k); app.dirty = true;
    const stt = $('#d-status'); if (stt) stt.innerHTML = 'Última ação: <b>' + esc(app.hist.label) + '</b> · passo ' + app.hist.step + ' de ' + app.hist.total;
    hooks.renderHeader(); hooks.preview(); return;
  }
  const id = el.dataset.id; if (!id) return;
  if (act === 'param') {
    const it = items().find((f) => f.id === id); const d = F.paramDefs(it).find((x) => x.k === el.dataset.k); const v = +el.value;
    mutLight('Ajustar ' + d.label + ' de ' + nice(it.name), (e) => M.updateFx(e, id, (f) => { f.params[d.k] = v; F.syncLen(f); return f; }), 'p:' + id + d.k);
    el.style.setProperty('--p', pctP(d, v)); const lab = el.closest('.sl').querySelector('[data-val]'); if (lab) lab.textContent = F.fmtParam(d, v);
    const r = $('#i-range'); const f2 = items().find((f) => f.id === id); if (r) r.textContent = fmtT(f2.a) + ' → ' + fmtT(f2.b);
    renderTimeline(); hooks.preview();
  } else if (act === 'sfx-vol') {
    const v = +el.value; mutLight('Volume do som', (e) => M.updateFx(e, id, (f) => ({ sfx: { ...f.sfx, vol: v } })), 'sv:' + id); el.style.setProperty('--p', (v + 30) / 30 * 100 + '%');
    const lab = el.closest('.box').querySelector('.mono'); if (lab) lab.textContent = (v > 0 ? '+' : '−') + Math.abs(v) + ' dB';
  } else if (act === 'text') {
    const k = el.dataset.k; mutLight('Editar texto', (e) => M.updateFx(e, id, (f) => { f.params[k] = el.value; }), 't:' + id + k); renderTimeline(); hooks.preview();
  } else if (act === 'credit') mutLight('Crédito do overlay', (e) => M.updateFx(e, id, (f) => { f.credit = { ...f.credit, creator: el.value }; }), 'cr:' + id);
  else if (act === 'idea-name') { mutLight('Nome da ideia', (e) => M.renameIdea(e, id, el.value), 'in:' + id); renderTimeline(); }
}
function paramChange(ev) {
  const act = ev.target.dataset.act;
  if (act === 'credit-req') { mutEdit('Atribuição do overlay', (e) => M.updateFx(e, ev.target.dataset.id, (f) => { f.credit = { ...f.credit, required: ev.target.checked }; })); return; }
  if (['param', 'sfx-vol', 'text', 'credit', 'offset', 'idea-name'].includes(act) && app.hist) { app.hist.seal(); hooks.renderAll(); }
}

// keyframes
let kfDrag = null;
function kfDown(ev) {
  const box = ev.target.closest('#kf'); if (!box) return;
  const it = items().find((f) => f.id === box.dataset.id); if (!it) return;
  const pt = ev.target.closest('.kpt'); const r = box.getBoundingClientRect();
  if (pt) { kfDrag = { id: it.id, i: +pt.dataset.i, box }; pt.setPointerCapture && pt.setPointerCapture(ev.pointerId); ev.preventDefault(); return; }
  const x = clamp(Math.round((ev.clientX - r.left) / r.width * 100), 1, 99); const y = clamp(Math.round((ev.clientY - r.top) / r.height * 40), F.KF_PEAK, F.KF_BASE);
  mutEdit('Novo keyframe', (e) => M.updateFx(e, it.id, (f) => { f.kf.push({ x, y }); }));
}
function kfMove(ev) {
  if (!kfDrag) return; const r = kfDrag.box.getBoundingClientRect(); const it = items().find((f) => f.id === kfDrag.id);
  const y = clamp(Math.round((ev.clientY - r.top) / r.height * 40), F.KF_PEAK, F.KF_BASE);
  const pts = [...it.kf].sort((a, b) => a.x - b.x); const p = it.kf[kfDrag.i]; const end = p === pts[0] || p === pts[pts.length - 1];
  const x = end ? p.x : clamp(Math.round((ev.clientX - r.left) / r.width * 100), 1, 99);
  mutLight('Mover keyframe', (e) => M.updateFx(e, it.id, (f) => { f.kf[kfDrag.i] = { x, y }; }), 'kf:' + it.id);
  $('#inspector').querySelector('#kf').outerHTML = kfHtml(items().find((f) => f.id === it.id)).split('<div class="note">')[0];
  kfDrag.box = $('#kf'); hooks.preview();
}
function kfUp() { if (kfDrag) { app.hist.seal(); kfDrag = null; hooks.renderAll(); } }
function kfDbl(ev) {
  const pt = ev.target.closest('.kpt'); if (!pt) return; const box = pt.closest('#kf'); const it = items().find((f) => f.id === box.dataset.id);
  const pts = [...it.kf].sort((a, b) => a.x - b.x); const p = it.kf[+pt.dataset.i]; if (p === pts[0] || p === pts[pts.length - 1]) return;
  mutEdit('Apagar keyframe', (e) => M.updateFx(e, it.id, (f) => { f.kf.splice(+pt.dataset.i, 1); }));
}

export function bind() {
  const tl = $('#tl-card');
  tl.addEventListener('pointerdown', onPointerDown); window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp);
  tl.addEventListener('click', laneClick);
  const insp = $('#inspector');
  insp.addEventListener('pointerdown', kfDown); window.addEventListener('pointermove', kfMove); window.addEventListener('pointerup', kfUp); insp.addEventListener('dblclick', kfDbl);
  document.addEventListener('input', (e) => {
    if (e.target.id === 'fx-search') { app.ui.search = e.target.value; refreshLib(); return; }
    if (e.target.closest('#inspector,#detector')) paramInput(e);
  });
  document.addEventListener('change', (e) => { if (e.target.closest('#inspector,#detector')) paramChange(e); });
}

export function render() {
  renderRail(); renderEfeitos(); renderMonitorBar(); renderPalette(); renderDetector(); renderAutofx(); renderTimeline(); renderInspector(); timecode();
}
export { refreshLib, openOverlayPicker };

// ---------- desenho da prévia (Editar) ----------
export function sceneCrop(t) {
  const s = st(); if (!s) return { ox: 50 };
  const sc = s.scenes[P.sceneAt(s.scenes, t)]; const k = P.RATIOS.indexOf(app.ratio);
  return { ox: k >= 0 && k < 3 && sc.m[k] === 2 ? sc.ox[k] : 50 };
}
let palAt = 0;
export function drawMon() {
  const cv = $('#cv-mon'); if (!cv) return;
  const src = app.view === 'video' ? video : app.view === 'image' ? still : null;
  const t = app.view === 'video' ? video.currentTime : 0;
  const { w, h } = outSize(app.ratio, 640);
  const e = edit();
  if (!src || !e) {
    if (cv.width !== w) { cv.width = w; cv.height = h; } const g = cv.getContext('2d'); g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h);
    updateChips(null); return;
  }
  const sw = app.view === 'video' ? video.videoWidth : still.naturalWidth; const sh = app.view === 'video' ? video.videoHeight : still.naturalHeight;
  const comps = app.ui.fxPreview ? compsAt(e, M.groupAt(e, t)) : [];
  const info = app.comp.render(cv, { src, sw, sh, t, ratio: app.ratio, ox: sceneCrop(t).ox, fx: e.fx, fxOn: app.ui.fxPreview, comps, overlays: app.overlays, W: w, H: h });
  hooks.afterDraw && hooks.afterDraw(info, t);
  updateChips(info);
  const now = performance.now();
  if (now - palAt > 700) { palAt = now; try { const sm = sampleCanvas(cv, 64); app.palCur = extractPalette(sm.data); renderPalette(); } catch (err) { /* ignora */ } }
}
