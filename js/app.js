import { History } from './history.js';
import * as P from './project.js';
import { candidates, selectCuts, SENS_LABELS, DEFAULT_SENS } from './detect.js';
import { sampleVideo } from './sampler.js';

const $ = (s) => document.querySelector(s);
const video = $('#video');

const app = {
  name: '',
  url: '',
  duration: 0,
  cands: [],
  hist: null, // History de { scenes, sens }
  ratio: '9:16',
  ph: 0,
  idx: -1,
  busy: false,
  abort: null,
  error: ''
};

// ---------- utilitários ----------
const p2 = (n) => String(n).padStart(2, '0');
const fmtT = (t) => { const tt = Math.round(t * 10); return p2(Math.floor(tt / 600)) + ':' + p2(Math.floor((tt % 600) / 10)) + ',' + (tt % 10); };
const dsec = (a, b) => (Math.round((b - a) * 10) / 10).toFixed(1).replace('.', ',') + ' s';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const state = () => app.hist && app.hist.current;
const kOf = (ratio) => P.RATIOS.indexOf(ratio); // 0,1,2 reenquadram; 3 = original
const N = (i) => 'C' + (i + 1);
const dis = (ok) => (ok ? 'false' : 'true');

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
    el.innerHTML = `<div class="d-head"><h2>Detector de cenas</h2><span class="pill">${app.busy ? 'analisando' : 'sem vídeo'}</span></div>
      <div class="muted">${esc(app.error) || (app.busy ? 'Lendo o vídeo e procurando os cortes…' : 'Abra um vídeo pra o Workbench achar os cortes de cena.')}</div>`;
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
      <h2>Detector de cenas</h2>
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
  if (!st) { el.innerHTML = '<div class="tl-empty">A timeline aparece quando o vídeo for aberto.</div>'; $('#tl-meta').textContent = ''; return; }
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
  if (!st) return;
  if (!force) app.ph = P.r1(video.currentTime);
  const i = P.sceneAt(st.scenes, app.ph);
  if (i !== app.idx || force) { render(); return; }
  syncPlayhead();
  timecode();
}

async function load(file) {
  if (app.abort) app.abort.abort();
  if (app.url) URL.revokeObjectURL(app.url);
  const ctl = new AbortController();
  Object.assign(app, { name: file.name, url: URL.createObjectURL(file), duration: 0, cands: [], hist: null, ph: 0, idx: -1, busy: true, abort: ctl, error: '' });
  $('#file-name').textContent = file.name;
  $('#empty').style.display = 'none';
  $('#frame').classList.add('on');
  video.src = app.url;
  render();
  try {
    const { duration, series } = await sampleVideo(app.url, {
      signal: ctl.signal,
      onProgress: (p) => { $('#analysis').textContent = 'Analisando ' + Math.round(p * 100) + '%'; }
    });
    app.duration = duration;
    app.cands = candidates(series);
    const scenes = P.scenesFromCuts(selectCuts(app.cands, DEFAULT_SENS, duration), duration);
    app.hist = new History({ scenes, sens: DEFAULT_SENS }, 'Detecção automática');
    $('#analysis').textContent = app.cands.length + ' pontos de corte achados';
  } catch (e) {
    if (e.name === 'AbortError') return;
    app.error = 'Não consegui analisar este vídeo (' + e.message + '). Tenta um MP4 H.264.';
    $('#analysis').textContent = '';
  } finally {
    if (app.abort === ctl) { app.busy = false; app.abort = null; }
  }
  render();
}

// ---------- ações ----------
const actions = {
  undo() { if (app.hist && app.hist.undo()) render(); },
  redo() { if (app.hist && app.hist.redo()) render(); },
  play() { if (video.paused) video.play(); else video.pause(); },
  'step-back'() { seek(app.ph - 0.1); },
  'step-fwd'() { seek(app.ph + 0.1); },
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

$('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) load(f); e.target.value = ''; });
video.addEventListener('timeupdate', () => sync(false));
video.addEventListener('play', () => { $('#play').textContent = '❚❚'; });
video.addEventListener('pause', () => { $('#play').textContent = '▶︎'; });

renderRatios();
render();
