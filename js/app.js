// Workbench: liga as telas (Editar, Cor, Entrega), o vídeo, o projeto e o loop de prévia.
import { app, $, $$, esc, fmtT, video, still, st, edit, commit, mutEdit, hooks, toast, freshHistory, clamp } from './store.js';
import * as P from './project.js';
import * as M from './model.js';
import { History } from './history.js';
import { candidates, selectCuts, DEFAULT_SENS } from './detect.js';
import { sampleVideo } from './sampler.js';
import { fxState, PLATFORMS } from './fx.js';
import { playSound } from './sound.js';
import { entriesFromDrop } from './sources.js';
import * as Mat from './ui-material.js';
import * as Ed from './ui-editar.js';
import * as Cor from './ui-cor.js';
import * as Ent from './ui-entrega.js';

const say = (t) => { const a = $('#analysis'); if (a) { a.textContent = t; a.title = t; } };
hooks.say = say;

// ---------- topo e abas ----------
function renderHeader() {
  for (const b of $$('.tabs .tab')) { const on = b.dataset.v === app.tab; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  const h = app.hist;
  for (const [id, ok, label, what] of [['#undo-top', h && h.canUndo, h && h.undoLabel, 'Desfazer'], ['#redo-top', h && h.canRedo, h && h.redoLabel, 'Refazer']]) {
    const b = $(id); b.setAttribute('aria-disabled', ok ? 'false' : 'true'); b.title = ok ? what + ': ' + label : 'Nada para ' + what.toLowerCase();
  }
  const n = app.lib.items.length; const src = { drive: 'Drive', pasta: 'Pasta', upload: 'Upload' }[app.source] || 'Sem material';
  $('#proj-pill').innerHTML = `<span class="dot"></span><b class="ell">${esc(app.projectName || 'Projeto novo')}</b><small>${src} · ${n} ${n === 1 ? 'arquivo' : 'arquivos'}${app.savedAt ? ' · salvo ' + new Date(app.savedAt).toTimeString().slice(0, 5) : ''}</small>`;
  const c = edit() ? edit().container : (app.container || 'mp4');
  for (const b of $$('#container button')) b.setAttribute('aria-pressed', String(b.dataset.v === c));
  const ex = $('#export-top'); ex.textContent = app.exporting ? 'Exportando…' : 'Exportar';
}
hooks.renderHeader = renderHeader;

function go(tab) {
  app.tab = tab;
  for (const v of ['editar', 'cor', 'entrega']) $('#view-' + v).hidden = v !== tab;
  if (tab === 'entrega') app.ratio = app.dest[app.focusDest].ratio;
  renderAll(); app.dirty = true; window.scrollTo({ top: 0 });
}
hooks.go = go;

function renderAll() {
  renderHeader();
  if (app.tab === 'editar') { Mat.renderMaterial(); Ed.render(); }
  else if (app.tab === 'cor') Cor.render();
  else Ent.render();
  app.dirty = true; autosaveSoon();
}
hooks.renderAll = renderAll;
hooks.preview = () => { app.dirty = true; };
hooks.renderSel = () => { Ed.renderTimeline(); Ed.renderInspector(); };
hooks.selectGroup = (i) => { const [a, b] = M.groupRange(edit(), i, app.duration); seek(a + Math.min(0.5, (b - a) / 2)); app.ui.editing = 'shot'; app.ui.node = null; go('cor'); };

// ---------- vídeo ----------
function setView(v) {
  app.view = v;
  $('#frame').classList.toggle('on', !!v);
  $('#empty').hidden = !!v;
  $('#audio-card').hidden = v !== 'audio';
}

function seek(t) {
  const tt = clamp(t, 0, Math.max(0, app.duration - 0.05));
  app.ph = P.r1(tt);
  if (app.view === 'video' || app.view === 'audio') video.currentTime = tt;
  lastT = tt; syncOverlays(tt, false);
  if (app.tab === 'editar') { Ed.renderDetector(); Ed.renderTimeline(); Ed.timecode(); if (app.ui.itab === 'clipe') Ed.renderInspector(); }
  else if (app.tab === 'cor') Cor.render(); else Ent.render();
  app.dirty = true;
}
hooks.seek = seek;
let audioCtx = null;
const ac = () => { if (!audioCtx) audioCtx = new AudioContext(); if (audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; };
hooks.previewSound = (key, vol) => { const c = ac(); playSound(c, c.destination, key, c.currentTime + 0.02, vol, 2); };
function togglePlay() {
  if (!app.view || app.view === 'image') return;
  if (video.paused) { ac(); lastT = video.currentTime; video.play(); } else video.pause();
}
hooks.togglePlay = togglePlay;

hooks.sceneCrop = (t, ratio = app.ratio, scenes = st() && st().scenes) => {
  if (!scenes) return { ox: 50 };
  const sc = scenes[P.sceneAt(scenes, t)]; const k = P.RATIOS.indexOf(ratio);
  return { ox: k >= 0 && k < 3 && sc.m[k] === 2 ? sc.ox[k] : 50 };
};

function resetEditor() {
  if (app.abort) { app.abort.abort(); app.abort = null; }
  video.pause();
  Object.assign(app, { duration: 0, cands: [], thumbs: [], hist: null, ph: 0, idx: -1, busy: false, error: '', notice: '' });
  app.ui.sel = null; app.ui.node = null;
}

function sceneColors(scenes) {
  return scenes.map((s) => {
    const mid = (s.a + s.b) / 2; const th = app.thumbs.reduce((b, t) => (!b || Math.abs(t.t - mid) < Math.abs(b.t - mid) ? t : b), null);
    if (!th) return [128, 128, 128];
    const c = [0, 0, 0]; const d = th.rgba; for (let i = 0; i < d.length; i += 4) { c[0] += d[i]; c[1] += d[i + 1]; c[2] += d[i + 2]; }
    const n = d.length / 4; return c.map((v) => v / n);
  });
}
hooks.autoGroups = (asAction) => {
  const s = st(); if (!s || !app.thumbs.length) return;
  const gb = M.autoGroupBounds(s.scenes, sceneColors(s.scenes));
  if (asAction) { mutEdit('Agrupar por cor: ' + (gb.length + 1) + ' grupos', (e) => M.setGroups(e, gb)); toast((gb.length + 1) + ' grupos de cor. Cada um tem a sua grade.'); }
  return gb;
};

async function loadVideo(play, it) {
  resetEditor();
  if (app.url) URL.revokeObjectURL(app.url);
  const ctl = new AbortController();
  Object.assign(app, { name: it.name, size: it.size, url: URL.createObjectURL(play), busy: true, abort: ctl });
  video.src = app.url; setView('video');
  const pending = app.pending; app.pending = null;
  say('Analisando o vídeo…'); renderAll();
  toast('Abri "' + it.name + '". Já dá pra tocar e mexer; os cortes de cena aparecem em seguida.', 5000);
  try {
    await new Promise((r) => { if (video.readyState >= 1) r(); else video.addEventListener('loadedmetadata', r, { once: true }); });
    app.duration = video.duration; app.dirty = true;
    const { duration, series, thumbs } = await sampleVideo(app.url, { signal: ctl.signal, onProgress: (p) => say('Analisando ' + Math.round(p * 100) + '%') });
    app.duration = duration; app.thumbs = thumbs || [];
    if (pending && Math.abs(duration - pending.video.duration) <= 0.5) {
      app.cands = pending.cands.length ? pending.cands : candidates(series);
      app.ratio = pending.ratio;
      app.hist = new History({ scenes: pending.scenes, sens: pending.sens, edit: pending.edit }, 'Projeto aberto');
      if (pending.edit.briefing.name) app.projectName = pending.edit.briefing.name;
      say('Projeto aberto: ' + pending.scenes.length + ' cenas.'); toast('Projeto retomado com ' + pending.edit.fx.length + ' itens e ' + M.groupCount(pending.edit) + ' grupos de cor.');
    } else {
      app.cands = candidates(series);
      const scenes = P.scenesFromCuts(selectCuts(app.cands, DEFAULT_SENS, duration), duration);
      app.hist = freshHistory(scenes, DEFAULT_SENS, 'Detecção automática');
      const gb = hooks.autoGroups(false) || [];
      app.hist.items[0].state.edit = M.setGroups(app.hist.items[0].state.edit, gb);
      const plat = PLATFORMS.find((p) => p.key === app.hist.current.edit.platform); app.ratio = plat.ratio;
      say((pending ? 'Duração diferente do projeto, analisei do zero. ' : '') + scenes.length + ' cenas, ' + (gb.length + 1) + ' grupos de cor.');
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    app.error = 'Não consegui analisar este vídeo (' + e.message + ').'; say(app.error);
  } finally {
    if (app.abort === ctl) { app.busy = false; app.abort = null; }
    renderAll();
  }
}
async function loadAudio(play, it) {
  resetEditor(); if (app.url) URL.revokeObjectURL(app.url);
  app.url = URL.createObjectURL(play); video.src = app.url; app.name = it.name; $('#audio-name').textContent = it.name;
  setView('audio'); app.notice = 'Áudio aberto. O detector de cenas e a cor são pra vídeo.';
  await new Promise((r) => { if (video.readyState >= 1) r(); else video.addEventListener('loadedmetadata', r, { once: true }); });
  app.duration = Number.isFinite(video.duration) ? video.duration : 0; renderAll();
}
async function loadStill(file, it) {
  resetEditor(); if (app.url) URL.revokeObjectURL(app.url);
  app.url = URL.createObjectURL(file); still.src = app.url; app.name = it.name;
  await still.decode().catch(() => {});
  setView('image'); app.notice = 'Imagem aberta. O detector de cenas é pra vídeo.'; renderAll();
}
Object.assign(hooks, { loadVideo, loadAudio, loadStill });

// ---------- overlays ----------
const ovPrep = new Set();
function syncOverlays(t, playing) {
  const e = edit(); if (!e) return;
  for (const f of e.fx) {
    if (f.kind !== 'ov') continue;
    let v = app.overlays.get(f.lib);
    if (!v) {
      if (ovPrep.has(f.lib)) continue; ovPrep.add(f.lib);
      const it = app.lib.get(f.lib); if (!it) continue;
      Mat.prepareItem(it).then((blob) => { const el = document.createElement('video'); el.muted = true; el.loop = true; el.playsInline = true; el.src = URL.createObjectURL(blob); el.addEventListener('seeked', () => { app.dirty = true; }); app.overlays.set(f.lib, el); app.dirty = true; }).catch(() => toast('Não consegui preparar o overlay ' + it.name + '.'));
      continue;
    }
    const inside = t >= f.a && t < f.b;
    v.playbackRate = f.params.speed / 100;
    if (inside && playing) { if (v.paused) v.play().catch(() => {}); }
    else { if (!v.paused) v.pause(); if (inside && v.duration) { const want = ((t - f.a) * f.params.speed / 100) % v.duration; if (Math.abs(v.currentTime - want) > 0.15) v.currentTime = want; } }
  }
}
hooks.syncOverlays = syncOverlays;

// ---------- loop de prévia ----------
let lastT = 0; let lastScene = -1;
function tick() {
  requestAnimationFrame(tick);
  if (!app.view) return;
  const playing = (app.view === 'video' || app.view === 'audio') && !video.paused;
  if (playing) {
    const t = video.currentTime; app.ph = P.r1(t);
    const e = edit();
    if (e && app.ui.fxPreview && app.view === 'video') {
      const f = fxState(e.fx, t);
      const rate = clamp(f.rate, 0.25, 4); if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate;
      if (f.skipTo !== null && f.skipTo > t + 0.05) video.currentTime = f.skipTo;
      for (const it of e.fx) {
        if (!it.sfx) continue; const at = it.kind === 'sx' ? it.a : it.a + it.sfx.off;
        if (at > lastT && at <= t + 0.03) { const c = ac(); playSound(c, c.destination, it.sfx.key, c.currentTime, it.sfx.vol, Math.min(8, it.b - it.a)); }
      }
    } else if (video.playbackRate !== 1) video.playbackRate = 1;
    lastT = t; syncOverlays(t, true);
    Ed.syncPlayhead(); Ed.timecode();
    const s = st(); if (s) { const i = P.sceneAt(s.scenes, app.ph); if (i !== lastScene) { lastScene = i; if (app.tab === 'editar') { Ed.renderDetector(); Ed.renderTimeline(); } } }
    const tc = $('#c-tc'); if (tc) tc.innerHTML = fmtT(app.ph) + ' <span class="muted">/ ' + fmtT(app.duration) + '</span>';
  }
  if (playing || app.dirty) {
    app.dirty = false;
    if (app.tab === 'editar') Ed.drawMon(); else if (app.tab === 'cor') Cor.drawCor(); else Ent.drawEnt();
  }
}

// ---------- projeto ----------
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'projeto';
function projectText() { const s = st(); return P.serializeProject({ video: { name: app.name, size: app.size, duration: app.duration }, sens: s.sens, ratio: app.ratio, scenes: s.scenes, cands: app.cands, edit: s.edit }); }
function saveProject() {
  if (!st()) { toast('Abra um vídeo antes de salvar o projeto.'); return; }
  const a = $('#dl'); const name = 'workbench_' + slug(app.projectName || app.name.replace(/\.[^.]+$/, '')) + '_' + new Date().toISOString().slice(0, 10) + '.json';
  a.href = URL.createObjectURL(new Blob([projectText()], { type: 'application/json' })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  app.savedAt = Date.now(); autosave(); renderHeader();
  toast('Projeto salvo em Downloads como ' + name + '. Pode continuar editando: nada saiu da tela.', 7000);
}
async function openProjectFile(file) {
  const r = P.parseProject(await file.text());
  if (!r.ok) { toast('Não consegui abrir o projeto: ' + r.error); return; }
  usePending(r.project);
}
function usePending(project) {
  app.pending = project;
  if (project.edit.briefing.name) app.projectName = project.edit.briefing.name;
  const it = app.lib.items.find((i) => i.name === project.video.name);
  if (it) { Mat.openItem(it.id); return; }
  toast('Projeto lido. Agora escolha o vídeo "' + project.video.name + '" (abrindo o seletor).', 8000);
  renderAll(); $('#file').click();
}
let autoT = 0;
function autosave() { if (!st()) return; try { localStorage.setItem('wb.autosave', projectText()); localStorage.setItem('wb.autosaveAt', String(Date.now())); localStorage.setItem('wb.autosaveName', app.projectName || app.name); } catch (e) { /* sem espaço */ } }
function autosaveSoon() { clearTimeout(autoT); autoT = setTimeout(autosave, 1500); }
function renderResume() {
  const el = $('#resume'); const txt = localStorage.getItem('wb.autosave');
  if (!txt || app.view) { el.innerHTML = ''; return; }
  const at = +localStorage.getItem('wb.autosaveAt') || 0; const name = localStorage.getItem('wb.autosaveName') || 'projeto';
  el.innerHTML = `<div class="resume">Último projeto: <b>${esc(name)}</b> · salvo sozinho ${at ? new Date(at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''} <button type="button" class="btn sm solid" data-act="resume">Retomar</button></div>`;
}

function dialog(html) { const d = $('#dlg'); d.innerHTML = html; if (!d.open) d.showModal(); }
const appActions = {
  tab(el) { go(el.dataset.v); },
  undo() { if (app.hist && app.hist.undo()) { app.ui.sel = edit().fx.some((f) => f.id === app.ui.sel) ? app.ui.sel : null; renderAll(); } },
  redo() { if (app.hist && app.hist.redo()) renderAll(); },
  save() { saveProject(); },
  'open-project'() { $('#dlg').open && $('#dlg').close(); $('#proj').click(); },
  'project-menu'() {
    dialog(`<div class="dlg"><h2>Projeto</h2>
      <label for="p-name">Nome do projeto</label><input id="p-name" type="text" value="${esc(app.projectName)}" placeholder="Ex.: Dia feliz em Sorocaba">
      <button type="button" class="opt" data-act="save" ${st() ? '' : 'disabled'}><b>Salvar projeto (.json)</b><span>Baixa o arquivo do projeto e você continua editando. O Workbench também salva sozinho neste navegador.</span></button>
      <button type="button" class="opt" data-act="open-project"><b>Abrir projeto</b><span>Escolha um .json do Workbench. Depois ele pede o vídeo, se ainda não estiver no Material.</span></button>
      <button type="button" class="opt" data-act="tool" data-name="Briefing"><b>Briefing</b><span>Objetivo, tom, referências e entregas.</span></button>
      <div class="row2"><button type="button" class="btn" data-act="dlg-close">Fechar</button><button type="button" class="btn solid" data-act="rename">Salvar nome</button></div></div>`);
  },
  rename() { app.projectName = $('#p-name').value.trim(); if (st()) mutEdit('Nome do projeto', (e) => { e.briefing.name = app.projectName; return e; }); $('#dlg').close(); renderAll(); },
  resume() {
    const r = P.parseProject(localStorage.getItem('wb.autosave') || ''); if (!r.ok) { toast('O salvamento automático está corrompido: ' + r.error); return; }
    usePending(r.project);
  },
  container(el) {
    const v = el.dataset.v; app.container = v;
    if (st()) mutEdit('Arquivo: ' + v.toUpperCase(), (e) => { e.container = v; return e; }); else renderHeader();
  },
  export() { if (app.tab !== 'entrega') go('entrega'); Ent.startExport(); },
  pack() {
    dialog(`<div class="dlg"><h2>Premiere · AE · CapCut</h2><div class="muted">Projeto pra continuar em outro programa. Os efeitos vão como marcadores com o nome e o motivo.</div>
      <button type="button" class="opt" data-act="pack-xml" ${st() ? '' : 'disabled'}><b>Premiere Pro e DaVinci Resolve · XML</b><span>Sequência com os cortes de cena e marcadores dos efeitos. Importe e aponte o vídeo original.</span></button>
      <button type="button" class="opt" data-act="pack-edl" ${st() ? '' : 'disabled'}><b>EDL CMX 3600</b><span>Lista de cortes universal (Premiere, Resolve, Avid).</span></button>
      <button type="button" class="opt" data-act="pack-ae" ${st() ? '' : 'disabled'}><b>After Effects</b><span>O AE não abre XML direto: importe o XML no Premiere e envie pro AE pelo Dynamic Link.</span></button>
      <button type="button" class="opt" data-act="pack-capcut" ${st() ? '' : 'disabled'}><b>CapCut</b><span>O CapCut não importa projeto de fora. Exporte o MP4 na Entrega e importe no CapCut.</span></button>
      <div class="row2"><button type="button" class="btn" data-act="dlg-close">Fechar</button></div></div>`);
  },
  'pack-ae'() { $('#dlg').close(); Ent.actions['pack-xml'](); toast('XML salvo. Abra no Premiere e mande pro After Effects (Dynamic Link).', 7000); },
  'pack-capcut'() { $('#dlg').close(); go('entrega'); toast('Escolha os destinos e clique em Exportar. Depois é só importar o MP4 no CapCut.', 7000); }
};
const actions = { ...Mat.actions, ...Ed.actions, ...Cor.actions, ...Ent.actions, ...appActions };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el) {
    if (el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
    const a = el.dataset.act; if (['offset', 'param', 'cslider', 'sfx-vol', 'text', 'credit', 'credit-req', 'idea-name', 'dest-on'].includes(a)) return;
    const fn = actions[a]; if (fn) { e.preventDefault(); fn(el); }
    return;
  }
  if (e.target.id === 'cv-mon') togglePlay();
});
$('#proj').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openProjectFile(f); });
Mat.bindInputs(); Ed.bind(); Cor.bind(); Ent.bind();

video.addEventListener('seeked', () => { app.dirty = true; });
video.addEventListener('loadeddata', () => { app.dirty = true; });
video.addEventListener('play', () => { Ed.renderMonitorBar(); });
video.addEventListener('pause', () => { video.playbackRate = 1; app.ph = P.r1(video.currentTime); Ed.renderMonitorBar(); if (app.tab === 'editar') { Ed.renderDetector(); Ed.renderTimeline(); } else if (app.tab === 'cor') Cor.render(); else Ent.render(); app.dirty = true; });
video.addEventListener('ended', () => { video.pause(); });

// arrastar e soltar
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; $('#drop').hidden = false; } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
window.addEventListener('drop', async (e) => {
  if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $('#drop').hidden = true;
  try { Mat.addEntries(await entriesFromDrop(e.dataTransfer), 'upload'); } catch (err) { say('Não consegui ler o que foi solto: ' + err.message); }
});
window.addEventListener('beforeunload', () => autosave());

// pra testes e depuração
window.__wb = { app, addEntries: Mat.addEntries, openItem: Mat.openItem, go, seek, st, edit };

go('editar');
renderResume();
requestAnimationFrame(tick);
