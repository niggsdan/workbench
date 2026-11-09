// Tipos de mídia, papéis por pasta e leitura de link do Drive. Tudo puro (testável no Node).

const EXT = {
  video: ['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'mxf', 'mts', 'm2ts', 'wmv', 'flv', '3gp', 'mpg', 'mpeg', 'ogv', 'vob', 'mpe', 'f4v', 'divx', 'asf'],
  audio: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'aiff', 'aif', 'wma', 'caf', 'ac3'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif', 'svg', 'cr2', 'dng']
};
export const KIND_LABEL = { video: 'Vídeo', audio: 'Áudio', image: 'Imagem', other: 'Outro' };

export const extOf = (name) => { const m = /\.([^.\/\\]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; };

export function kindOf(name, mime) {
  const m = (mime || '').toLowerCase();
  const e = extOf(name);
  for (const k of ['video', 'audio', 'image']) if (EXT[k].includes(e)) return k;
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('image/')) return 'image';
  return 'other';
}

export function fmtSize(b) {
  if (!Number.isFinite(b) || b < 0) return '';
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = b / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',') + ' ' + u[i];
}

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const ROLES = ['Falas', 'Cenas', 'Overlays', 'Outros'];

// Procura o papel em qualquer pasta do caminho: Projeto/Falas/x.mov, Projeto/Cenas/y.mp4 ...
export function roleOfPath(path) {
  const parts = strip(path || '').split(/[\/\\]/).slice(0, -1);
  for (const p of parts) {
    if (/^(falas?|entrevistas?|depoimentos?)$/.test(p)) return 'Falas';
    if (/^(cenas?|ambiente|ambientes|b-?rolls?|takes?)$/.test(p)) return 'Cenas';
    if (/^(overlays?|texturas?|efeitos?)$/.test(p)) return 'Overlays';
  }
  return 'Outros';
}

// Aceita link de pasta do Drive, link com ?id= ou o ID puro.
export function parseDriveLink(s) {
  const t = (s || '').trim();
  if (!t) return null;
  let m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(t);
  if (m) return m[1];
  m = /[?&]id=([A-Za-z0-9_-]{10,})/.exec(t);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(t)) return t;
  return null;
}

export const downloadName = (name, suffix = '') => {
  const clean = String(name || 'arquivo').replace(/[\\/:*?"<>|]+/g, '_');
  if (!suffix) return clean;
  const e = extOf(clean);
  return (e ? clean.slice(0, -(e.length + 1)) : clean) + suffix;
};
