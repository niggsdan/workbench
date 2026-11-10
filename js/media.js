// Tipos de mídia, papéis por pasta e leitura de link do Drive. Tudo puro (testável no Node).

const EXT = {
  // lrf: prévia da DJI (Osmo, Mini, Action); lrv: prévia da GoPro; insv: Insta360; 360: GoPro Max; mts/m2ts: AVCHD (Panasonic, Sony)
  video: ['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'mxf', 'mts', 'm2ts', 'm2t', 'wmv', 'flv', '3gp', 'mpg', 'mpeg', 'ogv', 'vob', 'mpe', 'f4v', 'divx', 'asf', 'lrf', 'lrv', 'insv', '360', 'dv', 'hevc', 'h264', 'h265'],
  audio: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'aiff', 'aif', 'wma', 'caf', 'ac3'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif', 'svg', 'thm']
};
// RAW de câmera: o navegador não decodifica, mas todo RAW guarda uma prévia JPEG grande dentro.
export const RAW_EXT = ['rw2', 'raw', 'orf', 'ori', 'cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'raf', 'dng', 'pef', 'srw', 'x3f', '3fr', 'iiq', 'rwl', 'erf', 'kdc', 'mrw', 'mos', 'gpr'];
EXT.image.push(...RAW_EXT);
export const isRaw = (name) => RAW_EXT.includes(extOf(name));
export const RAW_BRAND = { rw2: 'Panasonic Lumix', raw: 'Panasonic/Leica', orf: 'Olympus / OM System', ori: 'Olympus / OM System', cr2: 'Canon', cr3: 'Canon', crw: 'Canon', nef: 'Nikon', nrw: 'Nikon', arw: 'Sony', srf: 'Sony', sr2: 'Sony', raf: 'Fujifilm', dng: 'DNG', pef: 'Pentax', srw: 'Samsung', x3f: 'Sigma', '3fr': 'Hasselblad', iiq: 'Phase One', rwl: 'Leica', erf: 'Epson', kdc: 'Kodak', mrw: 'Minolta', mos: 'Leaf', gpr: 'GoPro' };
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
  let m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(t) || /\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(t) || /\/d\/([A-Za-z0-9_-]{20,})/.exec(t);
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
