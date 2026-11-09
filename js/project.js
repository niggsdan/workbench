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

// ---------- salvar / abrir projeto ----------
export const PROJECT_VERSION = 1;

export function serializeProject({ video, sens, ratio, scenes, cands }) {
  return JSON.stringify({
    app: 'workbench', version: PROJECT_VERSION, savedAt: new Date().toISOString(),
    video: { name: video.name, size: video.size, duration: video.duration },
    sens, ratio, scenes, cands
  }, null, 2);
}

const num = (x) => typeof x === 'number' && Number.isFinite(x);

// Valida o texto de um projeto. Devolve { ok:true, project } ou { ok:false, error }.
export function parseProject(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'O arquivo não é um JSON válido.' }; }
  if (!j || j.app !== 'workbench') return { ok: false, error: 'Esse arquivo não é um projeto do Workbench.' };
  if (j.version !== PROJECT_VERSION) return { ok: false, error: 'Versão de projeto não suportada: ' + j.version + '.' };
  const v = j.video;
  if (!v || typeof v.name !== 'string' || !num(v.duration) || v.duration <= 0) return { ok: false, error: 'Projeto sem dados do vídeo.' };
  if (!Number.isInteger(j.sens) || j.sens < 0 || j.sens > 4) return { ok: false, error: 'Sensibilidade inválida.' };
  if (!Array.isArray(j.scenes) || !j.scenes.length) return { ok: false, error: 'Projeto sem cenas.' };
  let prev = 0;
  for (const s of j.scenes) {
    if (!s || !num(s.a) || !num(s.b) || s.b <= s.a) return { ok: false, error: 'Cena com tempos inválidos.' };
    if (Math.abs(s.a - prev) > 0.001) return { ok: false, error: 'As cenas têm buraco ou sobreposição.' };
    if (!Array.isArray(s.m) || s.m.length !== 3 || s.m.some((x) => !Number.isInteger(x) || x < 0 || x >= MODES.length)) return { ok: false, error: 'Modo de enquadramento inválido.' };
    if (!Array.isArray(s.ox) || s.ox.length !== 3 || s.ox.some((x) => !num(x) || x < 0 || x > 100)) return { ok: false, error: 'Posição de enquadramento inválida.' };
    prev = s.b;
  }
  if (Math.abs(prev - v.duration) > 0.6) return { ok: false, error: 'As cenas não cobrem a duração do vídeo.' };
  const cands = Array.isArray(j.cands) ? j.cands.filter((c) => c && num(c.t) && num(c.score)) : [];
  return { ok: true, project: {
    video: { name: v.name, size: num(v.size) ? v.size : 0, duration: v.duration },
    sens: j.sens, ratio: RATIOS.includes(j.ratio) ? j.ratio : '9:16',
    scenes: j.scenes.map((s) => newScene(s.a, s.b, s.m, s.ox)), cands
  } };
}
