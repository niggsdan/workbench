// Tela Entrega: destinos por plataforma, prévia do que sai, fila de render e arquivos pra outros programas.
import { app, $, esc, fmtT, fmtClock, video, still, st, edit, mutEdit, hooks, toast, compsAt } from './store.js';
import * as F from './fx.js';
import * as M from './model.js';
import { outSize } from './render.js';
import { renderPiece, finalize, edl, xmeml, credits, recorderMime } from './export.js';
import { serializeProject } from './project.js';

const DEF = { youtube: { on: false, ratio: '16:9', mode: 'inteiro' }, tiktok: { on: true, ratio: '9:16', mode: 'ideia' }, instagram: { on: false, ratio: '4:5', mode: 'inteiro' } };
let saved = null; try { saved = JSON.parse(localStorage.getItem('wb.dest') || 'null'); } catch (e) { saved = null; }
app.dest = saved && saved.youtube ? saved : JSON.parse(JSON.stringify(DEF));
app.out = { long: 1920, bitrate: 10e6 };
try { Object.assign(app.out, JSON.parse(localStorage.getItem('wb.out') || '{}')); } catch (e) { /* padrão */ }
app.focusDest = 'tiktok';
app.queue = [];
const persist = () => { localStorage.setItem('wb.dest', JSON.stringify(app.dest)); localStorage.setItem('wb.out', JSON.stringify(app.out)); };
const MODES = { inteiro: 'Vídeo inteiro', ideia: 'Uma peça por ideia', cena: 'Uma peça por cena' };

function piecesOf(key) {
  const s = st(); const d = app.dest[key];
  if (d.mode === 'cena') return s.scenes.map((sc, i) => ({ name: 'C' + (i + 1), a: sc.a, b: sc.b }));
  if (d.mode === 'ideia' && s.edit.ideas.length) return s.edit.ideas.map((i) => ({ name: i.name, a: i.a, b: i.b }));
  return [{ name: 'completo', a: 0, b: app.duration }];
}
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'projeto';
const fileName = (key, piece, container) => slug(app.projectName || app.name.replace(/\.[^.]+$/, '')) + '_' + key + (piece.name === 'completo' ? '' : '_' + slug(piece.name)) + '_' + new Date().toISOString().slice(0, 10) + '.' + container;

function renderDest() {
  const s = st();
  $('#e-dest').innerHTML = `<div class="p-head"><h2 class="tool">Destinos</h2><div class="note" style="margin-top:6px">Marque onde vai publicar. Cada destino tem o seu formato e corte.</div></div>
    <div class="dest-list">${F.PLATFORMS.map((p) => { const d = app.dest[p.key]; const n = s ? piecesOf(p.key).length : 0; return `<div class="dest" aria-pressed="${app.focusDest === p.key}">
      <div class="r"><label class="toggle" style="font-weight:800;font-size:13px"><input type="checkbox" data-act="dest-on" data-k="${p.key}" ${d.on ? 'checked' : ''}> ${p.label}</label><button type="button" class="btn sm" data-act="dest-focus" data-k="${p.key}" aria-pressed="${app.focusDest === p.key}">Ver</button></div>
      <small>${d.ratio} · ${MODES[d.mode]}${s ? ' · ' + n + (n === 1 ? ' arquivo' : ' arquivos') : ''}</small>
      <div class="seg sm" style="margin-top:6px">${['9:16', '1:1', '4:5', '16:9'].map((r) => `<button type="button" data-act="dest-ratio" data-k="${p.key}" data-v="${r}" aria-pressed="${d.ratio === r}">${r}</button>`).join('')}</div>
      <div class="seg sm" style="margin-top:4px">${Object.entries(MODES).map(([k, l]) => `<button type="button" data-act="dest-mode" data-k="${p.key}" data-v="${k}" aria-pressed="${d.mode === k}">${l.replace('Uma peça por ', 'Por ').replace('Vídeo inteiro', 'Inteiro')}</button>`).join('')}</div>
      ${d.mode === 'ideia' && s && !s.edit.ideas.length ? '<small>Sem ideias marcadas: sai o vídeo inteiro. Marque ideias na faixa Ideias da timeline.</small>' : ''}</div>`; }).join('')}</div>`;
}

function renderPrev() {
  const s = st(); const e = edit(); const key = app.focusDest; const d = app.dest[key];
  const on = F.PLATFORMS.filter((p) => app.dest[p.key].on);
  const files = s ? on.reduce((n, p) => n + piecesOf(p.key).length, 0) : 0;
  const { w, h } = outSize(d.ratio, app.out.long);
  $('#e-prev').innerHTML = `<div class="v-stage">${app.view === 'video' ? '<div class="v-wrap"><canvas id="cv-ent" aria-label="Prévia da entrega"></canvas><span class="tag b">' + F.PLATFORMS.find((p) => p.key === key).label + ' · ' + d.ratio + '</span></div>' : '<div class="muted" style="text-align:center;max-width:320px">Abra um vídeo na aba Editar. A entrega usa o vídeo aberto, com reenquadre, efeitos, cor, textura, overlay e texto.</div>'}</div>
    <div class="e-sum"><h2 class="tool">Resumo</h2><dl>
      <dt>Arquivos</dt><dd>${files}</dd><dt>Formato</dt><dd>${(e ? e.container : 'mp4').toUpperCase()}</dd><dt>Resolução</dt><dd>${w} × ${h}</dd>
      <dt>Duração</dt><dd>${s ? fmtClock(F.outDuration(e.fx, app.duration)) : '—'}</dd><dt>Efeitos</dt><dd>${e ? e.fx.filter((f) => f.kind === 'tec').length : 0}</dd>
      <dt>Texturas</dt><dd>${e ? e.fx.filter((f) => f.kind === 'tx').length : 0}</dd><dt>Grupos de cor</dt><dd>${e ? M.groupCount(e) : 0}</dd>
      <dt>Sugestões pendentes</dt><dd>${e ? e.fx.filter((f) => f.auto && !f.accepted).length : 0}</dd></dl>
      <div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn sm" data-act="step-back">◀</button><button type="button" class="btn sm solid" data-act="play">${!app.player.playing ? 'Tocar' : 'Pausar'}</button><button type="button" class="btn sm" data-act="step-fwd">▶</button><span class="mono muted" id="e-tc" style="margin-left:auto">${fmtT(app.ph)}</span></div>
      <button type="button" class="btn solid" style="height:40px;margin-top:6px" data-act="export" ${s && files && !app.exporting ? '' : 'aria-disabled="true"'}>${app.exporting ? 'Exportando…' : 'Exportar ' + files + (files === 1 ? ' arquivo' : ' arquivos')}</button>
      ${e && e.fx.some((f) => f.auto && !f.accepted) ? '<div class="note">Sugestões não aceitas também entram no render. Revise no Editar se quiser.</div>' : ''}</div>`;
}

function renderQueue() {
  const q = app.queue;
  $('#e-queue').innerHTML = `<div class="p-title"><h2 class="tool">Fila de render</h2>${app.exporting ? '<button type="button" class="btn sm" data-act="export-cancel">Cancelar</button>' : ''}</div>
    ${q.length ? q.map((j, i) => `<div class="q-row"><div><div class="nm">${esc(j.file)}</div><div class="st">${esc(j.status)}</div></div>
      <div>${j.blob ? `<button type="button" class="btn sm solid" data-act="q-dl" data-i="${i}">Baixar</button>` : ''}</div>${j.blob ? '' : `<div class="bar"><i style="width:${Math.round(j.p * 100)}%"></i></div>`}</div>`).join('')
      : `<div class="note" style="line-height:1.5">O render roda no teu computador, em tempo real: um vídeo de 1 minuto leva cerca de 1 minuto por arquivo, mais a conversão. Deixe esta aba aberta e na frente enquanto exporta. ${recorderMime() ? '' : '<b>Este navegador não grava vídeo; use Chrome ou Edge.</b>'}</div>`}`;
}

function renderOpts() {
  const e = edit(); const c = e ? e.container : 'mp4';
  $('#e-opts').innerHTML = `<div class="chips"><span class="kchip">Saída</span></div><h3 class="big">Formato</h3>
    <div><h3>Arquivo</h3><div class="seg" style="margin-top:6px"><button type="button" data-act="container" data-v="mp4" aria-pressed="${c === 'mp4'}">MP4 · H.264</button><button type="button" data-act="container" data-v="mov" aria-pressed="${c === 'mov'}">MOV · H.264</button></div></div>
    <div><h3>Resolução</h3><div class="seg" style="margin-top:6px">${[[1280, '720p'], [1920, '1080p'], [2560, '1440p']].map(([v, l]) => `<button type="button" data-act="out-long" data-v="${v}" aria-pressed="${app.out.long === v}">${l}</button>`).join('')}</div></div>
    <div><h3>Qualidade</h3><div class="seg" style="margin-top:6px">${[[4e6, 'Leve'], [10e6, 'Alta'], [20e6, 'Máxima']].map(([v, l]) => `<button type="button" data-act="out-br" data-v="${v}" aria-pressed="${app.out.bitrate === v}">${l}</button>`).join('')}</div><div class="note" style="margin-top:6px">${Math.round(app.out.bitrate / 1e6)} Mbps de vídeo, áudio AAC 160 kbps.</div></div>
    <div><h3>Pra outros programas</h3><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
      <button type="button" class="btn" data-act="pack-xml" ${st() ? '' : 'aria-disabled="true"'}>XML (Premiere, DaVinci Resolve)</button>
      <button type="button" class="btn" data-act="pack-edl" ${st() ? '' : 'aria-disabled="true"'}>EDL CMX 3600 (Premiere, Resolve, Avid)</button>
      <button type="button" class="btn" data-act="pack-credits" ${st() ? '' : 'aria-disabled="true"'}>Créditos (.txt)</button>
      <button type="button" class="btn" data-act="tr-srt" ${e && e.transcript ? '' : 'aria-disabled="true"'} title="${e && e.transcript ? '' : 'Transcreva o vídeo primeiro'}">Legendas (.srt)</button>
      <button type="button" class="btn" data-act="save" ${st() ? '' : 'aria-disabled="true"'}>Projeto Workbench (.json)</button></div>
      <div class="note" style="margin-top:6px;line-height:1.5">After Effects: importe o XML no Premiere e mande pro AE (Dynamic Link). CapCut não abre projeto de fora: use o MP4 exportado.</div></div>`;
}

export function render() { if (app.tab !== 'entrega') return; renderDest(); renderPrev(); renderQueue(); renderOpts(); }

export function drawEnt() {
  const cv = $('#cv-ent'); if (!cv || app.view !== 'video') return; const e = edit(); if (!e) return;
  const d = app.dest[app.focusDest]; const { w, h } = outSize(d.ratio, 640); const t = hooks.seqTime();
  const so = hooks.seqSource(t); if (!so) return; app.comp.render(cv, { src: so.el, sw: so.sw, sh: so.sh, t, ratio: d.ratio, ox: hooks.sceneCrop(t, d.ratio).ox, fx: e.fx, fxOn: true, comps: compsAt(e, M.groupAt(e, t)), overlays: app.overlays, W: w, H: h });
  const tc = $('#e-tc'); if (tc) tc.textContent = fmtT(app.ph);
}

function download(blob, name) { const a = $('#dl'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); }

export async function startExport() {
  const s = st(); if (!s || app.view !== 'video') { toast('Abra um vídeo na aba Editar pra exportar.'); return; }
  if (app.exporting) return;
  if (!recorderMime()) { toast('Este navegador não grava vídeo. Use o Chrome ou o Edge.'); return; }
  const on = F.PLATFORMS.filter((p) => app.dest[p.key].on);
  if (!on.length) { toast('Marque pelo menos um destino.'); return; }
  const e = s.edit; const container = e.container;
  app.queue = []; on.forEach((p) => piecesOf(p.key).forEach((pc) => app.queue.push({ key: p.key, ratio: app.dest[p.key].ratio, piece: pc, file: fileName(p.key, pc, container), status: 'na fila', p: 0, blob: null })));
  const ctl = new AbortController(); app.exporting = ctl; app.player.pause(); render();
  const frozen = JSON.parse(JSON.stringify(s));
  for (const j of app.queue) {
    if (ctl.signal.aborted) { j.status = 'cancelado'; continue; }
    try {
      j.status = 'gravando (tempo real)…'; renderQueue();
      const crop = (t) => hooks.sceneCrop(t, j.ratio, frozen.scenes).ox;
      const comps = (t) => compsAt(frozen.edit, M.groupAt(frozen.edit, t));
      const r = await renderPiece({ url: app.url, piece: j.piece, ratio: j.ratio, long: app.out.long, bitrate: app.out.bitrate, container, state: frozen, comps, crop, overlays: app.overlays, signal: ctl.signal,
        onProgress: (p) => { j.p = p * 0.85; const b = document.querySelectorAll('#e-queue .q-row .bar i')[app.queue.indexOf(j)]; if (b) b.style.width = Math.round(j.p * 100) + '%'; } });
      j.status = r.mime.includes('avc1') && container === 'mp4' ? 'finalizando…' : 'convertendo pra ' + container.toUpperCase() + '…'; renderQueue();
      j.blob = await finalize(r.raw, r.mime, container, (p) => { j.p = 0.85 + p * 0.15; });
      j.p = 1; j.status = 'pronto · ' + r.W + '×' + r.H + ' · ' + (j.blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB';
      download(j.blob, j.file);
    } catch (err) { j.status = err.name === 'AbortError' ? 'cancelado' : 'erro: ' + err.message; }
    renderQueue();
  }
  app.exporting = null; render(); hooks.renderHeader();
  const ok = app.queue.filter((j) => j.blob).length; toast(ok ? ok + (ok === 1 ? ' arquivo exportado' : ' arquivos exportados') + ' pra pasta Downloads.' : 'Nada foi exportado.');
}

const base = () => slug(app.projectName || app.name.replace(/\.[^.]+$/, ''));
export const actions = {
  'dest-focus'(el) { app.focusDest = el.dataset.k; app.ratio = app.dest[el.dataset.k].ratio; render(); hooks.preview(); },
  'dest-ratio'(el) { app.dest[el.dataset.k].ratio = el.dataset.v; app.focusDest = el.dataset.k; persist(); render(); hooks.preview(); },
  'dest-mode'(el) { app.dest[el.dataset.k].mode = el.dataset.v; app.focusDest = el.dataset.k; persist(); render(); },
  'out-long'(el) { app.out.long = +el.dataset.v; persist(); render(); },
  'out-br'(el) { app.out.bitrate = +el.dataset.v; persist(); render(); },
  'export-cancel'() { if (app.exporting) app.exporting.abort(); },
  'q-dl'(el) { const j = app.queue[+el.dataset.i]; if (j && j.blob) download(j.blob, j.file); },
  'pack-xml'() { const s = st(); download(new Blob([xmeml(app.projectName || app.name, app.name, app.duration, s.scenes, s.edit.fx)], { type: 'application/xml' }), base() + '_premiere.xml'); toast('XML salvo. No Premiere: Arquivo > Importar, e aponte o vídeo original se ele pedir.'); },
  'pack-edl'() { const s = st(); download(new Blob([edl(app.projectName || app.name, app.name, s.scenes, s.edit.fx)], { type: 'text/plain' }), base() + '.edl'); toast('EDL salva. Os efeitos vão como comentários em cada corte.'); },
  'pack-credits'() { download(new Blob([credits(edit(), app.lib)], { type: 'text/plain' }), base() + '_creditos.txt'); }
};
export function bind() {
  $('#view-entrega').addEventListener('change', (e) => { if (e.target.dataset.act === 'dest-on') { app.dest[e.target.dataset.k].on = e.target.checked; app.focusDest = e.target.dataset.k; persist(); render(); } });
}
export { serializeProject };
