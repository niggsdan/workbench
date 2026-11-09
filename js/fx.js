// Catálogo de efeitos, texturas, sons e Auto-FX. Parte pura (sem DOM).
// Os textos e parâmetros seguem o preview aprovado.

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const r1 = (t) => Math.round(t * 10) / 10;
const r2 = (t) => Math.round(t * 100) / 100;
export const FPS = 30;

export const DIRS = ['para a esquerda', 'para cima', 'para a direita', 'para baixo'];

export const SOUNDS = [
  { key: 'whoosh', name: 'Whoosh curto 02', dur: 0.5 },
  { key: 'riser', name: 'Riser + swoosh', dur: 1.4 },
  { key: 'swoosh', name: 'Swoosh', dur: 0.5 },
  { key: 'impact', name: 'Impacto seco', dur: 0.6 },
  { key: 'pop', name: 'Pop leve', dur: 0.25 },
  { key: 'ding', name: 'Ding', dur: 1.0 },
  { key: 'projector', name: 'Ruído de projetor', dur: 2.0 }
];
export const soundName = (k) => (SOUNDS.find((s) => s.key === k) || SOUNDS[0]).name;

// y dos keyframes é a altura numa caixa de 40: menor = mais forte (como no preview)
export const KF_BASE = 36; export const KF_PEAK = 4;

export const TECH = [
  { key: 'whip', name: 'WHIP PAN', hint: 'Panorâmica rápida com blur direcional', badge: 'Ajuste', len: 0.8,
    params: [{ k: 'blur', label: 'Blur direcional', min: 0, max: 100, def: 70, unit: '%' }, { k: 'frames', label: 'Duração', min: 2, max: 24, def: 8, unit: 'quadros', len: true }, { k: 'dir', label: 'Direção', min: 0, max: 3, def: 2, unit: 'dir' }],
    kf: [{ x: 0, y: 36 }, { x: 35, y: 6 }, { x: 65, y: 6 }, { x: 100, y: 36 }],
    sfx: { key: 'whoosh', off: -0.1, vol: -8, when: 'Entra 3 quadros antes' },
    recipe: 'A cena de baixo desliza na horizontal em 8 quadros com blur direcional. O whoosh entra 3 quadros antes do corte.' },
  { key: 'speed', name: 'SPEED RAMP', hint: 'Rampa de velocidade no tempo', badge: 'Ajuste', len: 2.5,
    params: [{ k: 'max', label: 'Velocidade máxima', min: 100, max: 400, def: 300, unit: '%' }, { k: 'in', label: 'Entrada da rampa', min: 0.1, max: 1.5, def: 0.4, unit: 's', dec: 1 }, { k: 'out', label: 'Saída da rampa', min: 0.1, max: 1.5, def: 0.6, unit: 's', dec: 1 }],
    kf: [{ x: 0, y: 34 }, { x: 28, y: 34 }, { x: 50, y: 5 }, { x: 76, y: 34 }, { x: 100, y: 34 }],
    sfx: { key: 'riser', off: -1.2, vol: -10, when: 'Entra 1,2 s antes' },
    recipe: 'Remapeamento de tempo de 100% para 300% e de volta, com curva suave. O áudio da cena abaixa durante a rampa.' },
  { key: 'flash', name: 'FLASH CUT', hint: 'Quadro branco de 2 a 3 quadros', badge: 'Ajuste', len: 0.4,
    params: [{ k: 'bright', label: 'Brilho do flash', min: 10, max: 100, def: 85, unit: '%' }, { k: 'frames', label: 'Duração', min: 2, max: 8, def: 3, unit: 'quadros', len: true }],
    kf: [{ x: 0, y: 36 }, { x: 20, y: 4 }, { x: 100, y: 36 }],
    sfx: { key: 'impact', off: 0, vol: -6, when: 'Entra junto com o efeito' },
    recipe: 'Quadro branco de 3 quadros em cima do corte, entrada seca e saída rápida. O impacto bate no primeiro quadro.' },
  { key: 'zoom', name: 'ZOOM', hint: 'Zoom de ênfase na palavra', badge: 'Ajuste', len: 2,
    params: [{ k: 'scale', label: 'Escala final', min: 100, max: 200, def: 115, unit: '%' }, { k: 'curve', label: 'Curva', min: 0, max: 2, def: 1, unit: 'curve' }],
    kf: [{ x: 0, y: 36 }, { x: 70, y: 8 }, { x: 100, y: 8 }],
    sfx: { key: 'pop', off: -0.03, vol: -12, when: 'Entra 1 quadro antes' },
    recipe: 'Escala de 100% para 115% em 10 quadros, com ease out. Volta ao normal no próximo corte.' },
  { key: 'freeze', name: 'FREEZE FRAME', hint: 'Congela o quadro e segura', badge: 'Ajuste', len: 1,
    params: [{ k: 'hold', label: 'Tempo parado', min: 0.2, max: 4, def: 1, unit: 's', dec: 1, len: 's' }, { k: 'bw', label: 'Tirar a cor', min: 0, max: 100, def: 0, unit: '%' }],
    kf: [], sfx: { key: 'impact', off: 0, vol: -10, when: 'Entra junto com o efeito' },
    recipe: 'O quadro do início do efeito fica parado pelo tempo escolhido, depois a cena segue.' },
  { key: 'jump', name: 'JUMP CUT', hint: 'Tira pausa e respiro da fala', badge: 'Ajuste', len: 0.6,
    params: [], kf: [], sfx: null,
    recipe: 'Pula o trecho marcado: o vídeo vai direto do começo pro fim do efeito, e o filme fica mais curto.' },
  { key: 'split', name: 'SPLIT SCREEN', hint: 'Vídeo ao vivo e o quadro do início, lado a lado', badge: 'Ajuste', len: 3,
    params: [{ k: 'pos', label: 'Posição da divisória', min: 20, max: 80, def: 50, unit: '%' }],
    kf: [], sfx: null,
    recipe: 'Divide o quadro em duas metades: o vídeo ao vivo em cima e o quadro do começo do efeito embaixo.' },
  { key: 'dolly', name: 'DOLLY', hint: 'Pede cena com câmera deslizando', badge: 'Linguagem', len: 2, language: true,
    params: [], kf: [], sfx: null,
    recipe: 'Marcador de linguagem: lembra que aqui entra uma cena com câmera deslizando. Não altera a imagem.' }
];

export const TEXKEYS = {
  grain: 'Grão', dust: 'Poeira e riscos', jitter: 'Tremida de projetor', flicker: 'Flicker', halation: 'Halation',
  softness: 'Suavidade de lente', vignette: 'Vinheta', leak: 'Vazamento de luz', tracking: 'Tracking e ruído de fita'
};
export const TEXTURES = [
  { key: 'super8', name: 'SUPER 8', hint: 'Grão alto, tremida, poeira e flicker', badge: 'Preset', set: { grain: 62, dust: 40, jitter: 24, flicker: 18, halation: 30 },
    recipe: 'Grão de tamanho médio com textura de filme, poeira e riscos aleatórios, leve tremida de quadro e flicker. Tudo gerado aqui, sem arquivo.', sfx: { key: 'projector', off: 0, vol: -26, when: 'Em loop, do começo ao fim' } },
  { key: '16mm', name: '16 MM', hint: 'Grão médio, cor suave, leve tremida', badge: 'Preset', set: { grain: 45, softness: 15, jitter: 10, halation: 12 }, recipe: 'Grão médio, cor suave e uma tremida leve de quadro.' },
  { key: '35mm', name: '35 MM', hint: 'Grão fino e brilho nas luzes fortes', badge: 'Preset', set: { grain: 30, halation: 35, softness: 20, vignette: 25 }, recipe: 'Grão fino, brilho suave ao redor das luzes mais fortes e um pouco de suavidade de lente.' },
  { key: 'vhs', name: 'VHS', hint: 'Ruído de fita, borda mole e tracking', badge: 'Preset', set: { grain: 25, tracking: 55, softness: 45, flicker: 10 }, recipe: 'Faixas de tracking, ruído de fita e bordas moles.' },
  { key: 'grao', name: 'GRÃO', hint: 'Ruído de filme, tamanho e intensidade', badge: 'Gerado', set: { grain: 50 }, recipe: 'Ruído de filme sobre a imagem inteira.' },
  { key: 'poeira', name: 'POEIRA E RISCOS', hint: 'Partículas e riscos aleatórios', badge: 'Gerado', set: { dust: 50 }, recipe: 'Partículas e riscos aleatórios, novos a cada quadro.' },
  { key: 'halation', name: 'HALATION', hint: 'Brilho avermelhado nas luzes', badge: 'Gerado', set: { halation: 50 }, recipe: 'Brilho avermelhado ao redor das luzes fortes.' },
  { key: 'leak', name: 'LIGHT LEAK', hint: 'Vazamento de luz nas bordas', badge: 'Gerado', set: { leak: 55 }, recipe: 'Vazamento de luz quente que passa pelas bordas.' },
  { key: 'vinheta', name: 'VINHETA', hint: 'Escurece as bordas', badge: 'Gerado', set: { vignette: 45 }, recipe: 'Escurece as bordas do quadro.' }
];
export const OVERLAY = { key: 'overlay', name: 'OVERLAY', hint: 'Vídeo da tua biblioteca, com modo de mistura', badge: 'Arquivo' };

export const CINEMA = [
  { key: 'cdd', name: 'CIDADE DE DEUS', dir: 'Dir. Fernando Meirelles', look: 'super8-35' },
  { key: 'aflp', name: 'AMOR À FLOR DA PELE', dir: 'Dir. Wong Kar-wai', look: '35' },
  { key: 'moon', name: 'MOONLIGHT', dir: 'Dir. Barry Jenkins', look: '16' }
];
export const CINEMA_SITES = [['Film Grab', 'https://film-grab.com/?s='], ['Flim', 'https://flim.ai/'], ['Movies in Color', 'https://moviesincolor.com/?s=']];

export const PLATFORMS = [
  { key: 'youtube', label: 'YouTube · longo', ratio: '16:9', density: 0.2, res: '1080p' },
  { key: 'tiktok', label: 'TikTok · cortes', ratio: '9:16', density: 0.5, res: '1080p' },
  { key: 'instagram', label: 'Instagram · trechos', ratio: '4:5', density: 0.35, res: '1080p' }
];

export const TEXT_VARIANTS = { tarja: 'Tarja', legenda: 'Legenda' };

// ---------- itens ----------
let seq = 0;
export const newId = () => 'f' + Date.now().toString(36) + (++seq);
export const techOf = (key) => TECH.find((t) => t.key === key);
export const texOf = (key) => TEXTURES.find((t) => t.key === key);

const defParams = (defs) => Object.fromEntries(defs.map((p) => [p.k, p.def]));

export function newTech(key, a, duration) {
  const t = techOf(key);
  const item = { id: newId(), kind: 'tec', key, name: t.name, a: r2(a), b: r2(Math.min(duration, a + t.len)), params: defParams(t.params), kf: t.kf.map((k) => ({ ...k })),
    sfx: t.sfx ? { key: t.sfx.key, off: t.sfx.off, vol: t.sfx.vol } : null, why: 'Adicionado por você no playhead.', auto: false, accepted: true };
  return syncLen(item);
}
export function newTexture(key, a, duration) {
  const t = texOf(key);
  return { id: newId(), kind: 'tx', key, name: t.name, a: r2(a), b: r2(duration), params: { ...t.set }, kf: [], sfx: t.sfx ? { key: t.sfx.key, off: 0, vol: t.sfx.vol } : null,
    why: 'Adicionado por você.', auto: false, accepted: true };
}
export function newOverlay(libId, name, a, duration) {
  return { id: newId(), kind: 'ov', key: 'overlay', name: 'OVERLAY', lib: libId, file: name, a: r2(a), b: r2(duration), params: { opacity: 60, scale: 100, speed: 100 }, kf: [], sfx: null,
    credit: { required: true, creator: '' }, why: 'Arquivo da tua pasta Overlays, em modo Screen e em loop sobre o vídeo.', auto: false, accepted: true };
}
export function newText(variant, a, duration) {
  const tarja = variant === 'tarja';
  return { id: newId(), kind: 'tt', key: variant, name: TEXT_VARIANTS[variant], a: r2(a), b: r2(Math.min(duration, a + 3)), params: { text: tarja ? 'Título da tarja' : 'Texto da legenda', sub: tarja ? 'Subtítulo' : '' }, kf: [], sfx: null,
    why: 'Adicionado por você.', auto: false, accepted: true };
}
export function newSound(key, a, duration) {
  const s = SOUNDS.find((x) => x.key === key) || SOUNDS[0];
  return { id: newId(), kind: 'sx', key: s.key, name: s.name, a: r2(a), b: r2(Math.min(duration, a + s.dur)), params: {}, kf: [], sfx: { key: s.key, off: 0, vol: -8 }, why: 'Som avulso.', auto: false, accepted: true };
}

// parâmetros que mexem no comprimento do item (Duração em quadros, tempo parado)
export function syncLen(item) {
  if (item.kind !== 'tec') return item;
  const t = techOf(item.key); if (!t) return item;
  for (const p of t.params) {
    if (p.len === true) item.b = r2(item.a + item.params[p.k] / FPS);
    else if (p.len === 's') item.b = r2(item.a + item.params[p.k]);
  }
  return item;
}

export const paramDefs = (item) => {
  if (item.kind === 'tec') return (techOf(item.key) || { params: [] }).params;
  if (item.kind === 'tx') return Object.keys(item.params).map((k) => ({ k, label: TEXKEYS[k] || k, min: 0, max: 100, def: 0, unit: '%' }));
  if (item.kind === 'ov') return [{ k: 'opacity', label: 'Opacidade', min: 0, max: 100, def: 60, unit: '%' }, { k: 'scale', label: 'Escala', min: 50, max: 200, def: 100, unit: '%' }, { k: 'speed', label: 'Velocidade', min: 25, max: 300, def: 100, unit: '%' }];
  return [];
};
export const CURVES = ['linear', 'ease out', 'ease in-out'];
export function fmtParam(def, v) {
  if (def.unit === 'dir') return DIRS[Math.round(v)] || '';
  if (def.unit === 'curve') return CURVES[Math.round(v)] || '';
  if (def.unit === '%') return Math.round(v) + '%';
  if (def.unit === 's') return String(Number(v).toFixed(def.dec == null ? 1 : def.dec)).replace('.', ',') + ' s';
  return Math.round(v) + ' ' + def.unit;
}
export const pctOf = (def, v) => clamp((v - def.min) / (def.max - def.min)) * 100;

export const recipeOf = (item) => {
  if (item.kind === 'tec') { const t = techOf(item.key); return t ? t.recipe : ''; }
  if (item.kind === 'tx') { const t = texOf(item.key); return t ? t.recipe : ''; }
  if (item.kind === 'ov') return 'Modo de mistura Screen, em loop, sobre o clipe de baixo. O arquivo vem da tua biblioteca e não fica no Workbench.';
  if (item.kind === 'tt') return item.key === 'tarja' ? 'Barra com título e subtítulo no terço de baixo do quadro.' : 'Legenda centralizada no pé do quadro.';
  return 'Som sintetizado no navegador, sem arquivo.';
};
export const kindLabel = (item) => ({ tec: item.key === 'dolly' ? 'Marcador · linguagem' : 'Camada de ajuste · técnica', tx: 'Camada de ajuste · textura e lente', ov: 'Overlay em vídeo', tt: 'Texto', sx: 'Som avulso' }[item.kind]);

// ---------- matemática do efeito ----------
// força 0..1 do efeito em p (0..1 ao longo do item), pelos keyframes
export function envelope(item, p) {
  const k = item.kf && item.kf.length ? [...item.kf].sort((a, b) => a.x - b.x) : null;
  if (!k) return 1;
  const x = clamp(p) * 100;
  let y;
  if (x <= k[0].x) y = k[0].y;
  else if (x >= k[k.length - 1].x) y = k[k.length - 1].y;
  else { let i = 0; while (x > k[i + 1].x) i++; const u = (x - k[i].x) / ((k[i + 1].x - k[i].x) || 1); y = k[i].y + (k[i + 1].y - k[i].y) * u; }
  return clamp((KF_BASE - y) / (KF_BASE - KF_PEAK));
}
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

// Estado visual dos efeitos ativos em t. Devolve { zoom, blurPx, dx, dy, flash, rate, skipTo, freezeAt, bw, split, active:[ids] }
export function fxState(items, t, W = 1) {
  const o = { zoom: 1, blur: 0, dir: [0, 0], offset: [0, 0], flash: 0, rate: 1, skipTo: null, freeze: null, bw: 0, split: null, active: [] };
  for (const it of items) {
    if (it.kind !== 'tec' || t < it.a || t >= it.b) continue;
    const p = clamp((t - it.a) / Math.max(0.001, it.b - it.a));
    const e = envelope(it, p);
    o.active.push(it.id);
    if (it.key === 'whip') {
      const d = Math.round(it.params.dir); const v = [[-1, 0], [0, -1], [1, 0], [0, 1]][d] || [1, 0];
      o.blur = Math.max(o.blur, (it.params.blur / 100) * e); o.dir = v;
      o.offset = [v[0] * e * 0.12, v[1] * e * 0.12]; // fração do quadro
    } else if (it.key === 'flash') o.flash = Math.max(o.flash, (it.params.bright / 100) * e);
    else if (it.key === 'zoom') {
      const c = Math.round(it.params.curve); const u = clamp(p / 0.7);
      const k = c === 0 ? u : c === 1 ? easeOut(u) : easeInOut(u);
      o.zoom *= 1 + (it.params.scale / 100 - 1) * k;
    } else if (it.key === 'speed') {
      const len = it.b - it.a; const tin = Math.min(it.params.in, len / 2); const tout = Math.min(it.params.out, len / 2);
      const dt = t - it.a; let k = 1;
      if (dt < tin) k = dt / tin; else if (dt > len - tout) k = (it.b - t) / tout;
      o.rate = 1 + (it.params.max / 100 - 1) * easeInOut(clamp(k));
    } else if (it.key === 'jump') o.skipTo = it.b;
    else if (it.key === 'freeze') { o.freeze = it.a; o.bw = it.params.bw / 100; }
    else if (it.key === 'split') o.split = { pos: it.params.pos / 100 };
  }
  return o;
}

// estado das texturas ativas em t: parâmetros somados (máximo por chave)
export function textureState(items, t) {
  const o = {};
  for (const it of items) if (it.kind === 'tx' && t >= it.a && t < it.b) for (const [k, v] of Object.entries(it.params)) o[k] = Math.max(o[k] || 0, v);
  return o;
}

// duração de saída: o jump cut tira trechos
export function outDuration(items, duration) {
  let cut = 0; for (const it of items) if (it.kind === 'tec' && it.key === 'jump') cut += Math.max(0, Math.min(duration, it.b) - it.a);
  return Math.max(0, duration - cut);
}

// ---------- Auto-FX ----------
const STYLE_LOOK = { cdd: 'super8-35', aflp: '35', moon: '16' };
const fmtT = (t) => { const tt = Math.round(t * 10); return String(Math.floor(tt / 600)).padStart(2, '0') + ':' + String(Math.floor((tt % 600) / 10)).padStart(2, '0') + ',' + (tt % 10); };

// scenes: [{a,b}], cands: [{t,score}] (pode ser vazio), styleKey: cdd|aflp|moon|..., platformKey
export function suggest({ scenes, cands = [], duration, platformKey = 'tiktok', styleKey = 'cdd' }) {
  const plat = PLATFORMS.find((p) => p.key === platformKey) || PLATFORMS[1];
  const cuts = scenes.slice(1).map((s, i) => {
    const c = cands.reduce((best, x) => (!best || Math.abs(x.t - s.a) < Math.abs(best.t - s.a) ? x : best), null);
    return { t: s.a, i, score: c && Math.abs(c.t - s.a) < 0.6 ? c.score : 0.5, next: s.b - s.a, prev: scenes[i].b - scenes[i].a };
  });
  const want = cuts.length ? Math.max(1, Math.round(cuts.length * plat.density)) : 0;
  const picked = [];
  for (const c of [...cuts].sort((a, b) => b.score - a.score)) {
    if (picked.length >= want) break;
    if (picked.every((p) => Math.abs(p.t - c.t) >= 2)) picked.push(c);
  }
  picked.sort((a, b) => a.t - b.t);
  const order = ['whip', 'flash', 'zoom', 'whip', 'speed'];
  const items = [];
  picked.forEach((c, n) => {
    let key = order[n % order.length];
    if (key === 'speed' && c.next < 3) key = 'whip';
    if (key === 'zoom' && c.next < 1.5) key = 'flash';
    const t = techOf(key);
    let a = c.t; let it;
    if (key === 'whip') a = Math.max(0, c.t - 0.13);
    if (key === 'speed') a = c.t + 0.5;
    it = newTech(key, a, duration);
    if (key === 'zoom') it.b = r2(Math.min(duration, c.t + 1.5));
    if (key === 'speed') it.b = r2(Math.min(duration, a + Math.min(2.5, c.next - 0.7)));
    const how = { whip: 'a troca de plano aguenta um whip pan', flash: 'um quadro branco marca a virada', zoom: 'um zoom de ênfase dá peso pra cena que entra', speed: 'a cena é longa o bastante pra acelerar e voltar' }[key];
    it.why = 'Corte de cena entre C' + (c.i + 1) + ' e C' + (c.i + 2) + ' em ' + fmtT(c.t) + ' (nota ' + String(r2(c.score)).replace('.', ',') + '): ' + how + '.';
    it.auto = true; it.accepted = false;
    items.push(it);
  });
  // texturas pelo estilo
  const look = STYLE_LOOK[styleKey] || '35';
  const mid = cuts.length ? [...cuts].sort((a, b) => Math.abs(a.t - duration / 2) - Math.abs(b.t - duration / 2))[0].t : duration / 2;
  const mk = (key, a, b, why) => { const x = newTexture(key, a, b); x.why = why; x.auto = true; x.accepted = false; return x; };
  if (look === 'super8-35' && cuts.length) {
    items.push(mk('super8', 0, mid, 'O estilo do projeto pede cara de filme caseiro na primeira metade. O look muda no corte em ' + fmtT(mid) + '.'));
    items.push(mk('35mm', mid, duration, 'A segunda metade passa de caseiro pra cinema, no corte em ' + fmtT(mid) + '.'));
  } else items.push(mk(look === '16' ? '16mm' : '35mm', 0, duration, 'Look escolhido pelo estilo de referência do projeto.'));
  return items;
}
export const countSuggested = (items) => ({
  fx: items.filter((i) => i.auto && !i.accepted && i.kind === 'tec').length,
  tx: items.filter((i) => i.auto && !i.accepted && i.kind === 'tx').length,
  sfx: items.filter((i) => i.auto && !i.accepted && i.sfx).length
});
export { fmtT as fmtClock, r1, r2 };
