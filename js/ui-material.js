// Painel Material: entrada de arquivos, pasta, Drive, conversão universal e download.
import { app, $, esc, fmtClock, say, hooks, toast } from './store.js';
import { ROLES, downloadName, parseDriveLink, fmtSize, extOf, isRaw, RAW_BRAND } from './media.js';
import { probe, convert, inspect, audioOk } from './convert.js';
import { rawPreview } from './raw.js';
import { entriesFromFiles, canPickFolder, pickFolder } from './sources.js';
import * as Drive from './drive.js';
import { GOOGLE_API_KEY } from './config.js';
const apiKey = () => GOOGLE_API_KEY || localStorage.getItem('wb.gApiKey') || '';

// ---------- árvore ----------
const ROLE_DOT = { Falas: '#e6e7e9', Cenas: '#7b8088', Overlays: '#d9435e', Outros: '#565c64' };

function statusText(it) {
  switch (it.status) {
    case 'verificando': return 'verificando…';
    case 'baixando': return 'baixando ' + Math.round(it.progress * 100) + '%';
    case 'convertendo': return 'convertendo ' + Math.round(it.progress * 100) + '%';
    case 'pronto': return it.raw || 'pronto';
    case 'convertido': return it.note || 'convertido p/ MP4';
    case 'erro': return it.note || 'erro';
    default: return it.kind === 'other' ? 'arquivo' : '';
  }
}

let raf = 0;
export const renderMaterialSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderMaterial(); }); };

export function renderMaterial() {
  const el = $('#material');
  const prev = el.querySelector('.p-list'); const top = prev ? prev.scrollTop : 0;
  const lib = app.lib; const g = lib.byRole();
  const row = (it) => {
    const parts = [];
    if (it.duration) parts.push(fmtClock(it.duration));
    else if (it.size) parts.push(fmtSize(it.size));
    const st = statusText(it); if (st) parts.push(st);
    if (it.id === app.activeId && app.hist) parts.push(app.hist.current.scenes.length + ' cenas');
    const busy = it.status === 'convertendo' || it.status === 'baixando';
    return `<div class="tree-row file${it.id === app.activeId ? ' on' : ''}" style="padding-left:34px;padding-right:4px" data-act="${it.kind === 'other' ? 'noop' : 'open'}" data-id="${it.id}" ${it.kind === 'other' ? '' : 'draggable="true" '}title="${esc(it.path + (it.info ? '\n' + it.info : ''))}">
      <span class="sq" style="background:${it.kind === 'video' ? '#7b8088' : it.kind === 'audio' ? '#9aa0a8' : it.kind === 'image' ? '#b6bbc2' : '#565c64'}"></span>
      <span class="nm ell">${esc(it.name)}</span><span class="meta${it.status === 'erro' ? ' err' : ''}">${esc(parts.join(' · '))}</span>
      <button type="button" class="dl" data-act="download" data-id="${it.id}" title="Baixar o original" aria-label="Baixar ${esc(it.name)}">⬇</button>
      ${it.converted ? `<button type="button" class="dl" data-act="download-mp4" data-id="${it.id}" title="Baixar o MP4 convertido" aria-label="Baixar MP4 de ${esc(it.name)}">MP4</button>` : ''}</div>${busy ? `<div class="bar-row" style="padding-left:34px"><div class="bar"><i style="width:${Math.round(it.progress * 100)}%"></i></div></div>` : ''}`;
  };
  const tree = lib.items.length
    ? `<div class="tree-row folder" style="padding-left:6px"><span class="sq" style="background:#f0f0f0"></span><span class="nm ell">${esc(app.projectName || 'Projeto')}</span><span class="meta">${lib.items.length}</span></div>`
      + ROLES.filter((r) => g[r].length).map((r) => `<div class="tree-row folder" style="padding-left:20px"><span class="sq" style="background:${ROLE_DOT[r]}"></span><span class="nm">${r}</span><span class="meta">${g[r].length}</span></div>${g[r].map(row).join('')}`).join('')
    : '<div class="note" style="padding:14px 6px;line-height:1.5">Nada aqui ainda. Use os botões acima ou arraste arquivos e pastas pra tela. Pastas chamadas Falas, Cenas e Overlays são separadas sozinhas.</div>';
  el.innerHTML = `
    <div class="p-head"><div class="p-title"><h2 class="tool">Material</h2><span class="pill-tag">${lib.items.length ? (app.source === 'pasta' ? 'Pasta ligada' : 'Upload') : 'Vazio'}</span><button type="button" class="pclose" data-act="panel-close" data-k="mat" title="Fechar painel" aria-label="Fechar painel">–</button></div>
      <div class="p-btns"><button type="button" class="btn" data-act="add-files">Upload</button><button type="button" class="btn" data-act="add-folder">Pasta</button></div></div>
    <div class="p-list">${tree}</div>
    <div class="p-foot">Qualquer tipo de arquivo entra. Arquivo novo na pasta entra quando você adiciona de novo.</div>`;
  const list = el.querySelector('.p-list'); if (list) list.scrollTop = top;
  hooks.renderHeader && hooks.renderHeader();
}

// ---------- abrir um item ----------
async function getFile(it) {
  if (it.file) return it.file;
  if (it.handle) { it.file = await it.handle.getFile(); return it.file; }
  if (it.driveId) {
    const auth = app.drive.token || (apiKey() ? { key: apiKey() } : null);
    if (!auth) throw new Error('Conecte o Drive de novo pra baixar este arquivo.');
    it.status = 'baixando'; it.progress = 0; renderMaterialSoon();
    try { it.file = await Drive.downloadFile(auth, it.driveId, it.name, '', (p) => { it.progress = p; renderMaterialSoon(); }); }
    catch (e) { it.status = 'erro'; throw new Error(e.message === 'NAO_PUBLICO' ? 'o arquivo não está compartilhado com "qualquer pessoa com o link"' : e.message); }
    it.status = 'novo';
    return it.file;
  }
  throw new Error('Arquivo indisponível.');
}

// Containers de câmera que costumam abrir mas com áudio que o navegador não toca (PCM da Lumix, AC-3 do AVCHD...).
const SUSPECT = ['mov', 'mts', 'm2ts', 'm2t', 'mxf', 'avi', 'mkv', 'lrf', 'lrv', 'insv', '360', 'dv', 'vob', 'mpg', 'mpeg', 'wmv', 'flv', '3gp', 'hevc', 'h264', 'h265'];
const describe = (info) => info && info.video ? [info.video.codec.toUpperCase(), info.video.w ? info.video.w + '×' + info.video.h : '', /10le|p010/.test(info.video.pix) ? '10-bit' : '', /422/.test(info.video.pix) ? '4:2:2' : '', info.audio ? 'áudio ' + info.audio.codec.replace(/^pcm_.*/, 'PCM').toUpperCase() : 'sem áudio'].filter(Boolean).join(' · ') : '';

async function ensurePlayable(it, file) {
  if (it.play) return it.play;
  it.status = 'verificando'; renderMaterialSoon();
  const r = await probe(file, it.kind);
  let info = null;
  if (it.kind === 'video' && (!r.ok || SUSPECT.includes(extOf(it.name)) || r.audio === false)) {
    say('Lendo o formato de ' + it.name + '…');
    try { info = await inspect(file); it.info = describe(info); } catch (e) { info = null; }
  }
  const audioFine = !info || !info.audio || audioOk(info.audio) || r.audio === true;
  if (r.ok && audioFine) { it.play = file; it.duration = r.duration || 0; it.status = 'pronto'; renderMaterialSoon(); return it.play; }
  if (r.ok && info) info.forceRemux = true; // o vídeo toca: só troca o áudio, rapidinho
  it.status = 'convertendo'; it.progress = 0;
  say(r.ok ? 'Ajustando o áudio de ' + it.name + ' (o vídeo fica igual)…' : 'O navegador não toca ' + (it.info || 'esse formato') + '. Convertendo pra MP4…'); renderMaterialSoon();
  try { it.converted = await convert(file, it.kind, (p) => { it.progress = p; renderMaterialSoon(); }, info); } catch (e) {
    it.status = 'erro'; it.note = 'não converteu'; renderMaterialSoon(); throw new Error('não consegui converter (' + e.message + ')');
  }
  it.play = it.converted; it.status = 'convertido';
  it.note = it.converted.plan === 'remux' ? 'áudio ajustado, vídeo original' : it.converted.plan === 'audio' ? 'convertido pra AAC' : 'convertido pra MP4 H.264 (até 1080p)';
  renderMaterialSoon();
  return it.play;
}

export async function openItem(id) {
  const it = app.lib.get(id);
  if (!it || it.kind === 'other') return;
  app.activeId = id;
  renderMaterial();
  try {
    const file = await getFile(it);
    if (app.activeId !== id) return;
    if (it.kind === 'image') {
      let img = file;
      if (isRaw(it.name)) {
        it.status = 'verificando'; renderMaterialSoon();
        const p = await rawPreview(file); img = p.blob;
        it.raw = 'RAW ' + (RAW_BRAND[extOf(it.name)] || '') + ' · prévia ' + p.width + '×' + p.height; it.status = 'pronto'; renderMaterialSoon();
      }
      await hooks.loadStill(img, it); return;
    }
    const play = await ensurePlayable(it, file);
    if (app.activeId !== id) return;
    if (it.kind === 'audio') { await hooks.loadAudio(play, it); return; }
    await hooks.loadVideo(play, it, file);
  } catch (e) {
    it.status = 'erro'; it.note = it.note || e.message;
    app.error = 'Não consegui abrir "' + it.name + '": ' + e.message;
    say(app.error); hooks.renderAll();
  }
}

// ---------- entrada de mídia ----------
export function addEntries(entries, origin = 'upload') {
  const ok = entries.filter((e) => e && e.name && !e.name.startsWith('.'));
  if (!ok.length) { say('Nenhum arquivo encontrado.'); return; }
  const before = app.lib.items.length;
  const added = ok.map((e) => app.lib.add(e));
  const fresh = app.lib.items.length - before;
  if (!app.source || origin !== 'upload') app.source = origin;
  if (!app.projectName) {
    const root = (ok[0].path || '').split('/')[0];
    app.projectName = ok[0].path && ok[0].path.includes('/') ? root : ok[0].name.replace(/\.[^.]+$/, '');
  }
  renderMaterial();
  toast(fresh + (fresh === 1 ? ' arquivo adicionado.' : ' arquivos adicionados.') + (app.activeId ? '' : ' Abrindo o primeiro vídeo…'), 4000);
  const want = app.pending && added.find((i) => i.name === app.pending.video.name);
  if (want) { openItem(want.id); return; }
  if (!app.activeId) {
    const first = added.find((i) => i.kind === 'video') || added.find((i) => i.kind !== 'other');
    if (first) openItem(first.id);
  }
}

async function addFolder() {
  if (canPickFolder()) {
    try { const r = await pickFolder(); addEntries(r.entries, 'pasta'); } catch (e) { if (e.name !== 'AbortError') say('Não consegui abrir a pasta: ' + e.message); }
  } else $('#dir').click();
}

async function downloadItem(id, converted) {
  const it = app.lib.get(id); if (!it) return;
  try {
    const blob = converted ? it.converted : await getFile(it); if (!blob) return;
    const a = $('#dl'); a.href = URL.createObjectURL(blob);
    a.download = converted ? downloadName(it.name, it.kind === 'audio' ? '_convertido.m4a' : '_convertido.mp4') : downloadName(it.name);
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { say('Não consegui baixar: ' + e.message); }
}

// ---------- Google Drive ----------
const dlg = $('#drive-dlg');
const readVal = (id) => { const e = document.getElementById(id); return e ? e.value : null; };

function renderDrive() {
  const d = app.drive;
  const cid = readVal('g-cid') != null ? readVal('g-cid') : (localStorage.getItem('wb.gClientId') || '');
  const link = readVal('g-link') != null ? readVal('g-link') : d.link;
  const here = d.stack[d.stack.length - 1];
  const browser = d.token && here ? `<div class="crumb">${d.stack.map((s) => esc(s.name)).join(' / ')}</div>
    <div class="list">${d.list.length ? d.list.map((f) => `<div class="li">${f.isFolder ? `<button type="button" data-act="drive-cd" data-id="${esc(f.id)}" data-name="${esc(f.name)}">📁 ${esc(f.name)}</button>` : `<span class="ell">${esc(f.name)}</span>`}<span class="muted">${f.isFolder ? '' : fmtSize(f.size)}</span></div>`).join('') : '<div class="li muted">Pasta vazia.</div>'}</div>` : '';
  dlg.innerHTML = `<div class="dlg"><h2>Google Drive</h2>
    <div class="muted">Acesso só de leitura. Os arquivos só são baixados pro teu navegador quando você abre ou baixa um deles.</div>
    <label for="g-cid">ID do cliente Google (OAuth)</label><input id="g-cid" type="text" value="${esc(cid)}" placeholder="123456-abc.apps.googleusercontent.com" autocomplete="off">
    <label for="g-link">Link da pasta (opcional, vazio mostra o Meu Drive)</label><input id="g-link" type="text" value="${esc(link)}" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off">
    ${browser}<div class="note" role="status">${esc(d.busy ? 'Aguarde…' : d.msg)}</div>
    <div class="row2"><button type="button" class="btn" data-act="drive-close">Fechar</button>
      ${d.token && here && d.stack.length > 1 ? '<button type="button" class="btn" data-act="drive-up">Voltar</button>' : ''}
      ${d.token && here ? '<button type="button" class="btn solid" data-act="drive-import">Importar esta pasta</button>' : ''}
      <button type="button" class="btn ${d.token && here ? '' : 'solid'}" data-act="drive-go">${d.token ? 'Listar' : 'Conectar'}</button></div></div>`;
}
// ---------- só o link ----------
const lk = { msg: '', busy: false, link: '', private: false };
function renderLink() {
  const key = apiKey(); const link = readVal('l-link') != null ? readVal('l-link') : lk.link;
  dlg.innerHTML = `<div class="dlg"><h2>Colar link do Drive</h2>
    <div class="muted" style="line-height:1.5">Cole o link de uma pasta ou de um arquivo. Se estiver compartilhado como <b>Qualquer pessoa com o link</b>, o Workbench importa direto, sem login. Falas, Cenas e Overlays são separados sozinhos.</div>
    <input id="l-link" type="text" value="${esc(link)}" placeholder="https://drive.google.com/drive/folders/..." autocomplete="off">
    <div class="note" role="status">${lk.busy ? 'Lendo a pasta no Drive…' : esc(lk.msg)}</div>
    ${lk.private ? `<div class="box"><div class="r"><b>Essa pasta é privada</b></div><div class="note" style="margin-top:4px;line-height:1.5">No Drive: <b>Compartilhar › Acesso geral › Qualquer pessoa com o link</b> e cole de novo. Ou entre com a tua conta Google pra abrir pasta privada.</div></div>` : ''}
    ${key ? '' : `<div class="box"><div class="r"><b>Falta uma configuração, feita uma vez só</b></div>
      <div class="note" style="margin-top:4px;line-height:1.5">O site precisa de uma chave de API do Google pra ler pastas públicas: no <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud</a>, ative a <b>Google Drive API</b>, crie em <b>Credenciais › Chave de API</b> e restrinja a <b>niggsdan.github.io</b> e à Drive API. Ela não dá acesso à tua conta.</div>
      <input id="l-key" type="text" placeholder="AIza..." autocomplete="off" style="margin-top:6px"></div>`}
    <div class="row2"><button type="button" class="btn" data-act="drive-close">Fechar</button><button type="button" class="btn" data-act="drive-connect">Entrar com a conta Google</button><button type="button" class="btn solid" data-act="link-go" ${lk.busy ? 'aria-disabled="true"' : ''}>Importar</button></div></div>`;
}
function openLink() { lk.msg = ''; lk.private = false; renderLink(); if (!dlg.open) dlg.showModal(); const f = document.getElementById('l-link'); if (f) f.focus(); }
async function linkGo() {
  lk.link = (readVal('l-link') || '').trim(); const k = (readVal('l-key') || '').trim();
  if (k) localStorage.setItem('wb.gApiKey', k);
  const id = parseDriveLink(lk.link);
  if (!id) { lk.msg = 'Não entendi esse link. Cole o link de uma pasta ou arquivo do Drive.'; renderLink(); return; }
  if (!apiKey()) { lk.msg = 'Cole a chave do Google acima (é uma vez só).'; renderLink(); return; }
  lk.busy = true; lk.msg = ''; lk.private = false; renderLink();
  const auth = { key: apiKey() };
  try {
    const m = await Drive.meta(auth, id);
    const entries = m.isFolder ? await Drive.listTree(auth, id, m.name + '/') : [{ name: m.name, path: m.name, size: m.size, mime: m.mime, driveId: m.id }];
    lk.busy = false;
    if (!entries.length) { lk.msg = 'A pasta está vazia (ou só tem documentos do Google, que não são mídia).'; renderLink(); return; }
    dlg.close(); if (m.isFolder && !app.projectName) app.projectName = m.name;
    addEntries(entries, 'drive');
  } catch (e) {
    lk.busy = false;
    if (e.message === 'NAO_PUBLICO') { lk.private = true; app.drive.link = lk.link; }
    else { lk.msg = e.message; if (/chave/i.test(e.message)) localStorage.removeItem('wb.gApiKey'); }
    renderLink();
  }
}

function openDrive(mode) {
  app.drive.msg = ''; renderDrive(); if (!dlg.open) dlg.showModal();
  const f = document.getElementById(mode === 'link' ? 'g-link' : 'g-cid'); if (f && !f.value) f.focus();
}
async function driveGo() {
  const d = app.drive; const cid = (readVal('g-cid') || '').trim(); d.link = (readVal('g-link') || '').trim();
  if (!cid) { d.msg = 'Falta o ID do cliente Google. Crie no Google Cloud (APIs e serviços > Credenciais > ID do cliente OAuth, tipo "App da Web") e autorize este endereço do site. O passo a passo está no README.'; renderDrive(); return; }
  localStorage.setItem('wb.gClientId', cid);
  let id = 'root';
  if (d.link) { id = parseDriveLink(d.link); if (!id) { d.msg = 'Não entendi esse link. Cole o link de uma pasta do Drive.'; renderDrive(); return; } }
  d.busy = true; d.msg = ''; renderDrive();
  try {
    if (!d.token) d.token = await Drive.getToken(cid);
    d.stack = [{ id, name: await Drive.folderName(d.token, id) }];
    d.list = await Drive.listChildren(d.token, id); d.msg = d.list.length + ' itens nesta pasta.';
  } catch (e) { d.token = null; d.stack = []; d.list = []; d.msg = e.message; }
  d.busy = false; renderDrive();
}
async function driveCd(id, name) {
  const d = app.drive; d.busy = true; renderDrive();
  try { d.list = await Drive.listChildren(d.token, id); d.stack.push({ id, name }); d.msg = d.list.length + ' itens nesta pasta.'; } catch (e) { d.msg = e.message; }
  d.busy = false; renderDrive();
}
async function driveUp() {
  const d = app.drive; if (d.stack.length < 2) return; d.stack.pop(); const here = d.stack[d.stack.length - 1]; d.busy = true; renderDrive();
  try { d.list = await Drive.listChildren(d.token, here.id); d.msg = ''; } catch (e) { d.msg = e.message; }
  d.busy = false; renderDrive();
}
async function driveImport() {
  const d = app.drive; const here = d.stack[d.stack.length - 1]; d.busy = true; d.msg = 'Listando tudo dentro da pasta…'; renderDrive();
  try { const entries = await Drive.listTree(d.token, here.id, here.name + '/'); d.busy = false; dlg.close(); addEntries(entries, 'drive'); } catch (e) { d.busy = false; d.msg = e.message; renderDrive(); }
}

export const actions = {
  noop() {},
  'add-files'() { $('#file').click(); },
  'add-folder'() { addFolder(); },
  'drive-connect'() { openDrive(app.drive.link ? 'link' : 'connect'); },
  'drive-link'() { openLink(); },
  'link-go'() { linkGo(); },
  'drive-close'() { dlg.close(); },
  'drive-go'() { driveGo(); },
  'drive-cd'(el) { driveCd(el.dataset.id, el.dataset.name); },
  'drive-up'() { driveUp(); },
  'drive-import'() { driveImport(); },
  open(el) { openItem(el.dataset.id); },
  download(el) { downloadItem(el.dataset.id, false); },
  'download-mp4'(el) { downloadItem(el.dataset.id, true); }
};

export function bindInputs() {
  dlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.id === 'l-link' || e.target.id === 'l-key')) { e.preventDefault(); linkGo(); } });
  $('#file').addEventListener('change', (e) => { const l = [...e.target.files]; e.target.value = ''; if (l.length) addEntries(entriesFromFiles(l), 'upload'); });
  $('#dir').addEventListener('change', (e) => { const l = [...e.target.files]; e.target.value = ''; if (l.length) addEntries(entriesFromFiles(l), 'pasta'); });
}

// Garante um Blob tocável de um item (baixa do Drive e converte se precisar).
export const fileOf = (it) => getFile(it);
export async function prepareItem(it) { const f = await getFile(it); return ensurePlayable(it, f); }
