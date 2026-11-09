// Operações puras sobre a lista de cenas. Nada aqui mexe em DOM nem em vídeo,
// então tudo é testável no Node. Cada função devolve uma lista NOVA.

export const MIN_SCENE = 0.5; // segundos
export const MODES = ['Rosto', 'Centro', 'Manual'];
export const RATIOS = ['9:16', '1:1', '4:5', '16:9']; // 16:9 é o quadro original

export const r1 = (t) => Math.round(t * 10) / 10;
const clone = (x) => JSON.parse(JSON.stringify(x));

// m[k] = modo de reenquadramento por formato (0 = 9:16, 1 = 1:1, 2 = 4:5)
// ox[k] = posição horizontal (0-100) usada no modo Manual
export const newScene = (a, b, m, ox) => ({ a, b, m: (m || [0, 0, 0]).slice(), ox: (ox || [50, 50, 50]).slice() });

export function scenesFromCuts(cuts, duration) {
  const ts = [0].concat(cuts, [duration]);
  return ts.slice(0, -1).map((a, i) => newScene(a, ts[i + 1]));
}

export function sceneAt(scenes, t) {
  const i = scenes.findIndex((s) => t >= s.a && t < s.b);
  return i < 0 ? scenes.length - 1 : i;
}

export const canSplit = (scenes, i, t) => !!scenes[i] && t - scenes[i].a >= MIN_SCENE && scenes[i].b - t >= MIN_SCENE;
export const canJoinPrev = (scenes, i) => i > 0 && i < scenes.length;
export const canJoinNext = (scenes, i) => i >= 0 && i < scenes.length - 1;
// mover o corte de entrada da cena i em d segundos (d pode ser negativo)
export function canMoveCut(scenes, i, d) {
  if (i <= 0 || i >= scenes.length) return false;
  const a = r1(scenes[i].a + d);
  return a - scenes[i - 1].a >= MIN_SCENE && scenes[i].b - a >= MIN_SCENE;
}

export function split(scenes, i, t) {
  if (!canSplit(scenes, i, t)) return scenes;
  const n = clone(scenes);
  const s = n[i];
  n.splice(i, 1, newScene(s.a, t, s.m, s.ox), newScene(t, s.b, s.m, s.ox));
  return n;
}

export function joinPrev(scenes, i) {
  if (!canJoinPrev(scenes, i)) return scenes;
  const n = clone(scenes);
  n.splice(i - 1, 2, newScene(n[i - 1].a, n[i].b, n[i - 1].m, n[i - 1].ox));
  return n;
}

export function joinNext(scenes, i) {
  if (!canJoinNext(scenes, i)) return scenes;
  const n = clone(scenes);
  n.splice(i, 2, newScene(n[i].a, n[i + 1].b, n[i].m, n[i].ox));
  return n;
}

export function moveCut(scenes, i, d) {
  if (!canMoveCut(scenes, i, d)) return scenes;
  const n = clone(scenes);
  const a = r1(n[i].a + d);
  n[i - 1].b = a;
  n[i].a = a;
  return n;
}

export function cycleMode(scenes, i, k) {
  const n = clone(scenes);
  n[i].m[k] = (n[i].m[k] + 1) % MODES.length;
  return n;
}

export function setOffset(scenes, i, k, v) {
  const n = clone(scenes);
  n[i].ox[k] = Math.min(100, Math.max(0, Math.round(v)));
  return n;
}
