// Worker de transcrição: roda o Whisper (transformers.js) fora da tela, pra edição não travar.
// O modelo é baixado do Hugging Face uma vez e fica guardado no cache do navegador. A fala não sai do computador.
// Versão fixa do transformers.js (Apache-2.0), servida pelo jsDelivr.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

let asr = null;
let loaded = '';

async function getPipe(model, onLoad) {
  const tryDevice = async (device) => {
    const key = model + '|' + device;
    if (asr && loaded === key) return asr;
    const dtype = device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8';
    asr = await pipeline('automatic-speech-recognition', model, { device, dtype, progress_callback: onLoad });
    loaded = key;
    return asr;
  };
  if (self.navigator && navigator.gpu) {
    try { const a = await navigator.gpu.requestAdapter(); if (a) return { pipe: await tryDevice('webgpu'), device: 'webgpu' }; } catch (e) { /* cai pro wasm */ }
  }
  return { pipe: await tryDevice('wasm'), device: 'wasm' };
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  try {
    const files = new Map();
    const onLoad = (p) => {
      if (p.status === 'progress' && p.file) { files.set(p.file, [p.loaded || 0, p.total || 0]); let l = 0; let t = 0; for (const [a, b] of files.values()) { l += a; t += b; } self.postMessage({ type: 'load', p: t ? l / t : 0, mb: t / 1048576 }); }
    };
    const { pipe, device } = await getPipe(data.model, onLoad);
    self.postMessage({ type: 'ready', device });
    const samples = data.samples; const rate = 16000; const n = data.wins.length;
    for (let i = 0; i < n; i++) {
      const [s, e] = data.wins[i];
      const out = await pipe(samples.subarray(s, e), { language: data.lang, task: 'transcribe', return_timestamps: true, chunk_length_s: 30 });
      self.postMessage({ type: 'part', i, n, offset: s / rate, chunks: out.chunks || [{ timestamp: [0, (e - s) / rate], text: out.text }] });
    }
    self.postMessage({ type: 'done' });
  } catch (e) {
    self.postMessage({ type: 'error', message: (e && e.message) || String(e) });
  }
};
