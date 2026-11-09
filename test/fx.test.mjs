import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/fx.js';
import * as M from '../js/model.js';
import { serializeProject, parseProject, newScene } from '../js/project.js';

test('whip pan: força sobe no meio e vira offset na direção escolhida', () => {
  const it = F.newTech('whip', 10, 60);
  assert.ok(Math.abs(it.b - it.a - 8 / 30) < 0.02, 'duração vem dos quadros');
  const mid = F.fxState([it], it.a + (it.b - it.a) / 2); const edge = F.fxState([it], it.a + 0.001);
  assert.ok(mid.blur > edge.blur); assert.equal(mid.dir[0], 1);
});
test('flash cut tem pico no começo', () => {
  const it = F.newTech('flash', 5, 60);
  const s = F.fxState([it], 5 + (it.b - 5) * 0.2); assert.ok(s.flash > 0.7);
});
test('zoom chega na escala final; speed ramp acelera no meio; jump pula', () => {
  const z = F.newTech('zoom', 0, 60); z.b = 2;
  assert.ok(Math.abs(F.fxState([z], 1.95).zoom - 1.15) < 0.02);
  const sp = F.newTech('speed', 0, 60); sp.b = 3;
  assert.ok(F.fxState([sp], 1.5).rate > 2.5 && F.fxState([sp], 0.01).rate < 1.2);
  const j = F.newTech('jump', 4, 60); assert.equal(F.fxState([j], 4.1).skipTo, j.b);
  assert.ok(Math.abs(F.outDuration([j], 60) - (60 - (j.b - j.a))) < 1e-9);
});
test('Auto-FX: sugere por cortes, textura pelo estilo, tudo como sugerido', () => {
  const scenes = [[0, 3], [3, 7], [7, 11], [11, 16], [16, 19], [19, 24], [24, 28], [28, 33]].map(([a, b]) => newScene(a, b));
  const cands = scenes.slice(1).map((s, i) => ({ t: s.a, score: 0.4 + (i % 4) * 0.15 }));
  const it = F.suggest({ scenes, cands, duration: 33, platformKey: 'tiktok', styleKey: 'cdd' });
  assert.ok(it.length >= 4); assert.ok(it.every((x) => x.auto && !x.accepted));
  assert.ok(it.some((x) => x.kind === 'tec') && it.some((x) => x.kind === 'tx'));
  assert.ok(it.every((x) => x.a >= 0 && x.b <= 33 && x.b > x.a));
  const c = F.countSuggested(it); assert.ok(c.fx >= 1 && c.tx >= 1);
  assert.ok(it.filter((x) => x.kind === 'tec').every((x) => /Corte de cena entre C\d+ e C\d+/.test(x.why)));
  const y = F.suggest({ scenes, cands, duration: 33, platformKey: 'youtube' });
  assert.ok(y.filter((x) => x.kind === 'tec').length < it.filter((x) => x.kind === 'tec').length);
});
test('grupos de grade: dividir, juntar e acompanhar mudança de cenas', () => {
  let e = M.newEdit(); assert.equal(M.groupCount(e), 1);
  e = M.splitGroup(e, 10); e = M.splitGroup(e, 20);
  assert.deepEqual(e.gb, [10, 20]); assert.equal(e.grades.length, 3);
  assert.equal(M.groupAt(e, 15), 1); assert.equal(M.groupAt(e, 10), 1);
  e.grades[1].serial[0].prim.contrast = 1.4;
  const j = M.joinGroup(e, 2); assert.deepEqual(j.gb, [10]); assert.equal(j.grades[1].serial[0].prim.contrast, 1.4);
  const scenes = [newScene(0, 10.1), newScene(10.1, 30)];
  const r = M.reconcile(e, scenes); assert.deepEqual(r.gb, [10.1]); assert.equal(r.grades.length, 2);
});
test('agrupar por cor junta cenas parecidas', () => {
  const sc = [0, 1, 2, 3, 4, 5].map((i) => newScene(i * 5, i * 5 + 5));
  const colors = [[200, 180, 150], [205, 182, 150], [60, 100, 130], [62, 98, 128], [200, 120, 60], [198, 118, 62]];
  assert.deepEqual(M.autoGroupBounds(sc, colors), [10, 20]);
});
test('ímã gruda nos cortes e respeita a duração', () => {
  assert.deepEqual(M.moveTimes(5, 6, 0.95, 60, [6]), [6, 7]);
  assert.deepEqual(M.moveTimes(5, 6, 0.95, 60, []), [5.95, 6.95]);
  assert.deepEqual(M.moveTimes(58, 59.5, 5, 60, []), [58.5, 60]);
  assert.deepEqual(M.moveTimes(1, 2, -5, 60, []), [0, 1]);
});
test('projeto salva e reabre com o estado de edição', () => {
  let e = M.newEdit(); e = M.addFx(e, F.newTech('zoom', 3, 40)); e = M.splitGroup(e, 12); e = M.addIdea(e, 0, 14, 'O convite');
  const scenes = [newScene(0, 12), newScene(12, 40)];
  const txt = serializeProject({ video: { name: 'a.mp4', size: 1, duration: 40 }, sens: 2, ratio: '9:16', scenes, cands: [], edit: e });
  const r = parseProject(txt); assert.ok(r.ok, r.error);
  assert.equal(r.project.edit.fx.length, 1); assert.deepEqual(r.project.edit.gb, [12]); assert.equal(r.project.edit.ideas[0].name, 'O convite');
  const old = parseProject(JSON.stringify({ ...JSON.parse(txt), edit: undefined })); assert.ok(old.ok); assert.equal(old.project.edit.fx.length, 0);
  const bad = M.sanitizeEdit({ fx: [{ id: 1 }], gb: [5], grades: [] }); assert.equal(bad.fx.length, 0); assert.deepEqual(bad.gb, []);
});
