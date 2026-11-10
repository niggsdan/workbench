// Decodificador universal: se o navegador não toca o arquivo (ProRes, HEVC sem suporte, AVI, MXF, WMV...),
// o ffmpeg (rodando dentro do navegador, sem enviar nada) converte pra MP4 H.264 leve, que toca em qualquer lugar.
// O original continua intacto. A conversão serve pra prévia, detecção de cenas e edição.

import { extOf } from './media.js';

const CORE = new URL('../vendor/ffmpeg/', import.meta.url).href;
let ffmpeg = null;
let loading = null;
let chain = Promise.resolve(); // uma conversão por vez

function once(el, ev, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { el.removeEventListener(ev, ok); reject(new Error('tempo esgotado: ' + ev)); }, ms);
    const ok = () => { clearTimeout(t); resolve(); };
    el.addEventListener(ev, ok, { once: true });
  });
}

// O navegador toca e decodifica de verdade? Busca um quadro pra conferir (HEVC às vezes abre mas não decodifica).
export async function probe(blob, kind) {
  const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
  el.muted = true;
  el.preload = 'auto';
  const url = URL.createObjectURL(blob);
  try {
    el.src = url;
    const failed = new Promise((_, rej) => el.addEventListener('error', () => rej(new Error('formato não suportado')), { once: true }));
    await Promise.race([once(el, 'loadedmetadata', 10000), failed]);
    const duration = el.duration;
    if (kind === 'video') {
      if (!el.videoWidth) return { ok: false, reason: 'sem imagem decodificável' };
      el.currentTime = Math.min(0.1, (duration || 0.2) / 2);
      await Promise.race([once(el, 'seeked', 8000), failed]);
      if (el.readyState < 2) return { ok: false, reason: 'não decodifica quadros' };
      let audio = null;
      try { if (el.captureStream) audio = el.captureStream().getAudioTracks().length > 0; } catch (e) { audio = null; }
      return { ok: true, duration, width: el.videoWidth, height: el.videoHeight, audio };
    }
    return { ok: Number.isFinite(duration), duration };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}

async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;
  if (!loading) {
    loading = (async () => {
      const { FFmpeg } = await import('../vendor/ffmpeg/index.js');
      const f = new FFmpeg();
      await f.load({ coreURL: CORE + 'ffmpeg-core.js', wasmURL: CORE + 'ffmpeg-core.wasm' });
      ffmpeg = f;
      return f;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

// ---------- leitura do que tem dentro do arquivo ----------
// Lê só o cabeçalho com o ffmpeg e devolve { video:{codec,profile,pix,w,h,fps}, audio:{codec}, streams } ou null.
export function parseInfo(log) {
  const out = { video: null, audio: null, streams: 0 };
  for (const l of log.split('\n')) {
    const m = /Stream #\d+:\d+.*?: (Video|Audio|Data): (.*)$/.exec(l); if (!m) continue;
    out.streams++;
    if (m[1] === 'Video' && !out.video && !/attached pic|mjpeg/.test(m[2])) {
      const codec = (/^(\w+)/.exec(m[2]) || [])[1]; const prof = (/^\w+ \(([^)]+)\)/.exec(m[2]) || [])[1] || '';
      const pix = (/, (yuv\w+|yuvj\w+|nv12|p010\w*|gray\w*|rgb\w*|bgr\w*)/.exec(m[2]) || [])[1] || '';
      const wh = /, (\d{2,5})x(\d{2,5})/.exec(m[2]); const fps = /([\d.]+) fps/.exec(m[2]);
      out.video = { codec, profile: prof, pix, w: wh ? +wh[1] : 0, h: wh ? +wh[2] : 0, fps: fps ? +fps[1] : 0 };
    } else if (m[1] === 'Audio' && !out.audio) out.audio = { codec: (/^(\w+)/.exec(m[2]) || [])[1] };
  }
  return out;
}
// O navegador toca esse vídeo sem converter? (H.264 8-bit 4:2:0; VP9/AV1; HEVC se o computador decodifica)
export function videoOk(v, hevc = false) {
  if (!v) return false;
  const p420 = /^(yuvj?420p|nv12)$/.test(v.pix);
  if (v.codec === 'h264') return p420 && !/High 10|High 4:2:2|High 4:4:4/i.test(v.profile);
  if (v.codec === 'vp9' || v.codec === 'av1' || v.codec === 'vp8') return /^yuv420p(10le)?$/.test(v.pix);
  if (v.codec === 'hevc') return hevc && /^yuv420p(10le)?$/.test(v.pix);
  return false;
}
export const audioOk = (a) => !a || ['aac', 'mp3', 'opus'].includes(a.codec);
// Plano: 'remux' (vídeo copiado, só troca o pacote e o áudio) ou 'transcode' (recodifica o vídeo).
export function planFor(info, hevc) { return videoOk(info.video, hevc) ? 'remux' : 'transcode'; }

async function hevcSupported() {
  try {
    if (!navigator.mediaCapabilities) return false;
    const r = await navigator.mediaCapabilities.decodingInfo({ type: 'file', video: { contentType: 'video/mp4; codecs="hvc1.2.4.L153.B0"', width: 3840, height: 2160, bitrate: 8e7, framerate: 30 } });
    return !!r.supported;
  } catch (e) { return false; }
}

export async function inspect(file) {
  const job = chain.then(async () => {
    const f = await getFFmpeg(); const dir = '/i' + Date.now().toString(36); const name = 'entrada.' + (extOf(file.name) || 'bin');
    const logs = []; const onLog = ({ message }) => logs.push(message); f.on('log', onLog);
    try { await f.createDir(dir).catch(() => {}); await f.mount('WORKERFS', { files: [new File([file], name)] }, dir); await f.exec(['-hide_banner', '-i', dir + '/' + name]); }
    finally { f.off('log', onLog); await f.unmount(dir).catch(() => {}); await f.deleteDir(dir).catch(() => {}); }
    return parseInfo(logs.join('\n'));
  });
  chain = job.catch(() => {});
  return job;
}

// kind: 'video' | 'audio'. onProgress recebe 0..1. Devolve o Blob e o que foi feito (plan).
export function convert(file, kind, onProgress, info = null) {
  const job = chain.then(() => run(file, kind, onProgress, info));
  chain = job.catch(() => {});
  return job;
}

async function run(file, kind, onProgress, info) {
  const f = await getFFmpeg();
  const ext = extOf(file.name) || 'bin';
  const inName = 'entrada.' + ext;
  const out = kind === 'audio' ? 'saida.m4a' : 'saida.mp4';
  const dir = '/entrada';
  const logs = [];
  const onLog = ({ message }) => { logs.push(message); if (logs.length > 8) logs.shift(); };
  const onProg = ({ progress }) => { if (onProgress && progress >= 0 && progress <= 1) onProgress(progress); };
  f.on('log', onLog);
  f.on('progress', onProg);
  const hevc = await hevcSupported();
  const plan = kind === 'audio' ? 'audio' : info ? (info.forceRemux ? 'remux' : planFor(info, hevc)) : 'transcode';
  try {
    await f.createDir(dir).catch(() => {});
    // WORKERFS lê o arquivo sob demanda, sem copiar tudo pra memória
    await f.mount('WORKERFS', { files: [new File([file], inName)] }, dir);
    const src = dir + '/' + inName;
    const aud = info && audioOk(info.audio) ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2'];
    const args = plan === 'audio' ? ['-i', src, '-vn', '-c:a', 'aac', '-b:a', '192k', out]
      : plan === 'remux' ? ['-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-dn', '-c:v', 'copy', ...(info.video && info.video.codec === 'hevc' ? ['-tag:v', 'hvc1'] : []), ...aud, '-movflags', '+faststart', out]
      : ['-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-dn', '-vf', "scale=-2:'min(1080,ih)',format=yuv420p", '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-movflags', '+faststart', out];
    const code = await f.exec(args);
    if (code !== 0) throw new Error('o conversor falhou: ' + logs.slice(-3).join(' | '));
    const data = await f.readFile(out);
    await f.deleteFile(out).catch(() => {});
    if (onProgress) onProgress(1);
    const blob = new Blob([data.buffer], { type: kind === 'audio' ? 'audio/mp4' : 'video/mp4' });
    blob.plan = plan;
    return blob;
  } finally {
    f.off('log', onLog);
    f.off('progress', onProg);
    await f.unmount(dir).catch(() => {});
    await f.deleteDir(dir).catch(() => {});
  }
}

// Roda o ffmpeg num arquivo qualquer. args(dentro, saida) devolve a lista de argumentos.
export function ffmpegExec(blob, inName, args, outName, mime, onProgress) {
  const job = chain.then(async () => {
    const f = await getFFmpeg();
    const dir = '/x' + Date.now().toString(36);
    const logs = [];
    const onLog = ({ message }) => { logs.push(message); if (logs.length > 8) logs.shift(); };
    const onProg = ({ progress }) => { if (onProgress && progress >= 0 && progress <= 1) onProgress(progress); };
    f.on('log', onLog); f.on('progress', onProg);
    try {
      await f.createDir(dir).catch(() => {});
      await f.mount('WORKERFS', { files: [new File([blob], inName)] }, dir);
      const code = await f.exec(args(dir + '/' + inName, outName));
      if (code !== 0) throw new Error('o ffmpeg falhou: ' + logs.slice(-3).join(' | '));
      const data = await f.readFile(outName);
      await f.deleteFile(outName).catch(() => {});
      return new Blob([data.buffer], { type: mime });
    } finally {
      f.off('log', onLog); f.off('progress', onProg);
      await f.unmount(dir).catch(() => {}); await f.deleteDir(dir).catch(() => {});
    }
  });
  chain = job.catch(() => {});
  return job;
}
