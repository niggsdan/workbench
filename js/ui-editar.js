// Tela Editar: rail, Efeitos, monitor, detector de cenas, Auto-FX, timeline e inspetor.
import { app, $, $$, esc, p2, fmtT, fmtClock, dsec, dis, N, clone, clamp, video, still, st, edit, proj, commit, mutEdit, mutProj, say, hooks, toast, compsAt } from './store.js';
import * as FG from './filmgrab.js';
import * as P from './project.js';
import { selectCuts, SENS_LABELS } from './detect.js';
import * as M from './model.js';
import * as F from './fx.js';
import { outSize } from './render.js';
import { extractPalette } from './grade.js';
import { sampleCanvas } from './render.js';
import { refineCuts } from './sampler.js';
import { SOUNDS } from './fx.js';
import * as T from './transcript.js';
import { EYECANDY, CATS, EYE_URL } from './eyecandy.js';
import * as K from './masks.js';
import * as S from './seq.js';
import * as FT from './fonts.js';
import { transcribe } from './transcribe.js';

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
const BADGE = { Ajuste: '', Linguagem: 'ghost', Preset: '', Gerado: 'ghost', Arquivo: 'dash', Animada: '' };
const ECATS = [['all', 'Todas'], ['aqui', 'Feitas aqui'], ...Object.entries(CATS)];
const fgUrl = (q) => 'https://film-grab.com/?s=' + encodeURIComponent(q);
const micUrl = (q) => 'https://www.google.com/search?q=' + encodeURIComponent('site:moviesincolor.com ' + q);
const FLIM_URL = 'https://app.flim.ai/';
export const refLinks = (q) => `<a href="${fgUrl(q)}" target="_blank" rel="noopener noreferrer">Film Grab</a> · <a href="${FLIM_URL}" target="_blank" rel="noopener noreferrer" title="Busca dentro do Flim (pede conta)">Flim</a> · <a href="${micUrl(q)}" target="_blank" rel="noopener noreferrer">Movies in Color</a>`;
app.fg = { q: null, items: [], total: 0, page: 0, loading: false, err: '' };
let fgTimer = 0;
async function loadFg(q, reset) {
  const fg = app.fg; if (reset) { fg.q = q; fg.items = []; fg.total = 0; fg.page = 0; fg.err = ''; }
  fg.loading = true; const page = fg.page + 1; const ask = q;
  try { const r = await FG.browse(q, page); if (fg.q !== ask) return; fg.items = fg.items.concat(r.items); fg.total = r.total; fg.page = page; }
  catch (err) { if (fg.q === ask) fg.err = err.message; }
  finally { if (fg.q === ask) { fg.loading = false; if (app.ui.etab === 'cin') refreshLib(); } }
}
const eyeOf = (it) => it.slug || ((EYECANDY.find((r) => r.fx === it.key) || {}).slug);
function libRows() {
  const q = app.ui.search.trim().toLowerCase();
  const hit = (...s) => !q || s.join(' ').toLowerCase().includes(q);
  const e = edit();
  if (app.ui.etab === 'tec') {
    const cat = app.ui.ecat || 'all';
    const list = EYECANDY.filter((r) => (cat === 'all' || (cat === 'aqui' ? r.fx : r.cat === cat)) && hit(r.name, r.hint, CATS[r.cat]));
    return list.map((r) => { const made = !!r.fx; return `<div class="lib-row"><button type="button" class="t" data-act="eye-add" data-slug="${r.slug}" title="${made ? 'Adiciona o efeito no playhead' : 'Adiciona um marcador de linguagem no playhead'}"><b>${esc(r.name.toUpperCase())}</b><span class="h">${esc(r.hint)}</span><span class="h2">${CATS[r.cat]}</span></button>
      <a class="eye" href="${EYE_URL + r.slug}" target="_blank" rel="noopener noreferrer" title="Ver ${esc(r.name)} no Eyecandy" aria-label="Ver ${esc(r.name)} no Eyecandy">↗</a><span class="badge ${made ? '' : 'ghost'}">${made ? 'Ajuste' : 'Linguagem'}</span></div>`; }).join('') || '<div class="note" style="padding:10px 6px">Nenhuma técnica com esse nome.</div>';
  }
  if (app.ui.etab === 'cin') {
    const P = proj(); const qq = app.ui.search.trim(); const fg = app.fg;
    if (fg.q !== qq && !fg.loading) loadFg(qq, true);
    const have = new Set(P.cinema.map((c) => c.fgId).filter(Boolean)); const haveName = new Set(P.cinema.map((c) => c.name.toLowerCase()));
    const mine = P.cinema.filter((c) => hit(c.name, c.dir, c.dp, c.year)).map((c) => `<div class="lib-row${app.ui.selRef === c.key ? ' on' : ''}"><button type="button" class="t" data-act="ref-open" data-k="${c.key}"><b>${esc(c.name)}</b><span class="h">${c.dir ? 'Dir. ' + esc(c.dir) : 'Direção não anotada'}${c.year ? ' · ' + esc(c.year) : ''}</span>${c.dp ? `<span class="h2">Fotografia: ${esc(c.dp)}</span>` : ''}</button>
      <button type="button" class="badge ${c.state === 'use' ? 'use' : 'ghost'}" style="border:${c.state === 'use' ? '0' : '1px solid #6a7078'};cursor:pointer" data-act="cin-toggle" data-k="${c.key}" title="Clique pra ${c.state === 'use' ? 'tirar do projeto' : 'usar no projeto'}">${c.state === 'use' ? 'Em uso' : 'Salvo'}</button></div>`).join('');
    const fgRows = fg.items.map((f, i) => { const on = have.has(f.fgId) || haveName.has(f.name.toLowerCase()); return `<div class="lib-row"><a class="t" href="${f.url}" target="_blank" rel="noopener noreferrer" title="Ver os stills no Film Grab"><b>${esc(f.name.toUpperCase())}</b><span class="h">${f.dir ? 'Dir. ' + esc(f.dir) : ''}${f.year ? (f.dir ? ' · ' : '') + f.year : ''}${f.aspect ? ' · ' + esc(f.aspect) : ''}</span>${f.dp ? `<span class="h2">Fotografia: ${esc(f.dp)}</span>` : ''}</a>
      <button type="button" class="badge ${on ? 'ghost' : ''}" style="cursor:pointer;border:${on ? '1px solid #6a7078' : '0'}" data-act="fg-add" data-i="${i}" ${on ? 'disabled' : ''}>${on ? 'Na lista' : 'Adicionar'}</button></div>`; }).join('');
    const fgHead = `<div class="lib-sec">Acervo Film Grab${fg.total ? ' · ' + fg.total.toLocaleString('pt-BR') + (qq ? ' resultados' : ' filmes') : ''}</div>`;
    const fgBody = fg.err ? `<div class="note" style="padding:8px 6px">Não consegui falar com o Film Grab (${esc(fg.err)}). Busque direto: ${refLinks(qq || 'cinema')}</div>`
      : fgRows + (fg.loading ? '<div class="note" style="padding:8px 6px">Buscando no Film Grab…</div>' : fg.items.length < fg.total ? '<button type="button" class="btn sm" style="width:100%;margin:6px 0" data-act="fg-more">Mostrar mais</button>' : (qq && !fg.items.length ? `<div class="note" style="padding:8px 6px">Nada no Film Grab com “${esc(qq)}”. Tente o nome original em inglês, ou: ${refLinks(qq)}</div>` : ''));
    return (mine ? `<div class="lib-sec">Tuas referências</div>${mine}` : '') + fgHead + fgBody
      + `<button type="button" class="lib-row" data-act="cin-add"><span class="t"><b>ADICIONAR À MÃO</b><span class="h">Filme que não está no Film Grab</span></span><span class="badge ghost">Novo</span></button>`;
  }
  const mine = app.lib.items.filter((i) => (i.kind === 'video' || (i.kind === 'image' && !/\.(orf|rw2|cr2|cr3|nef|arw|raf|dng)$/i.test(i.name))) && i.role === 'Overlays' && hit(i.name));
  return F.TEXTURES.filter((t) => hit(t.name, t.hint)).map((t) => `<button type="button" class="lib-row" data-act="tex-add" data-k="${t.key}"><span class="t"><b>${t.name}</b><span class="h">${t.hint}</span></span><span class="badge ${BADGE[t.badge]}">${t.badge}</span></button>`).join('')
    + mine.map((i) => `<button type="button" class="lib-row" data-act="ov-pick" data-id="${i.id}"><span class="t"><b>${i.kind === 'image' ? 'TEXTURA' : 'OVERLAY'} · ${esc(i.name.replace(/\.[^.]+$/, '').toUpperCase())}</b><span class="h">${i.kind === 'image' ? 'Imagem da tua pasta Overlays, animada quadro a quadro' : 'Vídeo da tua pasta Overlays'}</span></span><span class="badge dash">Arquivo</span></button>`).join('')
    + `<button type="button" class="lib-row" data-act="ov-add"><span class="t"><b>${F.OVERLAY.name}</b><span class="h">${F.OVERLAY.hint}</span></span><span class="badge dash">Arquivo</span></button>`
    + `<button type="button" class="lib-row" data-act="texturelabs"><span class="t"><b>TEXTURELABS</b><span class="h">Texturas grátis de filme, grunge, papel e lente pra pasta Overlays</span></span><span class="badge ghost">Links</span></button>`
    + `<button type="button" class="lib-row" data-act="pack-8mm"><span class="t"><b>PACK 8MM GRATUITO</b><span class="h">Onde baixar scans reais de 8 mm pra pasta Overlays</span></span><span class="badge ghost">Links</span></button>`;
}
const NOTES = { tec: 'Vocabulário Eyecandy (' + EYECANDY.length + ' técnicas): só o nome e o link. Ajuste é produzido aqui; Linguagem vira marcador.', cin: 'Busca nos três sites pelo nome. Nenhuma imagem deles fica aqui; os detalhes e a paleta são anotados por você.', tex: 'Gerado no Workbench. Overlays em arquivo vêm da tua pasta Overlays.' };
export function renderEfeitos() {
  const t = app.ui.etab;
  $('#efeitos').innerHTML = `<div class="p-head"><div class="p-title" style="margin-bottom:10px"><h2 class="tool">Efeitos</h2><button type="button" class="pclose" data-act="panel-close" data-k="fx" title="Fechar painel" aria-label="Fechar painel">–</button></div>
    <div class="seg" style="display:flex">${[['tec', 'Técnicas'], ['cin', 'Cinema'], ['tex', 'Textura']].map(([k, l]) => `<button type="button" style="flex:1" aria-pressed="${t === k}" data-act="etab" data-v="${k}">${l}</button>`).join('')}</div>
    <input class="search" id="fx-search" type="text" aria-label="Buscar" placeholder="${t === 'cin' ? 'Buscar filme ou diretor' : t === 'tec' ? 'Buscar técnica' : 'Buscar textura'}" value="${esc(app.ui.search)}" autocomplete="off">
    ${t === 'tec' ? `<div class="cats">${ECATS.map(([k, l]) => `<button type="button" data-act="ecat" data-v="${k}" aria-pressed="${(app.ui.ecat || 'all') === k}">${l}</button>`).join('')}</div>` : ''}</div>
    <div class="p-list" id="lib-list">${libRows()}</div><div class="p-foot">${NOTES[t]}</div>`;
}
const refreshLib = () => { const l = $('#lib-list'); if (l) l.innerHTML = libRows(); };

// ---------- monitor ----------
export function renderMonitorBar() {
  const e = edit();
  $('#plats').innerHTML = ''; $('#plats').hidden = true;
  const sq = e && e.seq;
  $('#ratios').innerHTML = `<button type="button" data-act="seq-open" aria-pressed="false" title="Tamanho da sequência em px (as redes ficam na Entrega)">Sequência ${sq ? sq.w + '×' + sq.h + ' · ' + sq.fps + ' fps' : '—'}</button>`;
  const use = proj().cinema.filter((c) => c.state === 'use');
  const first = use[0];
  $('#style-pill').textContent = 'Estilo: ' + (first ? titleCase(first.name) + (use.length > 1 ? ' +' + (use.length - 1) : '') : 'nenhum');
  const fp = $('#fxprev'); fp.setAttribute('aria-pressed', String(app.ui.fxPreview));
  $('#mtools').innerHTML = `<button type="button" data-act="mtool" data-v="seta" aria-pressed="${app.ui.mtool === 'seta'}" title="Seta: selecione e mova máscaras direto no vídeo">➚ Seta</button>` + K.MASK_TYPES.map((m) => `<button type="button" data-act="mask-add" data-k="${m.key}" title="Nova ${m.name.toLowerCase()}: ${m.hint}">${m.name}</button>`).join('');
  $('#play').innerHTML = !app.player.playing ? '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 5h4v14H7z M13 5h4v14h-4z" fill="currentColor"/></svg>';
}

const sw = (cols) => '<div class="sw">' + cols.map((c) => `<i style="background:${c}"></i>`).join('') + '</div>';
export function renderPalette() {
  const cur = app.palCur; const e0 = proj(); const ref = (e0 && M.refPalette(e0)) || EX_PAL; const refName = e0 && (e0.cinema.find((c) => c.state === 'use' && c.pal) || {}).name;
  const blk = (p) => ['Claros', 'Médios', 'Escuros'].map((l, i) => `<div class="lb">${l}</div>${sw(p ? p[i] : [])}`).join('');
  $('#pal').innerHTML = `<div class="p-title"><div class="t">Teu material · cena atual</div><button type="button" class="pclose" data-act="panel-close" data-k="pal" title="Fechar painel" aria-label="Fechar painel">–</button></div><div>${blk(cur)}</div>
    <div><div class="t">Referência</div><div class="s">${refName ? 'Paleta de ' + esc(titleCase(refName)) : e0 && e0.refPal ? 'Paleta anotada por você' : 'Exemplo, a paleta é anotada por você'}</div>${blk(ref)}</div>
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
    el.innerHTML = `<div class="d-head"><h2 class="tool">Cenas</h2><span class="pill-tag">${app.busy ? 'analisando' : 'sem vídeo'}</span><span class="muted ell">${esc(msg)}</span></div>`;
    return;
  }
  const { scenes, sens } = s; const i = P.sceneAt(scenes, app.ph);
  const sqc = edit() && edit().seq; const tc = sqc && S.topVideoAt(sqc, app.ph); const canCut = P.canSplit(scenes, i, app.ph) || !!(tc && app.ph > tc.start + 0.05 && app.ph < tc.start + tc.dur - 0.05); const canGlue = scenes.length > 1;
  el.innerHTML = `<div class="d-head"><h2 class="tool">Cenas</h2><span class="pill-tag">${scenes.length} cenas</span>
    <div class="sens"><span class="muted" style="font-size:11px;font-weight:600">Sensibilidade</span><button type="button" class="btn sm" data-act="sens-" aria-label="Menos sensível" aria-disabled="${dis(sens > 0)}">−</button><span class="lbl">${SENS_LABELS[sens]}</span><button type="button" class="btn sm" data-act="sens+" aria-label="Mais sensível" aria-disabled="${dis(sens < 4)}">+</button></div>
    <button type="button" class="btn sm solid" data-act="detect-exact" ${app.exact ? 'aria-disabled="true"' : ''} title="Acha as mudanças de cena e corta no quadro exato">${app.exact ? esc(app.exact) : 'Detectar cenas'}</button>
    <span class="vsep"></span>
    <button type="button" class="btn sm" data-act="cut" aria-disabled="${dis(canCut)}" title="Corta o clipe no playhead (${fmtT(app.ph)}) · tecla C">✂ Cortar</button>
    <button type="button" class="btn sm" data-act="glue" aria-disabled="${dis(canGlue)}" title="Junta ${N(i)} com a cena seguinte">Colar</button>
    <button type="button" class="btn sm" data-act="cut-" aria-disabled="${dis(P.canMoveCut(scenes, i, -0.5))}" title="Puxa o corte de entrada de ${N(i)} meio segundo pra trás">Corte −0,5 s</button>
    <button type="button" class="btn sm" data-act="cut+" aria-disabled="${dis(P.canMoveCut(scenes, i, 0.5))}" title="Empurra o corte de entrada de ${N(i)} meio segundo pra frente">Corte +0,5 s</button>
    <div class="status" id="d-status">Última ação: <b>${esc(h.label)}</b> · passo ${h.step} de ${h.total}</div>
</div>`;
}

// muda as cenas e mantém os grupos de cor colados nos cortes
function commitScenes(label, scenes, extra = {}, key = null) {
  commit(label, (s) => { s.scenes = scenes; if (extra.sens != null) s.sens = extra.sens; s.edit = M.reconcile(s.edit, scenes); return s; }, key);
}
function moveCut(d) {
  const { scenes } = st(); const i = curScene(); if (!P.canMoveCut(scenes, i, d)) return;
  const n = P.moveCut(scenes, i, d);
  if (app.ph < n[i].a) app.ph = P.r1(n[i].a + 0.1);
  hooks.seek(app.ph);
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
  if (!e || !st()) { el.innerHTML = `<div class="ic">${ic}</div><div class="tx"><b>Auto-FX</b> <span>Abra um vídeo e o Auto-FX sugere efeitos, texturas e sons pelos cortes, pela fala e pelo estilo.</span></div>`; return; }
  const hasAuto = e.fx.some((f) => f.auto);
  const style = e.cinema.filter((x) => x.state === 'use').map((x) => titleCase(x.name))[0] || 'estilo livre';
  const tr = e.transcript && e.transcript.segs.length;
  el.innerHTML = `<div class="ic">${ic}</div><div class="tx"><b>${hasAuto ? 'Auto-FX leu ' + (tr ? 'a transcrição, ' : '') + 'os cortes e o estilo' : 'Auto-FX'}</b> 
    <span>${pend ? `${c.fx} efeitos, ${c.tx} texturas e ${c.sfx} sons sugeridos. Tudo pode ser movido, trocado ou apagado.` : hasAuto ? 'Tudo aceito. Você ainda pode mover, trocar ou apagar na timeline.' : `Sugere efeitos nos cortes mais fortes, texturas pelo estilo (${esc(style)}) e sons${tr ? ', e jump cut nas pausas da fala' : '. Com a transcrição, ele também usa a fala'}.`}</span></div>
    ${!tr && !app.tr.busy ? '<button type="button" class="btn" data-act="tool" data-name="Transcrição">Transcrever</button>' : ''}
    ${pend ? '<button type="button" class="btn" data-act="autofx-review">Revisar um a um</button><button type="button" class="btn solid" data-act="autofx-accept">Aceitar tudo</button>'
      : `<button type="button" class="btn solid" data-act="autofx-run">${hasAuto ? 'Sugerir de novo' : 'Sugerir agora'}</button>`}`;
}
function autofxRun() {
  const s = st(); if (!s) return;
  const e = s.edit; const style = (e.cinema.find((c) => c.state === 'use') || { key: 'cdd' }).key;
  const sug = F.suggest({ scenes: s.scenes, cands: app.cands, duration: app.duration, platformKey: e.platform, styleKey: style, segs: e.transcript ? e.transcript.segs : [] });
  mutEdit('Auto-FX: ' + sug.length + ' sugestões', (ed) => { ed.fx = ed.fx.filter((f) => !(f.auto && !f.accepted)).concat(sug); return ed; });
  app.ui.sel = sug[0] ? sug[0].id : null; app.ui.itab = 'efeito'; hooks.renderAll();
  toast(sug.length + ' sugestões na timeline. Clique em cada uma pra ver o motivo.');
}

// ---------- timeline ----------
const laneTime = (lane, x) => { const r = lane.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * app.duration; };
const pc = (t) => (t / app.duration * 100).toFixed(3) + '%';
const span = (a, b) => `left:${pc(a)};width:${((b - a) / app.duration * 100).toFixed(3)}%`;

function tickStep(d) { for (const s of [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (d / s <= 12) return s; return 600; }
const KLAB = { tec: 'FX', tx: 'Textura', ov: 'Overlay', mk: 'Máscara', tt: 'Texto', sx: 'SFX' };
const KCLS = { tec: 'fx', tx: 'tx', ov: 'ov', mk: 'mk', tt: 'tt', sx: 'sfx' };
const zoom = () => app.ui.tlZoom || 1;
export function setZoom(z, keepT = app.ph) {
  const body = $('#timeline'); const old = zoom(); z = clamp(Math.round(z * 100) / 100, 1, 40); if (z === old) return;
  app.ui.tlZoom = z; const gr = body && body.querySelector('.tl-grid'); if (!gr) return renderTimeline();
  gr.style.width = 'calc(' + (z * 100) + '% - 10px)';
  const lane = gr.querySelector('.lane'); if (lane) body.scrollLeft = Math.max(0, lane.offsetLeft + keepT / app.duration * lane.offsetWidth - body.clientWidth / 2);
  const zr = $('#tl-zoom'); if (zr) zr.value = z; const zl = $('#tl-zl'); if (zl) zl.textContent = Math.round(z * 100) + '%';
}

export function renderTimeline() {
  const el = $('#tl-card'); const s = st(); const e = edit();
  const prevScroll = $('#timeline') ? [$('#timeline').scrollLeft, $('#timeline').scrollTop] : null;
  const sq = e && e.seq;
  el.innerHTML = `<div class="tl-head"><div class="l"><h2 class="tool">Timeline</h2><span class="muted" style="font-weight:600">${sq ? sq.w + '×' + sq.h + ' · ' : ''}${s ? fmtClock(app.duration).padStart(5, '0') : '00:00'}</span></div>
    <div class="legend"><span class="zoom"><button type="button" class="btn sq sm" data-act="tl-zoom" data-d="-1" title="Afastar (Ctrl + roda)">−</button><input id="tl-zoom" type="range" min="1" max="40" step="0.25" value="${zoom()}" aria-label="Zoom da timeline"><button type="button" class="btn sq sm" data-act="tl-zoom" data-d="1" title="Aproximar (Ctrl + roda)">+</button><span class="mono muted" id="tl-zl">${Math.round(zoom() * 100)}%</span></span><button type="button" class="pclose" data-act="panel-close" data-k="tl" title="Fechar painel" aria-label="Fechar painel">–</button></div></div>
    <div class="tl-body" id="timeline"></div>`;
  const body = $('#timeline');
  if (!s) { body.innerHTML = '<div class="tl-empty">Arraste um vídeo do Material pra cá, ou clique nele, pra começar a sequência.</div>'; return; }
  const D = app.duration;
  const g = (name, html, cls = '', lane = '', extra = '') => `<div class="row ${cls}"><div class="name${cls === 'fxr' ? ' wine' : ''}">${name}</div><div class="lane" data-lane="${lane}"${extra}>${html}</div></div>`;
  const ticks = []; const stp = tickStep(D / zoom()); for (let t = 0; t <= D; t += stp) ticks.push(`<span class="tick" style="left:${pc(t)}">${stp < 1 ? fmtT(t) : fmtClock(t)}</span>`);
  const clip = (it, cls, label, a = it.a, b = it.b) => `<div class="clip ${cls}${app.ui.sel === it.id ? ' sel' : ''}${it.auto && !it.accepted ? ' sug' : ''}" data-clip="${it.id}" style="${span(a, b)}" title="${esc(nice(it.name))} · ${fmtT(it.a)} → ${fmtT(it.b)}"><span class="rz l" data-rz="l"></span>${esc(label)}<span class="rz" data-rz="r"></span></div>`;
  // cada efeito numa camada própria (a mais nova em cima)
  const lay = e.fx.filter((f) => !f.cap).slice().reverse();
  const cnt = {}; const order = e.fx.filter((f) => !f.cap).map((f) => { cnt[f.kind] = (cnt[f.kind] || 0) + 1; return [f.id, cnt[f.kind]]; }); const num = Object.fromEntries(order);
  const fxRows = lay.map((f) => {
    const lbl = f.kind === 'tec' ? (f.key === 'dolly' ? 'Dolly' : nice(f.name)) : f.kind === 'ov' ? (f.file || 'overlay') : f.kind === 'tt' ? (f.params.text || f.name) : f.kind === 'mk' ? K.maskType(f.key).name : f.kind === 'sx' ? F.soundName(f.sfx.key) : nice(f.name);
    let html = clip(f, KCLS[f.kind] || 'fx', lbl);
    if (f.kind === 'mk') html = html.replace(/<span class="rz" data-rz="r"><\/span><\/div>$/, f.shapeKf.map((k) => `<b class="kfd" style="left:${((k.t - f.a) / Math.max(0.01, f.b - f.a) * 100).toFixed(2)}%"></b>`).join('') + '<span class="rz" data-rz="r"></span></div>');
    let row = g(`${KLAB[f.kind] || 'FX'} ${num[f.id]}`, html, f.kind === 'tec' || f.kind === 'tx' ? 'fxr' : '', 'fx');
    if (f.sfx && f.kind !== 'sx') {
      const sd = F.SOUNDS.find((x) => x.key === f.sfx.key) || { dur: 0.5 }; const a = clamp(f.a + f.sfx.off, 0, D); const b = Math.min(D, a + (f.sfx.key === 'projector' ? Math.min(2, f.b - f.a) : sd.dur));
      row = g(`SFX · ${KLAB[f.kind] || 'FX'} ${num[f.id]}`, `<div class="clip sfx${app.ui.sel === f.id ? ' sel' : ''}" data-sfx="${f.id}" style="${span(a, Math.max(b, a + 0.4))}" title="Som: ${esc(F.soundName(f.sfx.key))} (arraste pra mudar o tempo)">${esc(F.soundName(f.sfx.key))}</div>`, '', 'sfx') + row;
    }
    return row;
  }).join('');
  const caps = e.fx.filter((f) => f.cap);
  const ideas = e.ideas.map((i) => `<div class="clip idea${app.ui.selIdea === i.id ? ' sel' : ''}" data-idea="${i.id}" style="${span(i.a, i.b)}">${esc(i.name)}</div>`).join('');
  const cuts = s.scenes.slice(1).map((sc, n) => `<span class="cutm${n + 1 === curScene() ? ' sel' : ''}" style="left:${pc(sc.a)}"></span>`).join('');
  const ng = M.groupCount(e); const gi = curGroup();
  const groups = Array.from({ length: ng }, (_, i) => { const [a, b] = M.groupRange(e, i, D); return `<div class="clip g${i === gi ? ' on' : ''}" data-grp="${i}" style="${span(a, b)};cursor:pointer">G${i + 1}</div>`; }).join('');
  const scenes = s.scenes.map((sc, n) => `<div class="clip v2${n % 2 ? ' alt' : ''}${n === curScene() ? ' cur' : ''}" data-scn="${n}" style="${span(sc.a, sc.b)};cursor:pointer">${N(n)}</div>`).join('');
  const sclip = (c) => `<div class="clip ${c.kind === 'audio' ? 'a' : 'v1'}${app.ui.selClip === c.id ? ' sel' : ''}" data-sc="${c.id}" style="${span(c.start, c.start + c.dur)}" title="${esc(c.name)} · ${fmtT(c.start)} → ${fmtT(c.start + c.dur)} (entra em ${fmtT(c.in)})"><span class="rz l" data-rz="l"></span>${esc(c.name)}<span class="rz" data-rz="r"></span></div>`;
  const vt = sq ? S.tracksOf(sq, 'video').reverse() : []; const at = sq ? S.tracksOf(sq, 'audio') : [];
  const trow = (t) => g(t.id + (t.kind === 'video' ? ' · Vídeo' : ' · Áudio'), sq.clips.filter((c) => c.track === t.id).map(sclip).join('') + (t.kind === 'audio' && t.id === 'A1' && !sq.clips.some((c) => c.track === 'A1') ? '<span class="lane-hint">O som dos vídeos toca junto. Solte músicas e áudios aqui.</span>' : ''), 'trk', 'trk', ` data-track="${t.id}"`);
  body.innerHTML = `<div class="tl-grid" style="width:calc(${zoom() * 100}% - 10px)">
    ${g('', ticks.join(''), 'ruler', 'ruler')}
    ${fxRows}
    ${caps.length ? g('Legendas', caps.map((f) => clip(f, 'tt', f.params.text || f.name)).join(''), '', 'cap') : ''}
    ${vt.map(trow).join('')}
    ${at.map(trow).join('')}
    ${g('Transcrição', e.transcript && e.transcript.segs.length ? e.transcript.segs.map((sg, k) => `<div class="clip a${app.ui.seg === k ? ' sel' : ''}" data-seg="${k}" style="${span(sg.a, Math.max(sg.b, sg.a + 0.3))};cursor:pointer" title="${esc(sg.text)}">${esc(sg.text)}</div>`).join('') : `<span class="lane-hint">${app.tr.busy ? esc(app.tr.stage) : 'Sem transcrição. Use a ferramenta Transcrição no menu da esquerda.'}</span>`, '', 'a1')}
    ${g('+ Faixa', '<span class="lane-hint">Solte aqui um arquivo do Material pra criar uma faixa nova</span>', 'newtrk', 'new', ' data-track="new"')}
    ${g('Cenas', cuts + scenes, '', 'scn')}
    ${g('Cor · grupos', groups, '', 'grp')}
    ${g('Ideias <button type="button" class="btn sm" style="margin-left:6px;height:18px;padding:0 6px" data-act="idea-add" title="Marca uma ideia na cena atual (vira um corte no TikTok)">+</button>', ideas, '', 'ideas')}
    <div class="playhead" aria-hidden="true"><i id="ph-line"></i><u id="ph-knob"></u></div></div>`;
  if (prevScroll) { body.scrollLeft = prevScroll[0]; body.scrollTop = prevScroll[1]; }
  syncPlayhead();
}
export function syncPlayhead() {
  const line = $('#ph-line'); if (!line || !app.duration) return;
  const t = app.view === 'video' || app.view === 'audio' ? hooks.seqTime() : app.ph;
  const lane = document.querySelector('#timeline .lane'); if (!lane) return;
  const left = lane.offsetLeft + clamp(t, 0, app.duration) / app.duration * lane.offsetWidth;
  line.style.left = left + 'px'; $('#ph-knob').style.left = left + 'px';
  if (app.player.playing && zoom() > 1) { const b = $('#timeline'); if (left > b.scrollLeft + b.clientWidth - 40 || left < b.scrollLeft + 132) b.scrollLeft = left - 160; }
}

// arrastar e redimensionar itens da timeline
let drag = null;
function snapTimes(exceptId) {
  const e = edit(); const out = [0, app.duration, app.ph];
  st().scenes.forEach((s) => out.push(s.a));
  e.fx.forEach((f) => { if (f.id !== exceptId) { out.push(f.a, f.b); } });
  if (e.seq) e.seq.clips.forEach((c) => { if (c.id !== exceptId) out.push(c.start, c.start + c.dur); });
  return out;
}
const snapTo = (v, snaps) => { const tol = 0.12 / zoom() * 2; for (const s of snaps) if (Math.abs(v - s) < tol) return s; return v; };
function onPointerDown(ev) {
  if (ev.button) return;
  const sc = ev.target.closest('[data-sc]');
  if (sc && st()) {
    const c = edit().seq.clips.find((x) => x.id === sc.dataset.sc); if (!c) return;
    app.ui.selClip = c.id; app.ui.sel = null; app.ui.seg = null; app.ui.itab = 'clipe';
    drag = { sid: c.id, mode: ev.target.dataset.rz === 'l' ? 'l' : ev.target.dataset.rz ? 'r' : 'move', x0: ev.clientX, lane: sc.closest('.lane'), s0: c.start, d0: c.dur, track0: c.track, moved: false };
    sc.setPointerCapture && sc.setPointerCapture(ev.pointerId); hooks.renderSel(); ev.preventDefault(); return;
  }
  const c = ev.target.closest('[data-clip],[data-sfx]');
  if (!c || !st()) return;
  const id = c.dataset.clip || c.dataset.sfx; const it = edit().fx.find((f) => f.id === id); if (!it) return;
  app.ui.sel = id; app.ui.selRef = null; app.ui.selClip = null; app.ui.itab = 'efeito';
  const lane = c.closest('.lane');
  drag = { id, mode: c.dataset.sfx ? 'sfx' : ev.target.dataset.rz === 'l' ? 'resizel' : ev.target.dataset.rz ? 'resize' : 'move', x0: ev.clientX, lane, a0: it.a, b0: it.b, off0: it.sfx ? it.sfx.off : 0, kf0: it.shapeKf ? it.shapeKf.map((k) => ({ ...k })) : null, moved: false };
  c.setPointerCapture && c.setPointerCapture(ev.pointerId);
  hooks.renderSel();
  ev.preventDefault();
}
const lenParams = (f) => { if (f.kind === 'tec') F.techOf(f.key).params.forEach((p) => { if (p.len === true) f.params[p.k] = clamp(Math.round((f.b - f.a) * F.FPS), p.min, p.max); else if (p.len === 's') f.params[p.k] = clamp(Math.round((f.b - f.a) * 10) / 10, p.min, p.max); }); };
function onPointerMove(ev) {
  if (!drag) return;
  const r = drag.lane.getBoundingClientRect(); const dt = (ev.clientX - drag.x0) / r.width * app.duration;
  if (!drag.moved && Math.abs(ev.clientX - drag.x0) < 3 && !drag.sid) return;
  if (!drag.moved && Math.abs(ev.clientX - drag.x0) < 3 && Math.abs(ev.movementY) < 3) return;
  drag.moved = true;
  const snaps = app.ui.snap !== false ? snapTimes(drag.id || drag.sid) : [];
  const D = app.duration;
  if (drag.sid) {
    const over = document.elementFromPoint(ev.clientX, ev.clientY); const tl = over && over.closest('[data-track]'); const track = tl ? tl.dataset.track : drag.track0;
    mutLight('Mover clipe', (e2) => {
      const sq = e2.seq; const c = sq.clips.find((x) => x.id === drag.sid); if (!c) return e2;
      if (drag.mode === 'move') {
        let ns = Math.max(0, drag.s0 + dt); const ne = snapTo(ns + drag.d0, snaps); ns = snapTo(ns, snaps) !== ns ? snapTo(ns, snaps) : ne - drag.d0;
        let tk = track; if (tk === 'new') tk = drag.newTk && sq.tracks.some((x) => x.id === drag.newTk) ? drag.newTk : (drag.newTk = S.addTrack(sq, c.kind === 'audio' ? 'audio' : 'video'));
        S.moveClip(sq, c.id, ns, tk);
      } else if (drag.mode === 'l') S.trimClip(sq, c.id, 'l', snapTo(drag.s0 + dt, snaps));
      else S.trimClip(sq, c.id, 'r', snapTo(drag.s0 + drag.d0 + dt, snaps));
      return e2;
    }, 'sdrag:' + drag.sid);
    renderTimeline(); hooks.preview(); return;
  }
  mutLight('Mover ' + nice(edit().fx.find((f) => f.id === drag.id).name), (e2) => {
    const f = e2.fx.find((x) => x.id === drag.id);
    if (drag.mode === 'move') { const [a, b] = M.moveTimes(drag.a0, drag.b0, dt, Math.max(D, drag.b0), snaps); f.a = a; f.b = b; if (f.kind === 'mk') f.shapeKf = drag.kf0.map((k) => ({ ...k, t: Math.round((k.t + a - drag.a0) * 1000) / 1000 })); }
    else if (drag.mode === 'resize') { f.b = Math.round(snapTo(clamp(drag.b0 + dt, drag.a0 + 0.1, D), snaps) * 100) / 100; lenParams(f); }
    else if (drag.mode === 'resizel') { f.a = Math.round(snapTo(clamp(drag.a0 + dt, 0, drag.b0 - 0.1), snaps) * 100) / 100; lenParams(f); }
    else { const na = clamp(drag.a0 + drag.off0 + dt, 0, D); f.sfx.off = Math.round((na - (f.kind === 'sx' ? 0 : drag.a0)) * 100) / 100; if (f.kind === 'sx') { f.a = Math.round(na * 100) / 100; f.b = f.a + 0.5; } }
    return e2;
  }, 'drag:' + drag.id);
  renderTimeline(); hooks.preview();
}
function onPointerUp() {
  if (!drag) return;
  if (drag.moved) { if (drag.sid) mutLight('Ajustar clipe', (e2) => { S.tidy(e2.seq); return e2; }, 'sdrag:' + drag.sid); app.hist.seal(); hooks.renderAll(); }
  drag = null;
}

// atualiza o histórico sem redesenhar tudo (gestos contínuos)
export function mutLight(label, fn, key) {
  const cur = clone(st()); cur.edit = fn(cur.edit) || cur.edit;
  app.hist.push(cur, label, key); app.dirty = true;
  const stt = $('#d-status'); if (stt) stt.innerHTML = 'Última ação: <b>' + esc(app.hist.label) + '</b> · passo ' + app.hist.step + ' de ' + app.hist.total;
  hooks.renderHeader();
}

// soltar arquivo do Material na timeline
async function dropMaterial(ev) {
  const id = ev.dataTransfer.getData('text/wb-lib'); if (!id) return;
  ev.preventDefault(); document.querySelectorAll('.lane.drop').forEach((l) => l.classList.remove('drop'));
  const it = app.lib.get(id); if (!it || it.kind === 'other') return;
  if (!st()) { if (it.kind === 'video') hooks.openItem(id); else toast('Comece por um vídeo: ele vira a primeira faixa.'); return; }
  const lane = ev.target.closest('[data-track]'); const lt = ev.target.closest('.lane');
  const t = lt ? laneTime(lt, ev.clientX) : app.ph;
  let dur = 5;
  if (it.kind !== 'image') { toast('Preparando ' + it.name + '…', 1500); try { dur = await hooks.mediaDur(it); } catch (err) { toast('Não consegui ler ' + it.name + '.'); return; } }
  mutEdit('Pôr ' + it.name + ' na sequência', (e2) => {
    const sq = e2.seq; let track = lane ? lane.dataset.track : null;
    const want = it.kind === 'audio' ? 'audio' : 'video';
    if (track === 'new') track = S.addTrack(sq, want);
    if (track && !sq.tracks.some((x) => x.id === track && x.kind === want)) track = null;
    S.addClip(sq, { lib: id, name: it.name, kind: it.kind, dur, start: lane || lt ? t : null, track, src: dur });
    return e2;
  });
}

function laneClick(ev) {
  const lane = ev.target.closest('[data-lane]'); if (!lane || !app.duration) return;
  if (drag && drag.moved) return;
  const t = laneTime(lane, ev.clientX);
  const grp = ev.target.closest('[data-grp]'); const idea = ev.target.closest('[data-idea]'); const sg = ev.target.closest('[data-seg]'); const scn = ev.target.closest('[data-scn]');
  if (sg) { const k = +sg.dataset.seg; app.ui.seg = k; app.ui.sel = null; app.ui.selIdea = null; app.ui.selClip = null; app.ui.itab = 'clipe'; hooks.seek(edit().transcript.segs[k].a + 0.01); hooks.renderAll(); return; }
  if (ev.target.closest('[data-clip],[data-sfx]')) return;
  if (ev.target.closest('[data-sc]')) { hooks.seek(t); return; }
  if (grp) { app.ui.node = null; hooks.selectGroup(+grp.dataset.grp); return; }
  if (idea) { app.ui.selIdea = idea.dataset.idea; app.ui.sel = null; app.ui.itab = 'clipe'; hooks.seek(clamp(+edit().ideas.find((i) => i.id === idea.dataset.idea).a + 0.05, 0, app.duration)); hooks.renderAll(); return; }
  if (!scn && lane.dataset.lane !== 'ruler') { app.ui.selClip = null; app.ui.sel = null; }
  hooks.seek(t);
  if (scn) { app.ui.itab = 'clipe'; app.ui.seg = null; app.ui.selClip = null; }
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
  const ts = tex && it.key !== 'tarja' ? FT.tstyle(it.params) : null; const all = !!app.ui.tAll;
  const tProps = ts ? `<div class="tprops"><h3>Propriedades do texto</h3>
    <div class="seg sm" style="margin-top:6px"><button type="button" data-act="t-scope" data-v="0" aria-pressed="${!all}">Só esta</button><button type="button" data-act="t-scope" data-v="1" aria-pressed="${all}">Todas ${it.cap ? 'as legendas' : 'os textos'}</button></div>
    <div class="field" style="margin-top:8px">Fonte<select data-act="tstyle" data-k="font" data-id="${it.id}">${FT.FONTS.map((f) => `<option${f === ts.font ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
    <div class="tgrid"><label>Tamanho<input type="range" min="2" max="14" step="0.5" value="${ts.size}" data-act="tstyle" data-k="size" data-id="${it.id}"></label>
    <label>Altura na tela<input type="range" min="5" max="95" value="${ts.y}" data-act="tstyle" data-k="y" data-id="${it.id}"></label>
    <label>Cor<input type="color" value="${ts.color}" data-act="tstyle" data-k="color" data-id="${it.id}"></label>
    <label>Peso<select data-act="tstyle" data-k="weight" data-id="${it.id}">${[400, 700, 800].map((w) => `<option value="${w}"${+ts.weight === w ? ' selected' : ''}>${{ 400: 'Normal', 700: 'Negrito', 800: 'Extra' }[w]}</option>`).join('')}</select></label>
    <label>Contorno<input type="range" min="0" max="30" value="${ts.stroke}" data-act="tstyle" data-k="stroke" data-id="${it.id}"></label>
    <label class="ck"><input type="checkbox" ${+ts.bg ? 'checked' : ''} data-act="tstyle" data-k="bg" data-id="${it.id}"> Fundo escuro</label></div></div>` : '';
  const ovF = it.kind === 'ov' ? `<div class="box" style="margin-top:10px"><div class="r"><b>${esc(it.file || 'overlay')}</b></div><small>Licença gratuita · atribuição ${it.credit.required ? 'obrigatória' : 'não exigida'}</small>
      <div class="field" style="margin-top:6px">Criador<input type="text" placeholder="Nome do criador" value="${esc(it.credit.creator)}" data-act="credit" data-id="${it.id}"></div>
      <label class="toggle" style="margin-top:6px"><input type="checkbox" ${it.credit.required ? 'checked' : ''} data-act="credit-req" data-id="${it.id}"> Exige atribuição (entra em creditos.txt na entrega)</label></div>` : '';
  const mkBlock = it.kind === 'mk' ? `<div><h3>Forma</h3><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><div class="seg sm"><button type="button" data-act="mk-shape" data-v="0" aria-pressed="${Math.round(it.params.shape) === 0}">Retângulo</button><button type="button" data-act="mk-shape" data-v="1" aria-pressed="${Math.round(it.params.shape) === 1}">Elipse</button></div>
      <button type="button" class="btn sm" data-act="mk-invert" aria-pressed="${!!Math.round(it.params.invert || 0)}">Inverter</button><div class="seg sm">${K.MASK_TYPES.map((m) => `<button type="button" data-act="mk-type" data-v="${m.key}" aria-pressed="${it.key === m.key}">${m.name}</button>`).join('')}</div></div></div>
    <div><h3>Keyframes no vídeo</h3><div class="note" style="margin:4px 0 6px">Com a seta, arraste ou redimensione a forma no monitor. Em outro ponto do vídeo, isso cria um keyframe novo.</div>
      <div class="kflist">${it.shapeKf.map((k) => `<span class="kfi${Math.abs(k.t - app.ph) < 0.06 ? ' on' : ''}"><button type="button" data-act="mk-goto" data-t="${k.t}">◆ ${fmtT(k.t)}</button>${it.shapeKf.length > 1 ? `<button type="button" data-act="mk-delkf" data-t="${k.t}" aria-label="Apagar keyframe">×</button>` : ''}</span>`).join('')}</div></div>` : '';
  const chips = `<div class="chips"><span class="kchip">${esc(F.kindLabel(it))}</span>${it.auto && !it.accepted ? '<span class="kchip o">Sugerido pela IA</span>' : ''}</div>`;
  return `${chips}<h3 class="big" style="font-size:26px;text-transform:none;letter-spacing:0;color:var(--txt)">${esc(nice(it.name))}</h3>
    <div class="mono muted" id="i-range">${fmtT(it.a)} → ${fmtT(it.b)}</div>
    <div><h3>Por que aqui</h3><div class="why" style="margin-top:6px">${esc(it.why || '')}</div></div>
    ${mkBlock}
    ${defs.length || tex || it.kind === 'ov' ? `<div><h3>${tex ? 'Conteúdo' : 'Parâmetros'}</h3>${textF}${defs.map((d) => sliderHtml(it, d)).join('')}${ovF}</div>` : ''}${tProps}
    ${it.kf && it.kf.length ? `<div><h3>Keyframes</h3><div style="margin-top:6px">${kfHtml(it)}</div></div>` : ''}
    ${it.kind !== 'tt' && it.kind !== 'mk' ? `<div><h3>Som do efeito</h3><div style="margin-top:6px">${sfx}</div></div>` : ''}
    <div><h3>Receita</h3><div style="margin-top:6px;line-height:1.5">${esc(F.recipeOf(it))}</div>${eyeOf(it) ? `<a class="btn sm" style="margin-top:8px" href="${EYE_URL + eyeOf(it)}" target="_blank" rel="noopener noreferrer">Ver referência no Eyecandy ↗</a>` : ''}</div>
    <div class="foot">${it.kind === 'mk' ? '' : `<button type="button" class="btn solid" data-act="it-accept" ${it.accepted ? 'aria-disabled="true"' : ''}>${it.accepted ? 'Aceito' : 'Aceitar'}</button>`}${['tec', 'tx'].includes(it.kind) ? '<button type="button" class="btn" data-act="it-swap">Trocar efeito</button>' : ''}<button type="button" class="btn" data-act="it-del">Apagar</button></div>`;
}
function clipeHtml() {
  const s = st(); if (!s) return '<div class="hint-empty">Abra um vídeo pra ver os dados do clipe.</div>';
  const e = edit();
  const sc0 = e.seq && e.seq.clips.find((c) => c.id === app.ui.selClip);
  if (sc0) return `<div class="chips"><span class="kchip o">Clipe · ${sc0.track}</span></div><h3 class="big" style="font-size:20px;text-transform:none;letter-spacing:0;color:var(--txt)">${esc(sc0.name)}</h3>
    <div class="box"><div class="r"><span>Na sequência</span><b class="mono">${fmtT(sc0.start)} → ${fmtT(sc0.start + sc0.dur)}</b></div><div class="r" style="margin-top:6px"><span>Duração</span><b class="mono">${fmtT(sc0.dur)}</b></div><div class="r" style="margin-top:6px"><span>Entra no arquivo em</span><b class="mono">${fmtT(sc0.in)}</b></div></div>
    <div class="note">Arraste o meio pra mover (inclusive pra outra faixa). Puxe as pontas pra aparar. C corta no playhead, Delete apaga.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="clip-split">✂ Cortar no playhead</button><button type="button" class="btn sm" data-act="clip-del">Apagar clipe</button></div>`; const i = curScene(); const sc = s.scenes[i]; const gi = curGroup();
  const over = e.fx.filter((f) => f.a < sc.b && f.b > sc.a);
  const idea = e.ideas.find((x) => x.id === app.ui.selIdea);
  const sg = e.transcript && app.ui.seg != null ? e.transcript.segs[app.ui.seg] : null;
  if (sg) return `<div class="chips"><span class="kchip o">Fala · A1</span></div><h3 class="big">Trecho ${app.ui.seg + 1}</h3>
    <div class="mono muted">${fmtT(sg.a)} → ${fmtT(sg.b)}</div>
    <div class="field">Texto<textarea data-act="seg-text" data-k="${app.ui.seg}" rows="4">${esc(sg.text)}</textarea></div>
    <div class="note">Corrija aqui o que o Whisper errou. A legenda, as ideias e o Auto-FX usam esse texto.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="seg-cap">Virar legenda</button><button type="button" class="btn sm" data-act="seg-del">Apagar trecho</button><button type="button" class="btn sm" data-act="seg-close">Ver o clipe</button></div>`;
  return `<div class="chips"><span class="kchip o">Clipe</span></div><h3 class="big" style="font-size:26px;text-transform:none;letter-spacing:0;color:var(--txt)">${N(i)}</h3>
    <div class="mono muted">${fmtT(sc.a)} → ${fmtT(sc.b)} · ${dsec(sc.a, sc.b)}</div>
    <div class="box"><div class="r"><span>Grupo de cor</span><b>G${gi + 1}</b></div><div class="r" style="margin-top:6px"><span>Efeitos nesta cena</span><b>${over.length}</b></div></div>
    <div><h3>Enquadramento</h3>${[0, 1, 2].map((k) => `<div class="r box" style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"><span>${P.RATIOS[k]}</span><button type="button" class="btn sm" data-act="mode" data-k="${k}">${P.MODES[sc.m[k]]}</button></div>`).join('')}${(() => { const k = P.RATIOS.indexOf(app.ratio); return k >= 0 && k < 3 && sc.m[k] === 2 ? `<label class="offset" style="margin-top:8px">Posição (${app.ratio})<input type="range" min="0" max="100" value="${sc.ox[k]}" style="--p:${sc.ox[k]}%" data-act="offset"></label>` : ''; })()}<div class="note" style="margin-top:6px">Rosto ainda enquadra no centro. Manual deixa você ajustar a posição.</div></div>
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
function refHtml(c) {
  const f = (k, l, ph = '') => `<div class="field">${l}<input type="text" value="${esc(c[k] || '')}" placeholder="${ph}" data-act="ref-field" data-k="${k}" data-ref="${c.key}"></div>`;
  const pal = c.pal ? ['Claros', 'Médios', 'Escuros'].map((l, i) => `<div class="note">${l}</div><div class="sw">${c.pal[i].map((h) => `<i style="background:${h}"></i>`).join('')}</div>`).join('') : '<div class="note">Sem paleta ainda. Tire de um still do filme (salve a imagem do Film Grab e carregue aqui).</div>';
  return `<div class="chips"><span class="kchip">Referência de cinema</span>${c.state === 'use' ? '<span class="kchip o">Em uso no projeto</span>' : ''}</div><h3 class="big">${esc(titleCase(c.name))}</h3>
    <div class="note">${c.url && /film-grab/.test(c.url) ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Stills no Film Grab ↗</a> · <a href="https://app.flim.ai/" target="_blank" rel="noopener noreferrer">Flim</a> · <a href="https://www.google.com/search?q=${encodeURIComponent('site:moviesincolor.com ' + c.name.toLowerCase())}" target="_blank" rel="noopener noreferrer">Movies in Color</a>` : refLinks(c.name.toLowerCase())}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${f('name', 'Filme')}${f('dir', 'Direção')}${f('year', 'Ano', 'Ex.: 2002')}${f('dp', 'Direção de fotografia')}${f('aspect', 'Proporção de tela', 'Ex.: 2.39:1')}${f('pd', 'Direção de arte')}${f('costume', 'Figurino')}${f('country', 'País')}
    <div class="field">Notas de luz, cor e enquadramento<textarea data-act="ref-field" data-k="notes" data-ref="${c.key}" rows="4" placeholder="Ex.: contraluz quente, sombras verdes, câmera na mão">${esc(c.notes || '')}</textarea></div></div>
    <div><h3>Paleta anotada</h3><div style="margin-top:6px">${pal}</div><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="ref-pal" data-k="${c.key}">Tirar paleta de uma imagem</button>${c.pal ? `<button type="button" class="btn sm" data-act="ref-pal-clear" data-k="${c.key}">Limpar</button>` : ''}</div>
    <div class="note" style="margin-top:6px">A paleta da primeira referência em uso vira a referência do projeto no monitor e na aba Cor.</div></div>
    <div class="foot"><button type="button" class="btn solid" data-act="cin-toggle" data-k="${c.key}">${c.state === 'use' ? 'Tirar do projeto' : 'Usar no projeto'}</button><button type="button" class="btn" data-act="ref-del" data-k="${c.key}">Apagar</button></div>`;
}
export function renderInspector() {
  const it = selItem(); const t = app.ui.itab;
  const ref = !it && app.ui.selRef ? proj().cinema.find((c) => c.key === app.ui.selRef) : null;
  const tabs = [['efeito', 'Efeito'], ['clipe', 'Clipe'], ['exportacao', 'Exportação']];
  let body;
  if (t === 'efeito') body = it ? itemHtml(it) : ref ? refHtml(ref) : `<div class="hint-empty">Nada selecionado. Clique num efeito, textura ou som na timeline, ou escolha um em <b>Efeitos</b> à esquerda. O Auto-FX também sugere tudo pra você revisar.</div>`;
  else if (t === 'clipe') body = clipeHtml(); else body = exportTabHtml();
  $('#inspector').innerHTML = `<div class="insp-tabs">${tabs.map(([k, l]) => `<button type="button" data-act="itab" data-v="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}<span class="grow"></span><button type="button" class="pclose" data-act="panel-close" data-k="insp" title="Fechar painel" aria-label="Fechar painel">–</button></div>${body}`;
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
  const e = proj(); const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>Briefing</h2><label for="b-name">Nome do projeto</label><input id="b-name" type="text" value="${esc((e && e.briefing.name) || app.projectName)}">
    <label for="b-notes">Anotações (objetivo, tom, referências, entregas)</label><textarea id="b-notes" rows="6" style="min-height:110px">${esc(e ? e.briefing.notes : '')}</textarea>
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Cancelar</button><button type="button" class="btn solid" data-act="briefing-save">Salvar</button></div></div>`;
  dlg.showModal();
}
export function openSeq(first) {
  const sq = edit() && edit().seq; if (!sq) { toast('Abra um vídeo primeiro.'); return; }
  const it = app.lib.get(app.activeId); const vw = video.videoWidth; const vh = video.videoHeight;
  const pre = [['Vertical', 1080, 1920], ['Horizontal', 1920, 1080], ['Quadrado', 1080, 1080], ['4:5', 1080, 1350], ['4K', 3840, 2160]];
  if (vw && vh) pre.unshift(['Igual ao vídeo', vw, vh]);
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg seqdlg"><h2>${first ? 'Tamanho da sequência' : 'Sequência'}</h2>
    <div class="note">${first ? 'Defina o quadro em px antes de editar. ' : ''}Os tamanhos de cada rede (YouTube, TikTok, Instagram) você escolhe na Entrega.</div>
    <div class="presets">${pre.map(([n, w, h]) => `<button type="button" class="btn sm" data-act="seq-preset" data-v="${w}x${h}">${n} · ${w}×${h}</button>`).join('')}</div>
    <div class="wh"><label for="sq-w">Largura (px)<input id="sq-w" type="number" min="16" max="8192" value="${sq.w}"></label><span style="padding-bottom:8px">×</span><label for="sq-h">Altura (px)<input id="sq-h" type="number" min="16" max="8192" value="${sq.h}"></label>
    <label for="sq-fps">Quadros/s<select id="sq-fps">${[23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((f) => `<option${Math.abs(f - sq.fps) < 0.01 ? ' selected' : ''}>${f}</option>`).join('')}</select></label></div>
    ${it ? `<div class="note" style="margin-top:8px">Vídeo aberto: ${esc(it.name)}${vw ? ' · ' + vw + '×' + vh : ''}</div>` : ''}
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">${first ? 'Manter' : 'Cancelar'}</button><button type="button" class="btn solid" data-act="seq-save">Usar este tamanho</button></div></div>`;
  if (!dlg.open) dlg.showModal();
}
function openCinemaAdd() {
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>Adicionar referência</h2><div class="muted">Cole o link de uma página do Film Grab, Flim ou Movies in Color. Só o nome e o link ficam aqui.</div>
    <label for="c-name">Nome do filme</label><input id="c-name" type="text" placeholder="Ex.: Cidade de Deus"><label for="c-url">Link</label><input id="c-url" type="text" placeholder="https://film-grab.com/...">
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Cancelar</button><button type="button" class="btn solid" data-act="cin-save">Adicionar</button></div></div>`;
  dlg.showModal();
}

// ---------- transcrição ----------
app.tr = { busy: false, stage: '', p: 0, text: '', device: '', ctl: null, model: localStorage.getItem('wb.trModel') || 'base', lang: localStorage.getItem('wb.trLang') || 'portuguese' };
function trHtml() {
  const e = edit(); const tr = e && e.transcript; const t = app.tr;
  const words = tr ? tr.segs.reduce((n, sg) => n + sg.text.split(' ').length, 0) : 0;
  return `<div class="dlg" data-dlg="tr"><h2>Transcrição</h2>
    <div class="muted" style="line-height:1.5">Roda no teu navegador com o Whisper. A fala não sai do computador. O modelo é baixado uma vez e fica guardado aqui.</div>
    ${tr ? `<div class="box"><div class="r"><b>${tr.segs.length} trechos · ${words} palavras</b><small>${esc((T.LANGS.find((l) => l[0] === tr.lang) || [, ''])[1])}</small></div><div class="note" style="margin-top:4px">Clique num trecho na faixa A1 pra corrigir o texto.</div></div>` : ''}
    <label>Modelo</label><div class="seg">${T.MODELS.map((m) => `<button type="button" data-act="tr-model" data-v="${m.key}" aria-pressed="${t.model === m.key}">${m.label} · ${m.size}</button>`).join('')}</div>
    <label>Idioma da fala</label><div class="seg">${T.LANGS.map(([k, l]) => `<button type="button" data-act="tr-lang" data-v="${k}" aria-pressed="${t.lang === k}">${l}</button>`).join('')}</div>
    ${t.busy ? `<div class="box"><div class="r"><b id="tr-stage">${esc(t.stage)}</b><small>${t.device === 'webgpu' ? 'placa de vídeo' : t.device ? 'processador' : ''}</small></div><div class="bar" style="margin-top:8px"><i id="tr-bar" style="width:${Math.round(t.p * 100)}%"></i></div><div class="note" id="tr-text" style="margin-top:6px">${esc(t.text)}</div></div>` : ''}
    <div class="row2"><button type="button" class="btn" data-act="dlg-close">Fechar</button>
      ${t.busy ? '<button type="button" class="btn" data-act="tr-cancel">Cancelar</button>' : `<button type="button" class="btn ${tr ? '' : 'solid'}" data-act="tr-run" ${st() ? '' : 'aria-disabled="true"'}>${tr ? 'Transcrever de novo' : 'Transcrever'}</button>`}
      ${tr && !t.busy ? '<button type="button" class="btn" data-act="tr-srt">Baixar .srt</button><button type="button" class="btn" data-act="tr-captions">Gerar legendas</button><button type="button" class="btn solid" data-act="tr-ideas">Separar ideias</button>' : ''}</div></div>`;
}
function openTranscript() { const d = $('#dlg'); d.innerHTML = trHtml(); if (!d.open) d.showModal(); }
const trOpen = () => { const d = $('#dlg'); return d.open && d.querySelector('[data-dlg="tr"]'); };
function trProgress() {
  if (!trOpen()) return; const st2 = $('#tr-stage'); if (!st2) { openTranscript(); return; }
  st2.textContent = app.tr.stage; $('#tr-bar').style.width = Math.round(app.tr.p * 100) + '%'; $('#tr-text').textContent = app.tr.text;
}
async function runTranscription() {
  const it = app.lib.get(app.activeId); if (!st() || !it || !it.play) { toast('Abra um vídeo primeiro.'); return; }
  const ctl = new AbortController(); Object.assign(app.tr, { busy: true, stage: 'Preparando…', p: 0, text: '', device: '', ctl });
  openTranscript(); renderAutofx(); renderTimeline();
  try {
    const segs = await transcribe(it.play, it.name, { model: app.tr.model, lang: app.tr.lang, duration: app.duration, signal: ctl.signal,
      onProgress: (x) => { app.tr.stage = x.stage; app.tr.p = x.p; if (x.text) app.tr.text = x.text; if (x.device) app.tr.device = x.device; say(x.stage); trProgress(); } });
    if (!segs.length) throw new Error('não encontrei fala nesse vídeo');
    const first = !edit().ideas.length;
    mutEdit('Transcrição: ' + segs.length + ' trechos', (e) => { e.transcript = { lang: app.tr.lang, model: app.tr.model, segs }; if (first) e.ideas = T.ideasFromTranscript(segs, st().scenes, app.duration, e.platform).map((i) => ({ id: F.newId(), ...i })); return e; });
    say('Transcrição pronta: ' + segs.length + ' trechos.');
    toast('Transcrição pronta.' + (first ? ' Já separei as ideias na timeline.' : '') + ' Agora o Auto-FX usa a fala.', 7000);
  } catch (err) {
    if (err.name !== 'AbortError') { toast('A transcrição falhou: ' + err.message, 9000); say('A transcrição falhou: ' + err.message); }
  } finally { app.tr.busy = false; app.tr.ctl = null; if (trOpen()) openTranscript(); hooks.renderAll(); }
}
function makeCaptions() {
  const segs = edit().transcript.segs; const lines = T.captionsFromTranscript(segs);
  mutEdit('Legendas da transcrição: ' + lines.length, (e) => { e.fx = e.fx.filter((f) => !f.cap).concat(lines.map((l) => { const it = F.newText('legenda', l.a, app.duration); it.b = l.b; it.params.text = l.text; it.cap = true; it.why = 'Gerada da transcrição.'; return it; })); return e; });
  toast(lines.length + ' legendas na faixa Texto. Pra mudar uma, clique nela.');
}
function download(blob, name) { const a = $('#dl'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
export function downloadSrt() {
  const e = edit(); if (!e || !e.transcript) return;
  download(new Blob([T.toSrt(T.captionsFromTranscript(e.transcript.segs))], { type: 'text/plain' }), (app.projectName || app.name.replace(/\.[^.]+$/, '') || 'legendas').replace(/[^\w.-]+/g, '_') + '.srt');
}

export const actions = {
  mtool(el) { app.ui.mtool = app.ui.mtool === el.dataset.v ? null : el.dataset.v; renderMonitorBar(); renderMaskLayer(); },
  'mask-add'(el) {
    if (!st() || app.view !== 'video') { toast('Abra um vídeo primeiro.'); return; }
    const t = Math.min(hooks.seqTime(), app.duration - 0.2); const m = K.newMask(el.dataset.k, t, app.duration, F.newId());
    app.ui.mtool = 'seta'; addItem('Nova ' + K.maskType(m.key).name.toLowerCase(), m); renderMaskLayer();
    toast('Arraste a forma no vídeo. Em outro ponto do tempo, mexer nela cria um keyframe.');
  },
  'mk-shape'(el) { const it = selItem(); mutEdit('Forma da máscara', (e) => M.updateFx(e, it.id, (f) => { f.params.shape = +el.dataset.v; })); },
  'mk-invert'() { const it = selItem(); mutEdit('Inverter máscara', (e) => M.updateFx(e, it.id, (f) => { f.params.invert = f.params.invert ? 0 : 1; })); },
  'mk-type'(el) { const it = selItem(); const k = el.dataset.v; mutEdit('Tipo: ' + K.maskType(k).name, (e) => M.updateFx(e, it.id, { key: k, name: K.maskType(k).name.toUpperCase() })); },
  'mk-goto'(el) { hooks.seek(+el.dataset.t + 0.001); renderInspector(); },
  'mk-delkf'(el) { const it = selItem(); const t = +el.dataset.t; mutEdit('Apagar keyframe', (e) => { const i = e.fx.findIndex((f) => f.id === it.id); e.fx[i] = K.removeKf(e.fx[i], t); return e; }); },
  'tr-model'(el) { app.tr.model = el.dataset.v; localStorage.setItem('wb.trModel', app.tr.model); openTranscript(); },
  'tr-lang'(el) { app.tr.lang = el.dataset.v; localStorage.setItem('wb.trLang', app.tr.lang); openTranscript(); },
  'tr-run'() { runTranscription(); },
  'tr-cancel'() { if (app.tr.ctl) app.tr.ctl.abort(); },
  'tr-ideas'() { const e = edit(); const ideas = T.ideasFromTranscript(e.transcript.segs, st().scenes, app.duration, e.platform); mutEdit('Separar ideias: ' + ideas.length, (ed) => { ed.ideas = ideas.map((i) => ({ id: F.newId(), ...i })); return ed; }); $('#dlg').close(); toast(ideas.length + ' ideias na faixa Ideias. No TikTok, cada uma vira um corte na Entrega.'); },
  'tr-captions'() { $('#dlg').close(); makeCaptions(); },
  'tr-srt'() { downloadSrt(); },
  'seg-cap'() { const sg = edit().transcript.segs[app.ui.seg]; const it = F.newText('legenda', sg.a, app.duration); it.b = sg.b; it.params.text = sg.text; it.cap = true; addItem('Legenda do trecho', it); },
  'seg-del'() { const k = app.ui.seg; mutEdit('Apagar trecho da transcrição', (e) => { e.transcript.segs.splice(k, 1); return e; }); app.ui.seg = null; hooks.renderAll(); },
  'seg-close'() { app.ui.seg = null; renderInspector(); },
  tool(el) {
    const n = el.dataset.name; app.ui.tool = n; renderRail();
    const go = (sel) => { const t = $(sel); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    if (n === 'Briefing') openBriefing();
    else if (n === 'Transcrição') openTranscript();
    else if (n === 'Cortes') go('#detector');
    else if (n === 'Reenquadrar') go('.fmts');
    else if (n === 'Legendas' && st() && edit().transcript && edit().transcript.segs.length) makeCaptions();
    else if (n === 'Tarja' || n === 'Legendas') { if (!st()) { toast('Abra um vídeo primeiro.'); return; } addItem('Adicionar ' + (n === 'Tarja' ? 'tarja' : 'legenda'), F.newText(n === 'Tarja' ? 'tarja' : 'legenda', app.ph, app.duration)); if (n === 'Legendas') toast('Legenda avulsa no playhead. Com a transcrição, o Workbench gera todas sozinho.'); }
    else if (n === 'Motion') { app.ui.etab = 'tec'; renderEfeitos(); go('#efeitos'); }
    else if (n === 'Sons') openSoundPicker();
    else if (n === 'Cor') hooks.go('cor');
    else if (n === 'Auto-FX') { go('#autofx'); if (st() && !edit().fx.some((f) => f.auto)) autofxRun(); }
  },
  etab(el) { app.ui.etab = el.dataset.v; app.ui.search = ''; renderEfeitos(); },
  ecat(el) { app.ui.ecat = el.dataset.v; renderEfeitos(); },
  'eye-add'(el) {
    if (!st()) { toast('Abra um vídeo primeiro.'); return; }
    const r = EYECANDY.find((x) => x.slug === el.dataset.slug); const fx = r.fx;
    let item;
    if (fx && fx.startsWith('tex:')) item = F.newTexture(fx.slice(4), app.ph, app.duration);
    else if (fx && fx.startsWith('text:')) item = F.newText(fx.slice(5), app.ph, app.duration);
    else if (fx) item = F.newTech(fx, app.ph, app.duration);
    else item = F.newLang(r, app.ph, app.duration);
    item.slug = r.slug; item.why = 'Técnica do Eyecandy: ' + r.name + '. Adicionada por você no playhead.';
    addItem('Adicionar ' + r.name, item);
  },
  'fg-add'(el) {
    const f = app.fg.items[+el.dataset.i]; if (!f) return; const key = 'fg' + f.fgId;
    mutProj('Referência do Film Grab: ' + f.name, (e) => { if (!e.cinema.some((c) => c.fgId === f.fgId)) e.cinema.push({ key, fgId: f.fgId, name: f.name.toUpperCase(), dir: f.dir, year: f.year, dp: f.dp, aspect: f.aspect, country: f.country, pd: f.pd, costume: f.costume, notes: '', url: f.url, pal: null, state: 'saved' }); return e; });
    app.ui.selRef = key; app.ui.sel = null; app.ui.itab = 'efeito'; refreshLib(); renderInspector(); toast(titleCase(f.name) + ' entrou nas tuas referências. Clique em Em uso/Salvo pra ativar.');
  },
  'fg-more'() { if (!app.fg.loading) { loadFg(app.fg.q, false); refreshLib(); } },
  'ref-open'(el) { app.ui.selRef = el.dataset.k; app.ui.sel = null; app.ui.itab = 'efeito'; refreshLib(); renderInspector(); },
  'cin-quick'() {
    const q = app.ui.search.trim(); if (!q) return; const key = 'u' + Date.now().toString(36);
    mutProj('Nova referência: ' + q, (e) => { e.cinema.push({ key, name: q.toUpperCase(), dir: '', year: '', dp: '', notes: '', url: '', pal: null, state: 'saved' }); return e; });
    app.ui.selRef = key; app.ui.sel = null; app.ui.itab = 'efeito'; app.ui.search = ''; renderEfeitos(); renderInspector();
  },
  'ref-del'(el) { const k = el.dataset.k; mutProj('Apagar referência', (e) => { e.cinema = e.cinema.filter((c) => c.key !== k); return e; }); app.ui.selRef = null; hooks.renderAll(); },
  'ref-pal'(el) { app.palTarget = el.dataset.k; $('#ref-file').click(); },
  'ref-pal-clear'(el) { const k = el.dataset.k; mutProj('Limpar paleta da referência', (e) => { e.cinema.find((c) => c.key === k).pal = null; return e; }); },
  'tl-folder'() { $('#dlg').close(); $('#dir').click(); },
  'texturelabs'() {
    const dlg = $('#dlg');
    dlg.innerHTML = `<div class="dlg"><h2>Texturelabs</h2><div class="muted" style="line-height:1.5">Texturas grátis em alta, liberadas pra uso comercial e em vídeo, sem precisar dar crédito. A licença deles não deixa colocar as texturas dentro de um app, então é assim: baixe a imagem, coloque na tua pasta <b>Overlays</b> e adicione a pasta no Material. Ela aparece aqui como <b>TEXTURA</b>, já animada quadro a quadro, com modo de mistura e opacidade.</div>
      <div class="tl-grid2">${F.TEXTURELABS.map((c) => `<a class="opt" href="${c.url}" target="_blank" rel="noopener noreferrer"><b>${esc(c.name)} ↗</b></a>`).join('')}</div>
      <div class="row2"><button type="button" class="btn" data-act="dlg-close">Fechar</button><button type="button" class="btn solid" data-act="tl-folder">Adicionar pasta Overlays</button></div></div>`;
    dlg.showModal();
  },
  'pack-8mm'() {
    const dlg = $('#dlg');
    dlg.innerHTML = `<div class="dlg"><h2>Pack 8mm gratuito</h2><div class="muted" style="line-height:1.5">Scans reais de película 8 mm pra usar como overlay. O Workbench não guarda nem redistribui esses arquivos: baixe no site, coloque na tua pasta <b>Overlays</b> e adicione a pasta no Material. Eles aparecem aqui na Textura.</div>
      ${F.PACKS_8MM.map((p) => `<a class="opt" href="${p.url}" target="_blank" rel="noopener noreferrer"><b>${esc(p.name)} ↗</b><span>${esc(p.what)}</span></a>`).join('')}
      <div class="note">Confira a licença de cada arquivo no site antes de usar em trabalho comercial. Quando pedir crédito, preencha o criador no overlay que ele entra no creditos.txt da entrega.</div>
      <div class="row2"><button type="button" class="btn" data-act="dlg-close">Fechar</button><button type="button" class="btn solid" data-act="tex-add" data-k="8mm">Usar o 8 MM gerado aqui</button></div></div>`;
    dlg.showModal();
  },
  'fx-add'(el) { if (!st()) { toast('Abra um vídeo primeiro.'); return; } addItem('Adicionar ' + nice(F.techOf(el.dataset.k).name), F.newTech(el.dataset.k, app.ph, app.duration)); },
  'tex-add'(el) {
    if ($('#dlg').open) $('#dlg').close();
    if (!st()) { toast('Abra um vídeo primeiro.'); return; }
    addItem('Adicionar textura ' + nice(F.texOf(el.dataset.k).name), F.newTexture(el.dataset.k, app.ph, app.duration));
  },
  'ov-add'() { if (!st()) { toast('Abra um vídeo primeiro.'); return; } openOverlayPicker(); },
  'ov-pick'(el) { if (!st()) { toast('Abra um vídeo primeiro.'); return; } const i = app.lib.get(el.dataset.id); if ($('#dlg').open) $('#dlg').close(); addItem('Adicionar overlay', F.newOverlay(i.id, i.name, app.ph, app.duration)); },
  'dlg-close'() { $('#dlg').close(); },
  'cin-toggle'(el) { mutProj('Estilo: ' + el.dataset.k, (e) => { const c = e.cinema.find((x) => x.key === el.dataset.k); c.state = c.state === 'use' ? 'saved' : 'use'; return e; }); },
  'cin-add'() { openCinemaAdd(); },
  'cin-save'() {
    const name = ($('#c-name').value || '').trim(); const url = ($('#c-url').value || '').trim();
    if (!name) { toast('Dê um nome pro filme.'); return; }
    mutProj('Nova referência: ' + name, (e) => { e.cinema.push({ key: 'u' + Date.now().toString(36), name: name.toUpperCase(), dir: '', year: '', dp: '', notes: '', url, pal: null, state: 'saved' }); return e; });
    $('#dlg').close(); app.ui.etab = 'cin'; renderEfeitos();
  },
  'style-open'() { app.ui.etab = 'cin'; renderEfeitos(); $('#efeitos').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  'briefing-save'() {
    const name = $('#b-name').value.trim(); const notes = $('#b-notes').value;
    mutProj('Briefing', (e) => { e.briefing = { name, notes }; return e; }); if (name) app.projectName = name; $('#dlg').close(); hooks.renderAll();
  },
  platform(el) {
    const p = F.PLATFORMS.find((x) => x.key === el.dataset.v);
    app.ratio = p.ratio; mutProj('Plataforma: ' + p.label, (e) => { e.platform = p.key; return e; });
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
  // Cortar (navalha): divide o clipe da sequência no playhead e marca o corte de cena
  cut() {
    const t = app.ph; const sq = edit().seq; const { scenes } = st(); const i = curScene();
    const sel = sq && sq.clips.find((c) => c.id === app.ui.selClip && t > c.start + 0.05 && t < c.start + c.dur - 0.05);
    const target = sel || (sq && S.topVideoAt(sq, t)); const okClip = target && t > target.start + 0.05 && t < target.start + target.dur - 0.05;
    const okScene = P.canSplit(scenes, i, t);
    if (!okClip && !okScene) { toast('Aqui não dá pra cortar. Mova o playhead pra dentro de um clipe.'); return; }
    commit('Cortar em ' + fmtT(t), (s2) => { if (okScene) { s2.scenes = P.split(scenes, i, t); s2.edit = M.reconcile(s2.edit, s2.scenes); } if (okClip) { const b = S.splitClip(s2.edit.seq, target.id, t); if (b) app.ui.selClip = b.id; } return s2; });
    hooks.renderAll();
  },
  't-scope'(el) { app.ui.tAll = el.dataset.v === '1'; renderInspector(); },
  'clip-del'() { const id = app.ui.selClip; if (!id) return; app.ui.selClip = null; mutEdit('Apagar clipe', (e) => { S.removeClip(e.seq, id); S.tidy(e.seq); return e; }); },
  'clip-split'() { actions.cut(); },
  'tl-zoom'(el) { setZoom(zoom() * (+el.dataset.d > 0 ? 1.5 : 1 / 1.5)); },
  'seq-open'() { openSeq(false); },
  'seq-preset'(el) { const [w, h] = el.dataset.v.split('x'); $('#sq-w').value = w; $('#sq-h').value = h; },
  'seq-save'() {
    const w = clamp(Math.round(+$('#sq-w').value || 0), 16, 8192); const h = clamp(Math.round(+$('#sq-h').value || 0), 16, 8192); const fps = +$('#sq-fps').value || 30;
    $('#dlg').close();
    mutEdit('Sequência ' + w + '×' + h, (e) => { e.seq.w = w; e.seq.h = h; e.seq.fps = fps; return e; });
  },
  glue() { const { scenes } = st(); const i = curScene(); if (P.canJoinNext(scenes, i)) commitScenes('Colar ' + N(i) + ' e ' + N(i + 1), P.joinNext(scenes, i)); else if (P.canJoinPrev(scenes, i)) commitScenes('Colar ' + N(i - 1) + ' e ' + N(i), P.joinPrev(scenes, i)); },
  async 'detect-exact'() {
    const s = st(); if (!s || app.exact) return;
    const cuts = selectCuts(app.cands, s.sens, app.duration);
    if (!cuts.length) { toast('Nenhuma mudança de cena com essa sensibilidade. Aumente a sensibilidade e tente de novo.'); return; }
    app.exact = 'Detectando… 0%'; renderDetector();
    try {
      const r = await refineCuts(app.url, cuts, { onProgress: (p) => { app.exact = 'Detectando… ' + Math.round(p * 100) + '%'; const b = document.querySelector('[data-act="detect-exact"]'); if (b) b.textContent = app.exact; } });
      const exact = [...new Set(r.cuts)].filter((t) => t > 0.2 && t < app.duration - 0.2).sort((x, y) => x - y);
      const clean = exact.filter((t, k) => k === 0 || t - exact[k - 1] >= P.MIN_SCENE);
      const old = s.scenes; const scenes = P.scenesFromCuts(clean, app.duration);
      scenes.forEach((sc) => { const o = old[P.sceneAt(old, sc.a + 0.01)]; sc.m = o.m.slice(); sc.ox = o.ox.slice(); });
      app.fps = r.fps;
      commitScenes('Detectar cenas: ' + scenes.length + ' cortes no quadro exato', scenes);
      toast(scenes.length + ' cenas, cortadas no quadro exato da mudança (' + String(r.fps).replace('.', ',') + ' quadros por segundo).');
    } catch (err) { if (err.name !== 'AbortError') toast('Não consegui detectar: ' + err.message); }
    finally { app.exact = null; renderDetector(); }
  },
  'idea-add'() {
    const s = st(); if (!s) return; const sc = s.scenes[curScene()];
    if (edit().ideas.some((i) => i.a < sc.b && i.b > sc.a)) { toast('Essa cena já está numa ideia.'); return; }
    mutEdit('Nova ideia', (e) => M.addIdea(e, sc.a, sc.b)); const id = edit().ideas.find((i) => i.a === sc.a).id; app.ui.selIdea = id; app.ui.sel = null; app.ui.itab = 'clipe'; hooks.renderAll();
  },
  'idea-del'(el) { mutEdit('Apagar ideia', (e) => M.removeIdea(e, el.dataset.id)); app.ui.selIdea = null; hooks.renderAll(); },
  itab(el) { app.ui.itab = el.dataset.v; renderInspector(); },
  sel(el) { app.ui.selRef = null; app.ui.sel = el.dataset.id; app.ui.itab = 'efeito'; const it = selItem(); if (it) hooks.seek(it.a + 0.01); hooks.renderAll(); },
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
  if (act === 'ref-field') { const k = el.dataset.k; const rk = el.dataset.ref; const v = k === 'name' ? el.value.toUpperCase() : el.value; mutProj('Detalhe da referência', (e) => { e.cinema.find((c) => c.key === rk)[k] = v; return e; }, 'rf:' + rk + k, true); refreshLib(); return; }
  if (act === 'seg-text') { const k = +el.dataset.k; mutLight('Corrigir transcrição', (e) => { e.transcript.segs[k].text = el.value; return e; }, 'seg:' + k); return; }
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
  } else if (act === 'tstyle') {
    const k = el.dataset.k; const v = k === 'bg' ? (el.checked ? 1 : 0) : k === 'font' || k === 'color' ? el.value : +el.value;
    const it0 = items().find((f) => f.id === id); if (k === 'font') FT.loadFont(v);
    mutLight('Texto: ' + k + (app.ui.tAll ? ' (todos)' : ''), (e) => { for (const f of e.fx) if (f.id === id || (app.ui.tAll && f.kind === 'tt' && f.key !== 'tarja' && !!f.cap === !!it0.cap)) f.params[k] = v; return e; }, 'ts:' + (app.ui.tAll ? 'all' : id) + k);
    hooks.preview();
  } else if (act === 'credit') mutLight('Crédito do overlay', (e) => M.updateFx(e, id, (f) => { f.credit = { ...f.credit, creator: el.value }; }), 'cr:' + id);
  else if (act === 'idea-name') { mutLight('Nome da ideia', (e) => M.renameIdea(e, id, el.value), 'in:' + id); renderTimeline(); }
}
function paramChange(ev) {
  const act = ev.target.dataset.act;
  if (act === 'credit-req') { mutEdit('Atribuição do overlay', (e) => M.updateFx(e, ev.target.dataset.id, (f) => { f.credit = { ...f.credit, required: ev.target.checked }; })); return; }
  if (['param', 'sfx-vol', 'text', 'credit', 'offset', 'idea-name', 'seg-text', 'ref-field'].includes(act) && app.hist) { app.hist.seal(); hooks.renderAll(); }
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
  const ml = $('#masklayer'); ml.addEventListener('pointerdown', maskDown); window.addEventListener('pointermove', maskMove); window.addEventListener('pointerup', maskUp);
  ml.addEventListener('click', (ev) => { if (ev.target.closest('[data-mh]')) ev.stopPropagation(); });
  const tl = $('#tl-card');
  tl.addEventListener('pointerdown', onPointerDown); window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp);
  tl.addEventListener('click', laneClick);
  // arrastar do Material
  document.addEventListener('dragstart', (ev) => { const r = ev.target.closest && ev.target.closest('.tree-row.file[data-id]'); if (!r) return; ev.dataTransfer.setData('text/wb-lib', r.dataset.id); ev.dataTransfer.effectAllowed = 'copy'; });
  tl.addEventListener('dragover', (ev) => { if (![...ev.dataTransfer.types].includes('text/wb-lib')) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; const l = ev.target.closest('.lane'); tl.querySelectorAll('.lane.drop').forEach((x) => { if (x !== l) x.classList.remove('drop'); }); if (l) l.classList.add('drop'); });
  tl.addEventListener('dragleave', (ev) => { const l = ev.target.closest && ev.target.closest('.lane'); if (l && !l.contains(ev.relatedTarget)) l.classList.remove('drop'); });
  tl.addEventListener('drop', dropMaterial);
  // zoom: Ctrl + roda, controle deslizante
  tl.addEventListener('wheel', (ev) => { if (!(ev.ctrlKey || ev.metaKey) || !st()) return; ev.preventDefault(); const lane = tl.querySelector('#timeline .lane'); const t = lane ? laneTime(lane, ev.clientX) : app.ph; setZoom(zoom() * (ev.deltaY < 0 ? 1.25 : 0.8), t); }, { passive: false });
  tl.addEventListener('input', (ev) => { if (ev.target.id === 'tl-zoom') setZoom(+ev.target.value); });
  // Delete apaga o clipe ou o efeito selecionado
  document.addEventListener('keydown', (ev) => {
    if (app.tab !== 'editar' || !st() || ev.target.closest('input,textarea,select,[contenteditable]') || $('#dlg').open) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (app.ui.selClip) { ev.preventDefault(); actions['clip-del'](); } else if (app.ui.sel) { ev.preventDefault(); const id = app.ui.sel; app.ui.sel = null; mutEdit('Apagar efeito', (e) => M.removeFx(e, id)); }
    } else if ((ev.key === 'c' || ev.key === 'C') && !ev.ctrlKey && !ev.metaKey) actions.cut();
    else if (ev.key === '=' || ev.key === '+') setZoom(zoom() * 1.25); else if (ev.key === '-') setZoom(zoom() * 0.8);
  });
  const insp = $('#inspector');
  insp.addEventListener('pointerdown', kfDown); window.addEventListener('pointermove', kfMove); window.addEventListener('pointerup', kfUp); insp.addEventListener('dblclick', kfDbl);
  document.addEventListener('input', (e) => {
    if (e.target.id === 'fx-search') {
      app.ui.search = e.target.value;
      if (app.ui.etab === 'cin') { clearTimeout(fgTimer); fgTimer = setTimeout(() => { loadFg(app.ui.search.trim(), true); refreshLib(); }, 350); app.fg.q = app.ui.search.trim(); app.fg.loading = true; app.fg.items = []; app.fg.total = 0; }
      refreshLib(); return;
    }
    if (e.target.closest('#inspector,#detector')) paramInput(e);
  });
  document.addEventListener('change', (e) => { if (e.target.closest('#inspector,#detector')) paramChange(e); });
}

export function render() {
  renderMaskLayer();
  renderRail(); renderEfeitos(); renderMonitorBar(); renderPalette(); renderDetector(); renderAutofx(); renderTimeline(); renderInspector(); timecode();
}
export { refreshLib, openOverlayPicker };

// ---------- seta: alças da máscara em cima do vídeo ----------
export function renderMaskLayer() {
  const L = $('#masklayer'); if (!L) return;
  const it = selItem();
  if (!it || it.kind !== 'mk' || app.view !== 'video' || !app.ui.fxPreview) { L.innerHTML = ''; L.classList.remove('on'); return; }
  const t = hooks.seqTime(); const s = K.shapeAt(it, t); const inside = t >= it.a && t < it.b;
  const onKf = it.shapeKf.some((k) => Math.abs(k.t - t) < 0.02);
  L.classList.add('on');
  const l = s.x - s.w / 2; const tp = s.y - s.h / 2; const P = (x, y) => `left:${x * 100}%;top:${y * 100}%`;
  const pts = { nw: [l, tp], n: [s.x, tp], ne: [l + s.w, tp], w: [l, s.y], e: [l + s.w, s.y], sw: [l, tp + s.h], s: [s.x, tp + s.h], se: [l + s.w, tp + s.h] };
  L.innerHTML = `<div class="mbox${Math.round(it.params.shape) === 1 ? ' ell' : ''}${inside ? '' : ' out'}" data-mh="move" style="${P(l, tp)};width:${s.w * 100}%;height:${s.h * 100}%"></div>
    <div class="mframe" style="${P(l, tp)};width:${s.w * 100}%;height:${s.h * 100}%"><span class="mtag">${K.maskType(it.key).name}${onKf ? ' · ◆' : ''}</span></div>
    ${Object.entries(pts).map(([h, [x, y]]) => `<i data-mh="${h}" class="mh ${h}" style="${P(x, y)}"></i>`).join('')}`;
}
let md = null;
function maskDown(ev) {
  const h = ev.target.closest('[data-mh]'); if (!h) return; const it = selItem(); if (!it || it.kind !== 'mk') return;
  const L = $('#masklayer').getBoundingClientRect(); const t = hooks.seqTime();
  md = { id: it.id, h: h.dataset.mh, x0: ev.clientX, y0: ev.clientY, L, s0: K.shapeAt(it, t), t };
  app.player.pause(); h.setPointerCapture && h.setPointerCapture(ev.pointerId); ev.preventDefault(); ev.stopPropagation();
}
function maskMove(ev) {
  if (!md) return;
  const dx = (ev.clientX - md.x0) / md.L.width; const dy = (ev.clientY - md.y0) / md.L.height; const s = { ...md.s0 }; const h = md.h;
  if (h === 'move') { s.x += dx; s.y += dy; }
  else {
    let l = s.x - s.w / 2; let r = s.x + s.w / 2; let tp = s.y - s.h / 2; let bt = s.y + s.h / 2;
    if (h.includes('w')) l += dx; if (h.includes('e')) r += dx; if (h.includes('n')) tp += dy; if (h.includes('s')) bt += dy;
    if (r - l < 0.03) r = l + 0.03; if (bt - tp < 0.03) bt = tp + 0.03;
    s.x = (l + r) / 2; s.w = r - l; s.y = (tp + bt) / 2; s.h = bt - tp;
  }
  mutLight('Mover máscara', (e) => { const i = e.fx.findIndex((f) => f.id === md.id); e.fx[i] = K.setShapeAt(e.fx[i], md.t, s); return e; }, 'mk:' + md.id + ':' + md.t);
  renderMaskLayer(); hooks.preview();
}
function maskUp() { if (md) { md = null; app.hist.seal(); hooks.renderAll(); } }

// ---------- desenho da prévia (Editar) ----------
export function sceneCrop(t) {
  const s = st(); if (!s) return { ox: 50 };
  const sc = s.scenes[P.sceneAt(s.scenes, t)]; const k = P.RATIOS.indexOf(app.ratio);
  return { ox: k >= 0 && k < 3 && sc.m[k] === 2 ? sc.ox[k] : 50 };
}
let palAt = 0;
export function drawMon() {
  const cv = $('#cv-mon'); if (!cv) return;
  const t = app.view === 'video' ? hooks.seqTime() : 0;
  const so = app.view === 'video' ? hooks.seqSource(t) : null;
  const src = app.view === 'video' ? (so && so.el) : app.view === 'image' ? still : null;
  const { w, h } = outSize(app.ratio, 640);
  const e = edit();
  if (!src || !e) {
    if (cv.width !== w) { cv.width = w; cv.height = h; } const g = cv.getContext('2d'); g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, w, h);
    updateChips(null); return;
  }
  const sw = so ? so.sw : still.naturalWidth; const sh = so ? so.sh : still.naturalHeight;
  const comps = app.ui.fxPreview ? compsAt(e, M.groupAt(e, t)) : [];
  const info = app.comp.render(cv, { src, sw, sh, t, ratio: app.ratio, ox: sceneCrop(t).ox, fx: e.fx, fxOn: app.ui.fxPreview, comps, overlays: app.overlays, W: w, H: h });
  hooks.afterDraw && hooks.afterDraw(info, t);
  if (selItem() && selItem().kind === 'mk' && !md) renderMaskLayer();
  updateChips(info);
  const now = performance.now();
  if (now - palAt > 700) { palAt = now; try { const sm = sampleCanvas(cv, 64); app.palCur = extractPalette(sm.data); renderPalette(); } catch (err) { /* ignora */ } }
}
