import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/transcript.js';
import * as F from '../js/fx.js';
import * as M from '../js/model.js';
import { newScene, serializeProject, parseProject } from '../js/project.js';

const segs = [
  { a: 0.4, b: 3.0, text: 'bora pra Sorocaba hoje.' },
  { a: 3.2, b: 6.5, text: 'a gente pegou a estrada cedo' },
  { a: 8.2, b: 11.0, text: 'aí a gente atravessou a cidade' },
  { a: 11.1, b: 14.9, text: 'e passou pela praça.' },
  { a: 16.5, b: 20.0, text: 'e aí acelerou tudo, chegamos cedo' },
  { a: 20.1, b: 26.0, text: 'e começou a festa, dia feliz em Sorocaba.' }
];
const scenes = [[0, 7.9], [7.9, 15.9], [15.9, 26.5]].map(([a, b]) => newScene(a, b));

test('janelas terminam no silêncio e cobrem tudo', () => {
  const rate = 100; const x = new Float32Array(60 * rate).fill(0.5);
  for (let i = 25 * rate; i < 25.3 * rate; i++) x[i] = 0;
  const w = T.windows(x, rate, 28, 18);
  assert.equal(w[0][0], 0); assert.ok(Math.abs(w[0][1] / rate - 25.15) < 0.2, 'corta no silêncio');
  assert.equal(w[w.length - 1][1], x.length);
  for (let i = 1; i < w.length; i++) assert.equal(w[i][0], w[i - 1][1]);
});
test('mergeChunks soma o deslocamento e completa fim faltando', () => {
  const m = T.mergeChunks([{ timestamp: [1, 2], text: ' oi ' }, { timestamp: [3, null], text: 'tudo bem com você' }, { timestamp: [4, 5], text: '' }], 10, 100);
  assert.deepEqual(m[0], { a: 11, b: 12, text: 'oi' }); assert.ok(m[1].b > 13); assert.equal(m.length, 2);
});
test('ideias seguem pausas e cortes, com nome pelas primeiras palavras', () => {
  const ideas = T.ideasFromTranscript(segs, scenes, 26.5, 'tiktok');
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].a, 0); assert.ok(ideas[0].name.startsWith('1 · Bora pra Sorocaba'));
  assert.equal(ideas[0].b, ideas[1].a); assert.ok(Math.abs(ideas[1].b - 26.3) < 0.5);
  const yt = T.ideasFromTranscript(segs, scenes, 26.5, 'youtube'); assert.equal(yt.length, 1);
});
test('legendas quebram em até 6 palavras e cobrem a fala', () => {
  const c = T.captionsFromTranscript([{ a: 0, b: 4, text: 'um dois três quatro cinco seis sete oito nove dez' }]);
  assert.equal(c.length, 2); assert.equal(c[0].text, 'um dois três quatro cinco seis'); assert.equal(c[0].a, 0); assert.equal(c[1].b, 4);
  assert.ok(c[0].b <= c[1].a + 0.01);
});
test('SRT no formato certo', () => {
  assert.equal(T.toSrt([{ a: 1.5, b: 62.25, text: 'oi' }]), '1\n00:00:01,500 --> 00:01:02,250\noi\n');
});
test('Auto-FX usa a frase e sugere jump cut nas pausas', () => {
  assert.equal(T.phraseNear(segs, 15.9), 'e passou pela praça');
  const it = F.suggest({ scenes, cands: [{ t: 7.9, score: 0.9 }, { t: 15.9, score: 0.8 }], duration: 26.5, platformKey: 'tiktok', segs });
  assert.ok(it.some((x) => /frase “a gente pegou a estrada cedo”/.test(x.why)));
  const j = it.filter((x) => x.key === 'jump'); assert.ok(j.length >= 1); assert.ok(j.every((x) => x.b > x.a));
  assert.ok(j.some((x) => x.a > 14.9 && x.b < 16.5)); assert.ok(!j.some((x) => x.a < 8.2 && x.b > 7.7), "não sobrepõe o whip");
});
test('transcrição vai e volta no projeto', () => {
  let e = M.newEdit(); e.transcript = { lang: 'portuguese', model: 'base', segs };
  const txt = serializeProject({ video: { name: 'v.mp4', size: 1, duration: 26.5 }, sens: 2, ratio: '9:16', scenes, cands: [], edit: e });
  const r = parseProject(txt); assert.ok(r.ok, r.error); assert.equal(r.project.edit.transcript.segs.length, 6);
  assert.equal(M.sanitizeEdit({ transcript: { segs: [{ a: 2, b: 1, text: 'x' }] } }).transcript.segs.length, 0);
});
