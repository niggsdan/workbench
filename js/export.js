// Entrega: render de verdade (mesmo compositor da prévia) + arquivos pra outros programas.
import { Compositor, outSize } from './render.js';
import { fxState } from './fx.js';
import * as M from './model.js';
import * as P from './project.js';
import { playSound } from './sound.js';
import { ffmpegExec } from './convert.js';
import { SOUNDS } from './fx.js';

const once = (el, ev) => new Promise((r) => el.addEventListener(ev, r, { once: true }));

export function recorderMime() {
  const opts = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

// job: { url, piece:{a,b}, ratio, long, bitrate, container, state:{scenes, edit}, comps(t) -> [], crop(t) -> ox, overlays, onProgress, signal }
export async function renderPiece(job) {
  const { piece, ratio, state } = job;
  const { w: W, h: H } = outSize(ratio, job.long);
  const v = document.createElement('video'); v.src = job.url; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  await once(v, 'loadedmetadata');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const comp = new Compositor();
  const ac = new AudioContext(); await ac.resume().catch(() => {});
  const dest = ac.createMediaStreamDestination();
  const srcNode = ac.createMediaElementSource(v);
  const vg = ac.createGain(); srcNode.connect(vg); vg.connect(dest);
  const stream = cv.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = recorderMime(); if (!mime) throw new Error('Este navegador não grava vídeo (MediaRecorder). Use o Chrome ou o Edge.');
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: job.bitrate || 10e6, audioBitsPerSecond: 160000 });
  const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });

  v.currentTime = piece.a; await once(v, 'seeked');
  const fx = state.edit.fx;
  const draw = () => {
    const t = v.currentTime;
    comp.render(cv, { src: v, sw: v.videoWidth, sh: v.videoHeight, t, ratio, ox: job.crop(t), fx, fxOn: true, comps: job.comps(t), overlays: job.overlays, W, H });
  };
  draw();
  rec.start(250);
  let last = piece.a; let done = false;
  const events = fx.filter((f) => f.sfx).map((f) => ({ t: f.kind === 'sx' ? f.a : f.a + f.sfx.off, key: f.sfx.key, vol: f.sfx.vol, len: f.b - f.a }));
  const finish = () => { if (done) return; done = true; v.pause(); try { rec.stop(); } catch (e) { /* já parou */ } };
  if (job.signal) job.signal.addEventListener('abort', finish, { once: true });
  const step = () => {
    if (done) return;
    const t = v.currentTime;
    const f = fxState(fx, t);
    if (f.skipTo !== null && f.skipTo > t + 0.05) { v.currentTime = Math.min(piece.b, f.skipTo); }
    const rate = Math.max(0.25, Math.min(4, f.rate)); if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate;
    vg.gain.value = f.rate > 1.05 ? 0.4 : 1;
    for (const ev of events) if (ev.t > last && ev.t <= t + 0.03) playSound(ac, dest, ev.key, ac.currentTime, ev.vol, ev.len);
    last = t;
    draw();
    if (job.onProgress) job.onProgress(Math.min(1, (t - piece.a) / Math.max(0.01, piece.b - piece.a)));
    if (t >= piece.b - 0.02 || v.ended) { finish(); return; }
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
  };
  // sons que começam antes do primeiro quadro
  for (const ev of events) if (ev.t <= piece.a + 0.03 && ev.t > piece.a - 1.5) playSound(ac, dest, ev.key, ac.currentTime, ev.vol, ev.len);
  await v.play();
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
  v.addEventListener('ended', finish, { once: true });
  await stopped;
  ac.close().catch(() => {});
  if (job.signal && job.signal.aborted) throw new DOMException('Render cancelado', 'AbortError');
  const raw = new Blob(chunks, { type: mime.split(';')[0] });
  return { raw, mime, W, H };
}

// Converte o que o navegador gravou pro container pedido.
export async function finalize(raw, mime, container, onProgress) {
  // só aproveita direto o que já veio em H.264 + AAC; o resto o ffmpeg converte pra H.264
  const isMp4 = mime.startsWith('video/mp4') && mime.includes('avc1');
  if (container === 'mp4' && isMp4) return raw;
  const inName = isMp4 ? 'gravado.mp4' : 'gravado.webm';
  const out = container === 'mov' ? 'saida.mov' : 'saida.mp4';
  const type = container === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (isMp4) return ffmpegExec(raw, inName, (i, o) => ['-i', i, '-c', 'copy', '-movflags', '+faststart', o], out, type, onProgress);
  return ffmpegExec(raw, inName, (i, o) => ['-i', i, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', o], out, type, onProgress);
}

// ---------- arquivos pra outros programas ----------
const FPS = 30;
const tc = (t) => { const f = Math.round(t * FPS); const p = (n) => String(n).padStart(2, '0'); return p(Math.floor(f / (3600 * FPS))) + ':' + p(Math.floor(f / (60 * FPS)) % 60) + ':' + p(Math.floor(f / FPS) % 60) + ':' + p(f % FPS); };

export function edl(title, fileName, scenes, fx) {
  const lines = ['TITLE: ' + title, 'FCM: NON-DROP FRAME', ''];
  scenes.forEach((s, i) => {
    lines.push(String(i + 1).padStart(3, '0') + '  AX       V     C        ' + tc(s.a) + ' ' + tc(s.b) + ' ' + tc(s.a) + ' ' + tc(s.b));
    lines.push('* FROM CLIP NAME: ' + fileName);
    fx.filter((f) => f.a >= s.a && f.a < s.b).forEach((f) => lines.push('* WORKBENCH ' + (f.kind === 'tec' ? 'FX' : f.kind === 'tx' ? 'TEXTURA' : f.kind.toUpperCase()) + ': ' + f.name + ' ' + tc(f.a) + ' -> ' + tc(f.b)));
    lines.push('');
  });
  return lines.join('\r\n');
}

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function xmeml(title, fileName, duration, scenes, fx, w = 1920, h = 1080) {
  const fr = (t) => Math.round(t * FPS); const dur = fr(duration);
  const rate = '<rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>';
  const file = (first) => first ? `<file id="file-1"><name>${x(fileName)}</name><pathurl>file://localhost/${encodeURIComponent(fileName)}</pathurl>${rate}<duration>${dur}</duration><media><video><samplecharacteristics><width>${w}</width><height>${h}</height></samplecharacteristics></video><audio><channelcount>2</channelcount></audio></media></file>` : '<file id="file-1"/>';
  const clips = (kind) => scenes.map((s, i) => `<clipitem id="${kind}-${i + 1}"><name>${x(fileName)} C${i + 1}</name><duration>${dur}</duration>${rate}<start>${fr(s.a)}</start><end>${fr(s.b)}</end><in>${fr(s.a)}</in><out>${fr(s.b)}</out>${file(i === 0 && kind === 'v')}</clipitem>`).join('');
  const markers = fx.map((f) => `<marker><name>${x((f.kind === 'tec' ? 'FX ' : f.kind === 'tx' ? 'Textura ' : '') + f.name)}</name><comment>${x(f.why || '')}</comment><in>${fr(f.a)}</in><out>${fr(f.b)}</out></marker>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4"><sequence id="seq-1"><name>${x(title)}</name><duration>${dur}</duration>${rate}${markers}<media><video><format><samplecharacteristics>${rate}<width>${w}</width><height>${h}</height></samplecharacteristics></format><track>${clips('v')}</track></video><audio><track>${clips('a')}</track></audio></media></sequence></xmeml>\n`;
}

export function credits(edit, lib) {
  const ov = edit.fx.filter((f) => f.kind === 'ov');
  const lines = ['Créditos do projeto (gerado pelo Workbench)', ''];
  if (!ov.length) lines.push('Nenhum overlay de terceiros usado.');
  ov.forEach((f) => lines.push('- ' + (f.file || 'overlay') + (f.credit.creator ? ' · criador: ' + f.credit.creator : ' · criador: (preencher)') + (f.credit.required ? ' · atribuição obrigatória' : '')));
  lines.push('', 'Efeitos, texturas e sons foram gerados no próprio Workbench (sem arquivo de terceiros).');
  const refs = edit.cinema.filter((c) => c.state === 'use');
  if (refs.length) lines.push('Referências de estilo (só referência, nenhuma imagem usada): ' + refs.map((c) => c.name).join(', ') + '.');
  return lines.join('\n') + '\n';
}

export const piecesFor = (state, duration, platform, mode) => M.pieces(state.edit, state.scenes, duration, platform, mode === 'cena');
export { P, SOUNDS };
