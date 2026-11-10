// Máscaras no vídeo (seta): forma com keyframes no tempo. Parte pura.
// Coordenadas normalizadas no quadro de saída: x,y = centro (0..1), w,h = tamanho (0..1).

export const MASK_TYPES = [
  { key: 'mask', name: 'Máscara', hint: 'Isola o que está dentro: o resto escurece' },
  { key: 'blur', name: 'Desfoque', hint: 'Desfoca dentro da forma (rosto, placa, marca)' },
  { key: 'crop', name: 'Recorte', hint: 'Corta tudo fora da forma' },
  { key: 'spot', name: 'Destaque', hint: 'Luz em cima do que está dentro' }
];
export const maskType = (k) => MASK_TYPES.find((m) => m.key === k) || MASK_TYPES[0];
const r3 = (x) => Math.round(x * 1000) / 1000;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function newMask(key, t, duration, id) {
  return { id, kind: 'mk', key, name: maskType(key).name.toUpperCase(), a: Math.round(t * 100) / 100, b: Math.round(Math.min(duration, t + 3) * 100) / 100,
    params: { shape: 1, feather: 25, amount: key === 'blur' ? 60 : 75, invert: 0 },
    kf: [], shapeKf: [{ t: Math.round(t * 1000) / 1000, x: 0.5, y: 0.45, w: 0.4, h: 0.35 }],
    sfx: null, why: 'Desenhada por você no vídeo.', auto: false, accepted: true };
}

// Forma no tempo t (interpolação linear entre keyframes; antes do primeiro e depois do último, segura).
export function shapeAt(item, t) {
  const k = [...(item.shapeKf || [])].sort((p, q) => p.t - q.t);
  if (!k.length) return { x: 0.5, y: 0.5, w: 0.4, h: 0.4 };
  if (t <= k[0].t) return { ...k[0] };
  if (t >= k[k.length - 1].t) return { ...k[k.length - 1] };
  let i = 0; while (t > k[i + 1].t) i++;
  const u = (t - k[i].t) / ((k[i + 1].t - k[i].t) || 1); const L = (a, b) => a + (b - a) * u;
  return { t, x: L(k[i].x, k[i + 1].x), y: L(k[i].y, k[i + 1].y), w: L(k[i].w, k[i + 1].w), h: L(k[i].h, k[i + 1].h) };
}

// Grava a forma em t: atualiza o keyframe que já está ali (até meio quadro) ou cria um novo.
export function setShapeAt(item, t, s, tol = 0.02) {
  const kf = (item.shapeKf || []).slice(); const tt = r3(t);
  const box = { x: r3(clamp(s.x, -0.2, 1.2)), y: r3(clamp(s.y, -0.2, 1.2)), w: r3(clamp(s.w, 0.02, 1.5)), h: r3(clamp(s.h, 0.02, 1.5)) };
  const i = kf.findIndex((k) => Math.abs(k.t - tt) <= tol);
  if (i >= 0) kf[i] = { t: kf[i].t, ...box }; else kf.push({ t: tt, ...box });
  kf.sort((p, q) => p.t - q.t);
  return { ...item, shapeKf: kf };
}
export const removeKf = (item, t) => ({ ...item, shapeKf: item.shapeKf.length > 1 ? item.shapeKf.filter((k) => Math.abs(k.t - t) > 1e-4) : item.shapeKf });
