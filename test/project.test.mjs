import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/project.js';

const base = () => P.scenesFromCuts([10, 20], 30);

test('scenesFromCuts cobre o vídeo inteiro', () => {
  const s = base();
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => [x.a, x.b]), [[0, 10], [10, 20], [20, 30]]);
});

test('sceneAt acha a cena do playhead, inclusive no fim', () => {
  const s = base();
  assert.equal(P.sceneAt(s, 0), 0);
  assert.equal(P.sceneAt(s, 10), 1);
  assert.equal(P.sceneAt(s, 29.9), 2);
  assert.equal(P.sceneAt(s, 30), 2);
});

test('split respeita o mínimo de 0,5 s e herda o enquadramento', () => {
  let s = base();
  s = P.cycleMode(s, 1, 0);
  assert.equal(P.canSplit(s, 1, 10.3), false);
  assert.equal(P.split(s, 1, 10.3), s);
  const t = P.split(s, 1, 15);
  assert.equal(t.length, 4);
  assert.deepEqual([t[1].a, t[1].b, t[2].a, t[2].b], [10, 15, 15, 20]);
  assert.equal(t[1].m[0], 1);
  assert.equal(t[2].m[0], 1);
});

test('juntar anterior e próxima', () => {
  const s = base();
  const p = P.joinPrev(s, 1);
  assert.deepEqual(p.map((x) => [x.a, x.b]), [[0, 20], [20, 30]]);
  const n = P.joinNext(s, 1);
  assert.deepEqual(n.map((x) => [x.a, x.b]), [[0, 10], [10, 30]]);
  assert.equal(P.joinPrev(s, 0), s);
  assert.equal(P.joinNext(s, 2), s);
});

test('moveCut mexe só no corte de entrada e trava no mínimo', () => {
  const s = base();
  const m = P.moveCut(s, 1, -0.5);
  assert.deepEqual([m[0].b, m[1].a], [9.5, 9.5]);
  assert.equal(P.moveCut(s, 0, 0.5), s);
  const tiny = P.scenesFromCuts([0.8], 10);
  assert.equal(P.canMoveCut(tiny, 1, -0.5), false);
});

test('operações não alteram a lista original', () => {
  const s = base();
  const snap = JSON.stringify(s);
  P.split(s, 0, 5); P.joinNext(s, 0); P.moveCut(s, 1, 0.5); P.cycleMode(s, 0, 1); P.setOffset(s, 0, 0, 80);
  assert.equal(JSON.stringify(s), snap);
});

test('modo gira Rosto -> Centro -> Manual -> Rosto e offset fica entre 0 e 100', () => {
  let s = base();
  for (const esperado of [1, 2, 0]) { s = P.cycleMode(s, 0, 2); assert.equal(s[0].m[2], esperado); }
  assert.equal(P.setOffset(s, 0, 0, 500)[0].ox[0], 100);
  assert.equal(P.setOffset(s, 0, 0, -9)[0].ox[0], 0);
});

test('salvar e abrir projeto devolve o mesmo estado', () => {
  let scenes = P.scenesFromCuts([10, 20], 30);
  scenes = P.cycleMode(scenes, 1, 2);
  scenes = P.setOffset(scenes, 1, 2, 70);
  const txt = P.serializeProject({ video: { name: 'a.mp4', size: 123, duration: 30 }, sens: 3, ratio: '1:1', scenes, cands: [{ t: 10, score: 0.9 }] });
  const r = P.parseProject(txt);
  assert.equal(r.ok, true);
  assert.deepEqual(r.project.scenes, scenes);
  assert.equal(r.project.sens, 3);
  assert.equal(r.project.ratio, '1:1');
  assert.equal(r.project.video.name, 'a.mp4');
  assert.deepEqual(r.project.cands, [{ t: 10, score: 0.9 }]);
});

test('abrir projeto recusa arquivo ruim com mensagem clara', () => {
  const ok = JSON.parse(P.serializeProject({ video: { name: 'a.mp4', size: 1, duration: 30 }, sens: 2, ratio: '9:16', scenes: P.scenesFromCuts([10], 30), cands: [] }));
  const bad = (mut) => { const c = JSON.parse(JSON.stringify(ok)); mut(c); return P.parseProject(JSON.stringify(c)); };
  assert.equal(P.parseProject('{nao é json').ok, false);
  assert.equal(P.parseProject('{"app":"outro"}').ok, false);
  assert.equal(bad((c) => { c.version = 99; }).ok, false);
  assert.equal(bad((c) => { c.sens = 9; }).ok, false);
  assert.equal(bad((c) => { c.scenes[1].a = 12; }).ok, false); // buraco entre cenas
  assert.equal(bad((c) => { c.scenes[0].m = [0, 0, 7]; }).ok, false);
  assert.equal(bad((c) => { c.scenes[0].ox = [50, 150, 50]; }).ok, false);
  assert.equal(bad((c) => { c.scenes = []; }).ok, false);
  assert.equal(bad((c) => { c.video.duration = 100; }).ok, false); // cenas não cobrem o vídeo
  assert.equal(bad((c) => { c.ratio = 'xx'; }).project.ratio, '9:16'); // ratio ruim vira padrão
});
