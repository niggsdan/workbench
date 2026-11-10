// Transcrição no navegador: extrai o áudio em 16 kHz e manda pro worker do Whisper.
import { ffmpegExec } from './convert.js';
import { windows, mergeChunks, MODELS } from './transcript.js';
import { extOf } from './media.js';

const RATE = 16000;

async function decode(blob) {
  const ctx = new AudioContext();
  try { return await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { ctx.close().catch(() => {}); }
}

// Áudio mono 16 kHz. Se o navegador não decodificar, o ffmpeg extrai.
export async function audio16k(blob, name = 'video.mp4') {
  let buf;
  try { buf = await decode(blob); } catch (e) {
    let wav;
    try { wav = await ffmpegExec(blob, 'entrada.' + (extOf(name) || 'bin'), (i, o) => ['-i', i, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'wav', o], 'audio.wav', 'audio/wav'); } catch (err) {
      throw new Error(/does not contain any stream|matches no streams|no audio/i.test(err.message) ? 'esse vídeo não tem áudio' : 'não consegui ler o áudio (' + err.message.slice(0, 80) + ')');
    }
    buf = await decode(wav);
  }
  if (!buf.duration) throw new Error('o arquivo não tem áudio');
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * RATE)), RATE);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

let worker = null;
// opts: { model:'base'|'small', lang, duration, onProgress({stage, p, text, device}), signal }
export async function transcribe(blob, name, opts) {
  const m = MODELS.find((x) => x.key === opts.model) || MODELS[0];
  const say = (stage, p, extra = {}) => opts.onProgress && opts.onProgress({ stage, p, ...extra });
  say('Lendo o áudio…', 0);
  const samples = await audio16k(blob, name);
  const wins = windows(samples, RATE);
  if (!worker) worker = new Worker(new URL('./transcribe-worker.js', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    const segs = [];
    const stop = () => { w.onmessage = null; };
    if (opts.signal) opts.signal.addEventListener('abort', () => { stop(); w.terminate(); worker = null; reject(new DOMException('Transcrição cancelada', 'AbortError')); }, { once: true });
    w.onmessage = ({ data }) => {
      if (data.type === 'load') say('Baixando o modelo (' + m.label.toLowerCase() + ', só na primeira vez)…', data.p * 0.3);
      else if (data.type === 'ready') say('Transcrevendo…', 0.3, { device: data.device });
      else if (data.type === 'part') {
        segs.push(...mergeChunks(data.chunks, data.offset, opts.duration || Infinity));
        say('Transcrevendo ' + (data.i + 1) + ' de ' + data.n + '…', 0.3 + 0.7 * ((data.i + 1) / data.n), { text: segs.slice(-2).map((s) => s.text).join(' ') });
      } else if (data.type === 'done') { stop(); resolve(segs); }
      else if (data.type === 'error') { stop(); reject(new Error(data.message)); }
    };
    w.onerror = (e) => { stop(); reject(new Error(e.message || 'o worker de transcrição falhou')); };
    const copy = samples.slice();
    w.postMessage({ type: 'run', model: m.id, lang: opts.lang, samples: copy, wins }, [copy.buffer]);
  });
}
