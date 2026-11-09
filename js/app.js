import { History } from './history.js';
import * as P from './project.js';
import { candidates, selectCuts, SENS_LABELS, DEFAULT_SENS } from './detect.js';
import { sampleVideo } from './sampler.js';
import { Library } from './library.js';
import { KIND_LABEL, ROLES, fmtSize, downloadName, parseDriveLink } from './media.js';
import { probe, convert } from './convert.js';
import { entriesFromFiles, entriesFromDrop, canPickFolder, pickFolder } from './sources.js';
import * as Drive from './drive.js';

const $ = (s) => document.querySelector(s);
const video = $('#video');
const still = $('#still');
const PROJECT_ERR = 'Não consegui abrir o projeto: ';

const app = {
  lib: new Library(),
  activeId: null,
  view: null, // 'video' | 'audio' | 'image' | null
  name: '',
  size: 0,
  url: '',
  duration: 0,
  cands: [],
  hist: null, // History de { scenes, sens }
  ratio: '9:16',
  ph: 0,
  idx: -1,
  busy: false,
  abort: null,
  error: '',
  notice: '',
  pending: null, // projeto aberto, esperando o vídeo
  drive: { token: null, stack: [], list: [], msg: '', link: '', busy: false }
};

// ---------- utilitários ----------
const p2 = (n) => String(n).padStart(2, '0');
const fmtT = (t) => { const tt = Math.round(t * 10); return p2(Math.floor(tt / 600)) + ':' + p2(Math.floor((tt % 600) / 10)) + ',' + (tt % 10); };
const dsec = (a, b) => (Math.round((b - a) * 10) / 10).toFixed(1).replace('.', ',') + ' s';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const state = () => app.hist && app.hist.current;
const kOf = (ratio) => P.RATIOS.indexOf(ratio); // 0,1,2 reenquadram; 3 = original
const N = (i) => 'C' + (i + 1);
const dis = (ok) => (ok ? 'false' : 'true');
const say = (t) => { $('#analysis').textContent = t; $('#analysis').title = t; };

function commit(label, scenes, { sens, key } = {}) {
  const cur = state();
  app.hist.push({ scenes, sens: sens != null ? sens : cur.sens }, label, key || null);
  render();
}

function seek(t) {
  const tt = Math.min(Math.max(0, t), Math.max(0, app.duration - 0.05));
  app.ph = P.r1(tt);
  video.currentTime = tt;
  sync(true);
}

// ---------- material ----------
const TAG = { video: 'VÍD', audio: 'ÁUD', image: 'IMG', other: 'ARQ' };

function statusText(it) {
  switch (it.status) {
    case 'verificando': return 'verificando formato…';
    case 'baixando': return 'baixando do Drive ' + Math.round(it.progress * 100) + '%';
    case 'convertendo': return 'convertendo pra MP4 ' + Math.round(it.progress * 100) + '%';
    case 'pronto': return 'toca direto';
    case 'convertido': return 'convertido pra MP4 (original intacto)';
    case 'erro': return it.note || 'erro';
    default: return '';
  }
}

let rafMat = 0;
const renderMaterialSoon = () => { if (!rafMat) rafMat = requestAnimationFrame(() => { rafMat = 0; renderMaterial(); }); };

function renderMaterial() {
  const el = $('#material');
  const prev = el.querySelector('.m-list');
  const top = prev ? prev.scrollTop : 0;
  const lib = app.lib;
  const g = lib.byRole();
  const c = lib.counts();
  const plural = (n, a, b) => n + ' ' + (n > 1 ? b : a);
  const sum = [c.video && plural(c.video, 'vídeo', 'vídeos'), c.audio && plural(c.audio, 'áudio', 'áudios'), c.image && plural(c.image, 'imagem', 'imagens'), c.other && plural(c.other, 'outro', 'outros')].filter(Boolean).join(' · ');
  const row = (it) => {
    const st = statusText(it);
    const busy = it.status === 'convertendo' || it.status === 'baixando';
    const canOpen = it.kind !== 'other';
    return `<div class="m-row${it.id === app.activeId ? ' on' : ''}">
      <span class="m-tag" title="${KIND_LABEL[it.kind]}">${TAG[it.kind]}</span>
      <div class="m-info"><div class="m-name ell" title="${esc(it.path)}">${esc(it.name)}</div>
        <div class="m-meta${it.status === 'erro' ? ' err' : ''}">${fmtSize(it.size)}${st ? ' · ' + esc(st) : ''}</div>
        ${busy ? `<div class="bar"><i style="width:${Math.round(it.progress * 100)}%"></i></div>` : ''}</div>
      <div class="m-acts">
        ${canOpen ? `<button type="button" class="btn sm" data-act="open" data-id="${it.id}">Abrir</button>` : ''}
        <button type="button" class="btn sm" data-act="download" data-id="${it.id}" title="Baixar o arquivo original">Baixar</button>
        ${it.converted ? `<button type="button" class="btn sm" data-act="download-mp4" data-id="${it.id}" title="Baixar a versão convertida">MP4</button>` : ''}
      </div></div>`;
  };
  const groups = ROLES.filter((r) => g[r].length).map((r) => `<div class="m-role">${r}<span>${g[r].length}</span></div>${g[r].map(row).join('')}`).join('');
  el.innerHTML = `
    <div class="m-head"><h2 class="tool">Material</h2><span class="pill">${lib.items.length} ${lib.items.length === 1 ? 'arquivo' : 'arquivos'}</span></div>
    <div class="m-src">
      <button type="button" class="btn" data-act="add-files">Arquivos</button>
      <button type="button" class="btn" data-act="add-folder">Pasta</button>
      <button type="button" class="btn" data-act="drive-connect">Google Drive</button>
      <button type="button" class="btn" data-act="drive-link">Link do Drive</button>
    </div>
    <div class="m-sum">${sum || 'Nada adicionado ainda. Qualquer tipo de arquivo entra.'}</div>
    <div class="m-list">${groups || '<div class="m-empty">Use os botões acima ou arraste arquivos e pastas pra cá. Pastas com nomes Falas, Cenas e Overlays são separadas sozinhas.</div>'}</div>`;
  const list = el.querySelector('.m-list');
  if (list) list.scrollTop = top;
}

async function getFile(it) {
  if (it.file) return it.file;
  if (it.handle) { it.file = await it.handle.getFile(); return it.file; }
  if (it.driveId) {
    if (!app.drive.token) throw new Error('Conecte o Drive de novo pra baixar este arquivo.');
    it.status = 'baixando';
    it.progress = 0;
    renderMaterialSoon();
    it.file = await Drive.downloadFile(app.drive.token, it.driveId, it.name, '', (p) => { it.progress = p; renderMaterialSoon(); });
    it.status = 'novo';
    return it.file;
  }
  throw new Error('Arquivo indisponível.');
}

// O navegador toca? Se não, o decodificador universal converte pra MP4 H.264 (o original não é tocado).
async function ensurePlayable(it, file) {
  if (it.play) return it.play;
  it.status = 'verificando';
  renderMaterialSoon();
  const r = await probe(file, it.kind);
  if (r.ok) {
    it.play = file;
    it.duration = r.duration || 0;
    it.status = 'pronto';
    renderMaterialSoon();
    return it.play;
  }
  it.status = 'convertendo';
  it.progress = 0;
  say('Esse formato o navegador não toca direto. Convertendo pra MP4…');
  renderMaterialSoon();
  try {
    it.converted = await convert(file, it.kind, (p) => { it.progress = p; renderMaterialSoon(); });
  } catch (e) {
    it.status = 'erro';
    it.note = 'não consegui converter (' + e.message + ')';
    renderMaterialSoon();
    throw new Error(it.note);
  }
  it.play = it.converted;
  it.status = 'convertido';
  renderMaterialSoon();
  return it.play;
}

function setView(v) {
  app.view = v;
  $('#frame').classList.toggle('on', !!v);
  $('#empty').style.display = v ? 'none' : '';
  video.style.display = v === 'video' ? 'block' : 'none';
  still.style.display = v === 'image' ? 'block' : 'none';
  $('#audio-card').style.display = v === 'audio' ? 'flex' : 'none';
}

function resetEditor(keepNotice) {
  if (app.abort) { app.abort.abort(); app.abort = null; }
  video.pause();
  Object.assign(app, { duration: 0, cands: [], hist: null, ph: 0, idx: -1, busy: false, error: '', notice: keepNotice ? app.notice : '' });
}

async function openItem(id) {
  const it = app.lib.get(id);
  if (!it || it.kind === 'other') return;
  app.activeId = id;
  $('#file-name').textContent = it.name;
  renderMaterial();
  try {
    const file = await getFile(it);
    if (app.activeId !== id) return;
    if (it.kind === 'image') {
      resetEditor();
      if (app.url) URL.revokeObjectURL(app.url);
      app.url = URL.createObjectURL(file);
      still.src = app.url;
      app.notice = 'Imagem aberta. O detector de cenas é só pra vídeo.';
      setView('image');
      say('');
      render();
      return;
    }
    const play = await ensurePlayable(it, file);
    if (app.activeId !== id) return;
    if (it.kind === 'audio') {
      resetEditor();
      if (app.url) URL.revokeObjectURL(app.url);
      app.url = URL.createObjectURL(play);
      video.src = app.url;
      $('#audio-name').textContent = it.name;
      app.notice = 'Áudio aberto. O detector de cenas é só pra vídeo.';
      setView('audio');
      say('');
      render();
      return;
    }
    await loadVideo(play, it);
  } catch (e) {
    it.status = it.status === 'erro' ? 'erro' : 'erro';
    it.note = it.note || e.message;
    app.error = 'Não consegui abrir "' + it.name + '": ' + e.message;
    say(app.error);
    render();
  }
}

// ---------- monitor ----------
function renderRatios() {
  $('#ratios').innerHTML = P.RATIOS.map((r) => `<button type="button" data-act="ratio" data-v="${r}" aria-pressed="${r === app.ratio}">${r}</button>`).join('');
}

function applyCrop() {
  const frame = $('#frame');
  const [w, h] = app.ratio.split(':');
  frame.style.aspectRatio = w + ' / ' + h;
  const st = state();
  const k = kOf(app.ratio);
  let x = 50;
  if (st && k >= 0 && k < 3) {
    const s = st.scenes[P.sceneAt(st.scenes, app.ph)];
    // Rosto ainda cai no centro: a detecção de rosto entra numa próxima versão.
    x = s.m[k] === 2 ? s.ox[k] : 50;
  }
  video.style.objectPosition = x + '% 50%';
}

function renderMonitorMeta() {
  const st = state();
  const chip = $('#scene-chip');
  if (!st) { chip.hidden = true; return; }
  const i = P.sceneAt(st.scenes, app.ph);
  const k = kOf(app.ratio);
  chip.hidden = false;
  chip.textContent = N(i) + (k >= 0 && k < 3 ? ' · ' + app.ratio + ' ' + P.MODES[st.scenes[i].m[k]] : ' · original');
}

// ---------- detector ----------
function renderDetector() {
  const el = $('#detector');
  const st = state();
  const h = app.hist;
  if (!st) {
    const msg = app.error || app.notice || (app.busy ? 'Lendo o vídeo e procurando os cortes…' : 'Abra um vídeo pra o Workbench achar os cortes de cena.');
    el.innerHTML = `<div class="d-head"><h2 class="tool">Detector de cenas</h2><span class="pill">${app.busy ? 'analisando' : 'sem vídeo'}</span></div>
      <div class="muted">${esc(msg)}</div>`;
    return;
  }
  const { scenes, sens } = st;
  const i = P.sceneAt(scenes, app.ph);
  const s = scenes[i];
  const ctrls = [
    ['Dividir no playhead', 'split', P.canSplit(scenes, i, app.ph)],
    ['Juntar com a anterior', 'join-prev', P.canJoinPrev(scenes, i)],
    ['Juntar com a próxima', 'join-next', P.canJoinNext(scenes, i)],
    ['Corte −0,5 s', 'cut-', P.canMoveCut(scenes, i, -0.5)],
    ['Corte +0,5 s', 'cut+', P.canMoveCut(scenes, i, 0.5)]
  ];
  const k = kOf(app.ratio);
  const manual = k >= 0 && k < 3 && s.m[k] === 2;
  const frames = [['9:16', 25, 0], ['1:1', 44, 1], ['4:5', 35, 2], ['16:9', 78, -1]].map(([r, w, kk]) => {
    const m = kk >= 0 ? s.m[kk] : -1;
    const x = kk < 0 ? 62 : m === 2 ? s.ox[kk] : 50;
    return `<button type="button" class="fmt" data-act="mode" data-k="${kk}" aria-disabled="${dis(kk >= 0)}" aria-label="${kk < 0 ? '16:9 mantém o quadro original' : 'Enquadramento ' + r + ' de ' + N(i) + ': ' + P.MODES[m] + '. Toque para trocar.'}">
      <span class="box${m === 2 ? ' man' : ''}" style="width:${w}px"><span class="head" style="left:${x}%"></span><span class="body" style="left:${x}%"></span></span>
      <span class="l">${r}</span><span class="md">${kk < 0 ? 'Original' : P.MODES[m]}</span></button>`;
  }).join('');
  el.innerHTML = `
    <div class="d-head">
      <h2 class="tool">Detector de cenas</h2>
      <span class="pill">${scenes.length} cenas</span>
      <div class="sens">
        <span class="muted" style="font-size:11px;font-weight:600">Sensibilidade</span>
        <button type="button" class="btn sm" data-act="sens-" aria-label="Menos sensível" aria-disabled="${dis(sens > 0)}">−</button>
        <span class="lbl">${SENS_LABELS[sens]}</span>
        <button type="button" class="btn sm" data-act="sens+" aria-label="Mais sensível" aria-disabled="${dis(sens < 4)}">+</button>
      </div>
      <div class="status">Última ação: <b>${esc(h.label)}</b> · passo ${h.step} de ${h.total}</div>
      <button type="button" class="btn sm" data-act="undo" aria-disabled="${dis(h.canUndo)}" title="${h.canUndo ? 'Desfazer: ' + esc(h.undoLabel) : 'Nada para desfazer'}">Desfazer</button>
      <button type="button" class="btn sm" data-act="redo" aria-disabled="${dis(h.canRedo)}" title="${h.canRedo ? 'Refazer: ' + esc(h.redoLabel) : 'Nada para refazer'}">Refazer</button>
    </div>
    <div class="ctrls" role="group" aria-label="Ajustes da cena selecionada">
      ${ctrls.map(([l, a, ok]) => `<button type="button" class="btn" data-act="${a}" aria-disabled="${dis(ok)}">${l}</button>`).join('')}
    </div>
    <div class="d-body">
      <div class="cards" aria-label="Cenas">
        ${scenes.map((c, n) => `<button type="button" class="sc" data-act="pick" data-i="${n}" aria-pressed="${n === i}">
          <span class="r1"><b>${N(n)}</b><span class="m">${dsec(c.a, c.b)}</span></span>
          <span class="t">${fmtT(c.a)} → ${fmtT(c.b)}</span>
          <span class="g">9:16 · ${P.MODES[c.m[0]]}</span></button>`).join('')}
      </div>
      <div class="fmts">
        <div class="fmts-title">Formatos de ${N(i)} · toque pra trocar</div>
        <div class="fmts-row">${frames}</div>
        <label class="offset" aria-disabled="${dis(manual)}">Posição (${app.ratio})
          <input type="range" min="0" max="100" value="${manual ? s.ox[k] : 50}" data-act="offset" ${manual ? '' : 'disabled'}></label>
      </div>
    </div>`;
  const sel = el.querySelector('.sc[aria-pressed="true"]');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ---------- timeline ----------
function tickStep(d) {
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (d / s <= 12) return s;
  return 600;
}

function renderTimeline() {
  const el = $('#timeline');
  const st = state();
  if (!st) { el.innerHTML = '<div class="tl-empty">A timeline aparece quando um vídeo for aberto.</div>'; $('#tl-meta').textContent = ''; return; }
  const D = app.duration;
  const pc = (t) => (t / D * 100).toFixed(3) + '%';
  const i = P.sceneAt(st.scenes, app.ph);
  const ticks = [];
  for (let t = 0; t <= D; t += tickStep(D)) ticks.push(`<span class="tick" style="left:${pc(t)}">${Math.floor(t / 60)}:${p2(Math.floor(t % 60))}</span>`);
  const cuts = st.scenes.slice(1).map((s, n) => `<span class="cut${n + 1 === i ? ' sel' : ''}" style="left:${pc(s.a)}"></span>`).join('');
  const blocks = st.scenes.map((s, n) => `<div class="blk${n % 2 ? ' alt' : ''}${n === i ? ' sel' : ''}" style="left:${pc(s.a)};width:${((s.b - s.a) / D * 100).toFixed(3)}%">${N(n)}</div>`).join('');
  el.innerHTML = `
    <div class="row ruler"><div class="name"></div><div class="lane" data-lane>${ticks.join('')}</div></div>
    <div class="row cuts"><div class="name">Cortes de cena</div><div class="lane" data-lane>${cuts}</div></div>
    <div class="row scn"><div class="name">V1 · Cenas</div><div class="lane" data-lane>${blocks}</div></div>
    <div class="playhead" aria-hidden="true"><i id="ph-line"></i><u id="ph-knob"></u></div>`;
  $('#tl-meta').textContent = fmtT(D) + ' · ' + st.scenes.length + ' cenas';
  syncPlayhead();
}

function syncPlayhead() {
  const line = $('#ph-line');
  if (!line || !app.duration) return;
  const left = (app.ph / app.duration * 100).toFixed(3) + '%';
  line.style.left = left;
  $('#ph-knob').style.left = left;
}

// ---------- geral ----------
function renderHeader() {
  const h = app.hist;
  $('#save').setAttribute('aria-disabled', dis(!!h));
  for (const [id, ok, label, what] of [['#undo-top', h && h.canUndo, h && h.undoLabel, 'Desfazer'], ['#redo-top', h && h.canRedo, h && h.redoLabel, 'Refazer']]) {
    const b = $(id);
    b.setAttribute('aria-disabled', dis(ok));
    b.title = ok ? what + ': ' + label : 'Nada para ' + what.toLowerCase();
  }
}

function render() {
  const st = state();
  if (st) app.idx = P.sceneAt(st.scenes, app.ph);
  renderHeader();
  renderDetector();
  renderTimeline();
  renderMonitorMeta();
  applyCrop();
  timecode();
}

function timecode() {
  $('#timecode').innerHTML = fmtT(app.ph) + ' <span class="muted">/ ' + fmtT(app.duration) + '</span>';
}

// chamado quando o playhead mexe; só redesenha o pesado se a cena mudou
function sync(force) {
  const st = state();
  if (!force) app.ph = P.r1(video.currentTime);
  if (!st) { timecode(); return; }
  const i = P.sceneAt(st.scenes, app.ph);
  if (i !== app.idx || force) { render(); return; }
  syncPlayhead();
  timecode();
}

async function loadVideo(play, it) {
  if (app.abort) app.abort.abort();
  if (app.url) URL.revokeObjectURL(app.url);
  const ctl = new AbortController();
  Object.assign(app, { name: it.name, size: it.size, url: URL.createObjectURL(play), duration: 0, cands: [], hist: null, ph: 0, idx: -1, busy: true, abort: ctl, error: '', notice: '' });
  $('#file-name').textContent = it.name;
  setView('video');
  video.src = app.url;
  const pending = app.pending;
  let mismatch = false;
  app.pending = null;
  render();
  try {
    if (pending) {
      await new Promise((r) => { if (video.readyState >= 1) r(); else video.addEventListener('loadedmetadata', r, { once: true }); });
      if (Math.abs(video.duration - pending.video.duration) <= 0.5) {
        app.duration = video.duration;
        app.cands = pending.cands;
        app.ratio = pending.ratio;
        app.hist = new History({ scenes: pending.scenes, sens: pending.sens }, 'Projeto aberto');
        renderRatios();
        say('Projeto aberto: ' + pending.scenes.length + ' cenas');
        return;
      }
      mismatch = true;
    }
    const { duration, series } = await sampleVideo(app.url, {
      signal: ctl.signal,
      onProgress: (p) => say('Analisando ' + Math.round(p * 100) + '%')
    });
    app.duration = duration;
    app.cands = candidates(series);
    const scenes = P.scenesFromCuts(selectCuts(app.cands, DEFAULT_SENS, duration), duration);
    app.hist = new History({ scenes, sens: DEFAULT_SENS }, 'Detecção automática');
    say((mismatch ? 'Duração diferente do projeto, analisei do zero. ' : '') + app.cands.length + ' pontos de corte achados');
  } catch (e) {
    if (e.name === 'AbortError') return;
    app.error = 'Não consegui analisar este vídeo (' + e.message + ').';
    say(app.error);
  } finally {
    if (app.abort === ctl) { app.busy = false; app.abort = null; }
    render();
  }
}

// ---------- entrada de mídia ----------
function addEntries(entries) {
  const ok = entries.filter((e) => e && e.name && !e.name.startsWith('.'));
  if (!ok.length) { say('Nenhum arquivo encontrado.'); return; }
  const before = app.lib.items.length;
  const added = ok.map((e) => app.lib.add(e));
  const fresh = app.lib.items.length - before;
  renderMaterial();
  say(fresh + (fresh === 1 ? ' arquivo adicionado.' : ' arquivos adicionados.'));
  if (!app.activeId) {
    const first = added.find((i) => i.kind === 'video') || added.find((i) => i.kind !== 'other');
    if (first) openItem(first.id);
  }
}

async function addFolder() {
  if (canPickFolder()) {
    try {
      const r = await pickFolder();
      addEntries(r.entries);
    } catch (e) {
      if (e.name !== 'AbortError') say('Não consegui abrir a pasta: ' + e.message);
    }
  } else {
    $('#dir').click(); // Safari/Firefox: seletor de pasta comum
  }
}

async function downloadItem(id, converted) {
  const it = app.lib.get(id);
  if (!it) return;
  try {
    const blob = converted ? it.converted : await getFile(it);
    if (!blob) return;
    const a = $('#dl');
    a.href = URL.createObjectURL(blob);
    a.download = converted ? downloadName(it.name, it.kind === 'audio' ? '_convertido.m4a' : '_convertido.mp4') : downloadName(it.name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) {
    say('Não consegui baixar: ' + e.message);
  }
}

// ---------- Google Drive ----------
const dlg = $('#drive-dlg');
const readVal = (id) => { const e = document.getElementById(id); return e ? e.value : null; };

function renderDrive() {
  const d = app.drive;
  const cid = readVal('g-cid') != null ? readVal('g-cid') : (localStorage.getItem('wb.gClientId') || '');
  const link = readVal('g-link') != null ? readVal('g-link') : d.link;
  const here = d.stack[d.stack.length - 1];
  const crumb = d.stack.map((s) => esc(s.name)).join(' / ');
  const browser = d.token && here ? `
    <div class="crumb">${crumb}</div>
    <div class="list">${d.list.length ? d.list.map((f) => `<div class="li">${f.isFolder
      ? `<button type="button" data-act="drive-cd" data-id="${esc(f.id)}" data-name="${esc(f.name)}">📁 ${esc(f.name)}</button>`
      : `<span class="ell">${esc(f.name)}</span>`}<span class="muted">${f.isFolder ? '' : fmtSize(f.size)}</span></div>`).join('') : '<div class="li muted">Pasta vazia.</div>'}</div>` : '';
  dlg.innerHTML = `<div class="dlg">
    <h2>Google Drive</h2>
    <div class="muted">Acesso só de leitura. Os arquivos só são baixados pro teu navegador quando você abre ou baixa um deles.</div>
    <label for="g-cid">ID do cliente Google (OAuth)</label>
    <input id="g-cid" type="text" value="${esc(cid)}" placeholder="123456-abc.apps.googleusercontent.com" autocomplete="off">
    <label for="g-link">Link da pasta (opcional, vazio mostra o Meu Drive)</label>
    <input id="g-link" type="text" value="${esc(link)}" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off">
    ${browser}
    <div class="note" role="status">${esc(d.busy ? 'Aguarde…' : d.msg)}</div>
    <div class="row2">
      <button type="button" class="btn" data-act="drive-close">Fechar</button>
      ${d.token && here && d.stack.length > 1 ? '<button type="button" class="btn" data-act="drive-up">Voltar</button>' : ''}
      ${d.token && here ? '<button type="button" class="btn solid" data-act="drive-import">Importar esta pasta</button>' : ''}
      <button type="button" class="btn ${d.token && here ? '' : 'solid'}" data-act="drive-go">${d.token ? 'Listar' : 'Conectar'}</button>
    </div></div>`;
}

function openDrive(mode) {
  app.drive.msg = '';
  renderDrive();
  if (!dlg.open) dlg.showModal();
  const f = document.getElementById(mode === 'link' ? 'g-link' : 'g-cid');
  if (f && !f.value) f.focus();
}

async function driveGo() {
  const d = app.drive;
  const cid = (readVal('g-cid') || '').trim();
  d.link = (readVal('g-link') || '').trim();
  if (!cid) {
    d.msg = 'Falta o ID do cliente Google. Crie no Google Cloud (APIs e serviços > Credenciais > ID do cliente OAuth, tipo "App da Web") e coloque este endereço do site como origem autorizada. O passo a passo está no README.';
    renderDrive();
    return;
  }
  localStorage.setItem('wb.gClientId', cid);
  let id = 'root';
  if (d.link) {
    id = parseDriveLink(d.link);
    if (!id) { d.msg = 'Não entendi esse link. Cole o link de uma pasta do Drive.'; renderDrive(); return; }
  }
  d.busy = true; d.msg = ''; renderDrive();
  try {
    if (!d.token) d.token = await Drive.getToken(cid);
    d.stack = [{ id, name: await Drive.folderName(d.token, id) }];
    d.list = await Drive.listChildren(d.token, id);
    d.msg = d.list.length + ' itens nesta pasta.';
  } catch (e) {
    d.token = null; d.stack = []; d.list = [];
    d.msg = e.message;
  }
  d.busy = false;
  renderDrive();
}

async function driveCd(id, name) {
  const d = app.drive;
  d.busy = true; renderDrive();
  try {
    d.list = await Drive.listChildren(d.token, id);
    d.stack.push({ id, name });
    d.msg = d.list.length + ' itens nesta pasta.';
  } catch (e) { d.msg = e.message; }
  d.busy = false;
  renderDrive();
}

async function driveUp() {
  const d = app.drive;
  if (d.stack.length < 2) return;
  d.stack.pop();
  const here = d.stack[d.stack.length - 1];
  d.busy = true; renderDrive();
  try { d.list = await Drive.listChildren(d.token, here.id); d.msg = ''; } catch (e) { d.msg = e.message; }
  d.busy = false;
  renderDrive();
}

async function driveImport() {
  const d = app.drive;
  const here = d.stack[d.stack.length - 1];
  d.busy = true; d.msg = 'Listando tudo dentro da pasta…'; renderDrive();
  try {
    const entries = await Drive.listTree(d.token, here.id, here.name + '/');
    d.busy = false;
    dlg.close();
    addEntries(entries);
  } catch (e) {
    d.busy = false; d.msg = e.message; renderDrive();
  }
}

// ---------- ações ----------
const actions = {
  'add-files'() { $('#file').click(); },
  'add-folder'() { addFolder(); },
  'open-project'() { $('#proj').click(); },
  'drive-connect'() { openDrive('connect'); },
  'drive-link'() { openDrive('link'); },
  'drive-close'() { dlg.close(); },
  'drive-go'() { driveGo(); },
  'drive-cd'(el) { driveCd(el.dataset.id, el.dataset.name); },
  'drive-up'() { driveUp(); },
  'drive-import'() { driveImport(); },
  open(el) { openItem(el.dataset.id); },
  download(el) { downloadItem(el.dataset.id, false); },
  'download-mp4'(el) { downloadItem(el.dataset.id, true); },
  undo() { if (app.hist && app.hist.undo()) render(); },
  redo() { if (app.hist && app.hist.redo()) render(); },
  save() { saveProject(); },
  play() { if (app.view && (video.paused)) video.play(); else video.pause(); },
  'step-back'() { if (app.view) seek(app.ph - 0.1); },
  'step-fwd'() { if (app.view) seek(app.ph + 0.1); },
  ratio(el) { app.ratio = el.dataset.v; renderRatios(); render(); },
  pick(el) { const s = state().scenes[+el.dataset.i]; seek((s.a + s.b) / 2); },
  split() {
    const { scenes } = state(); const i = P.sceneAt(scenes, app.ph);
    if (P.canSplit(scenes, i, app.ph)) commit('Dividir ' + N(i) + ' em ' + fmtT(app.ph), P.split(scenes, i, app.ph));
  },
  'join-prev'() {
    const { scenes } = state(); const i = P.sceneAt(scenes, app.ph);
    if (P.canJoinPrev(scenes, i)) commit('Juntar ' + N(i - 1) + ' e ' + N(i), P.joinPrev(scenes, i));
  },
  'join-next'() {
    const { scenes } = state(); const i = P.sceneAt(scenes, app.ph);
    if (P.canJoinNext(scenes, i)) commit('Juntar ' + N(i) + ' e ' + N(i + 1), P.joinNext(scenes, i));
  },
  'cut-'() { moveCut(-0.5); },
  'cut+'() { moveCut(0.5); },
  mode(el) {
    const k = +el.dataset.k; if (k < 0) return;
    const { scenes } = state(); const i = P.sceneAt(scenes, app.ph);
    const n = P.cycleMode(scenes, i, k);
    commit('Enquadramento ' + P.RATIOS[k] + ' de ' + N(i) + ': ' + P.MODES[n[i].m[k]], n);
  },
  'sens-'() { setSens(-1); },
  'sens+'() { setSens(1); }
};

function moveCut(d) {
  const { scenes } = state(); const i = P.sceneAt(scenes, app.ph);
  if (!P.canMoveCut(scenes, i, d)) return;
  const n = P.moveCut(scenes, i, d);
  if (app.ph < n[i].a) app.ph = P.r1(n[i].a + 0.1);
  video.currentTime = app.ph;
  commit('Mover corte de ' + N(i) + ' ' + (d < 0 ? '−' : '+') + '0,5 s', n);
}

function setSens(d) {
  const st = state(); const ns = Math.min(4, Math.max(0, st.sens + d));
  if (ns === st.sens) return;
  commit('Sensibilidade: ' + SENS_LABELS[ns], P.scenesFromCuts(selectCuts(app.cands, ns, app.duration), app.duration), { sens: ns });
}

function saveProject() {
  const st = state();
  if (!st) return;
  const txt = P.serializeProject({ video: { name: app.name, size: app.size, duration: app.duration }, sens: st.sens, ratio: app.ratio, scenes: st.scenes, cands: app.cands });
  const a = $('#dl');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = 'workbench_' + app.name.replace(/\.[^.]+$/, '') + '_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say('Projeto salvo.');
}

async function openProject(file) {
  const r = P.parseProject(await file.text());
  if (!r.ok) { say(PROJECT_ERR + r.error); return; }
  app.pending = r.project;
  say('Projeto lido. Agora abra o vídeo "' + r.project.video.name + '" no Material.');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el) {
    if (el.getAttribute('aria-disabled') === 'true' || el.dataset.act === 'offset') return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
    return;
  }
  const lane = e.target.closest('[data-lane]');
  if (lane && app.duration) {
    const r = lane.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width * app.duration);
  }
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.act !== 'offset') return;
  const { scenes } = state(); const i = P.sceneAt(scenes, app.ph); const k = kOf(app.ratio);
  if (k < 0 || k > 2) return;
  const n = P.setOffset(scenes, i, k, +e.target.value);
  app.hist.push({ scenes: n, sens: state().sens }, 'Posição ' + app.ratio + ' de ' + N(i), 'ox:' + i + ':' + k);
  renderHeader();
  applyCrop();
  const st = $('#detector .status');
  if (st) st.innerHTML = 'Última ação: <b>' + esc(app.hist.label) + '</b> · passo ' + app.hist.step + ' de ' + app.hist.total;
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.act === 'offset' && app.hist) { app.hist.seal(); render(); }
});

// entradas de arquivo
$('#file').addEventListener('change', (e) => { const l = [...e.target.files]; e.target.value = ''; if (l.length) addEntries(entriesFromFiles(l)); });
$('#dir').addEventListener('change', (e) => { const l = [...e.target.files]; e.target.value = ''; if (l.length) addEntries(entriesFromFiles(l)); });
$('#proj').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openProject(f); });

// arrastar e soltar (arquivos e pastas) em qualquer lugar da tela
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; $('#drop').hidden = false; } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
window.addEventListener('drop', async (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('#drop').hidden = true;
  try { addEntries(await entriesFromDrop(e.dataTransfer)); } catch (err) { say('Não consegui ler o que foi solto: ' + err.message); }
});

video.addEventListener('loadedmetadata', () => { if (app.view === 'audio' && Number.isFinite(video.duration)) { app.duration = video.duration; timecode(); } });
video.addEventListener('timeupdate', () => sync(false));
video.addEventListener('play', () => { $('#play').textContent = '❚❚'; });
video.addEventListener('pause', () => { $('#play').textContent = '▶︎'; });

// pra testes e depuração
window.__wb = { app, addEntries, openItem };

renderRatios();
renderMaterial();
render();
