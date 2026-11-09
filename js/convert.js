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
      return { ok: true, duration, width: el.videoWidth, height: el.videoHeight };
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

// kind: 'video' | 'audio'. onProgress recebe 0..1.
export function convert(file, kind, onProgress) {
  const job = chain.then(() => run(file, kind, onProgress));
  chain = job.catch(() => {});
  return job;
}

async function run(file, kind, onProgress) {
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
  try {
    await f.createDir(dir).catch(() => {});
    // WORKERFS lê o arquivo sob demanda, sem copiar tudo pra memória
    await f.mount('WORKERFS', { files: [new File([file], inName)] }, dir);
    const args = kind === 'audio'
      ? ['-i', dir + '/' + inName, '-vn', '-c:a', 'aac', '-b:a', '160k', out]
      : ['-i', dir + '/' + inName, '-vf', "scale=-2:'min(720,ih)'", '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '27', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out];
    const code = await f.exec(args);
    if (code !== 0) throw new Error('o conversor falhou: ' + logs.slice(-3).join(' | '));
    const data = await f.readFile(out);
    await f.deleteFile(out).catch(() => {});
    if (onProgress) onProgress(1);
    return new Blob([data.buffer], { type: kind === 'audio' ? 'audio/mp4' : 'video/mp4' });
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
