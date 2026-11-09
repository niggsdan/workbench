import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates, selectCuts, frameDiff } from '../js/detect.js';

function serie({ dur = 10, step = 0.1, base = 0.02, spikes = {} }) {
  const out = [];
  for (let i = 1; i <= Math.round(dur / step); i++) {
    const t = Math.round(i * step * 10) / 10;
    out.push({ t, d: spikes[t] != null ? spikes[t] : base });
  }
  return out;
}

test('frameDiff: igual = 0, preto x branco = alto', () => {
  const a = new Uint8Array(100).fill(10);
  const b = new Uint8Array(100).fill(250);
  assert.equal(frameDiff(a, a), 0);
  assert.ok(frameDiff(a, b) > 0.9);
  assert.equal(frameDiff(a, new Uint8Array(5)), 0);
});

test('picos viram candidatos e a nota acompanha a força do corte', () => {
  const c = candidates(serie({ spikes: { 3: 0.6, 7: 0.3 } }));
  assert.deepEqual(c.map((x) => x.t), [3, 7]);
  assert.ok(c[0].score > c[1].score);
});

test('movimento contínuo (diferença alta e constante) não gera corte', () => {
  const c = candidates(serie({ base: 0.3 }));
  assert.equal(c.length, 0);
});

test('sensibilidade escolhe mais cortes, sem reanalisar', () => {
  const c = candidates(serie({ spikes: { 3: 0.6, 5: 0.1, 7: 0.3, 8.6: 0.15 } }));
  const por = [0, 1, 2, 3, 4].map((s) => selectCuts(c, s, 10).length);
  assert.deepEqual(por, [...por].sort((a, b) => a - b));
  assert.equal(por[0], 1);
  assert.ok(por[4] > por[0]);
});

test('dois picos colados ficam só com o mais forte', () => {
  const c = candidates(serie({ spikes: { 4: 0.5, 4.2: 0.3 } }));
  assert.deepEqual(c.map((x) => x.t), [4]);
});

test('corte colado no começo ou no fim é ignorado', () => {
  const c = [{ t: 0.2, score: 1 }, { t: 9.9, score: 1 }, { t: 5, score: 1 }];
  assert.deepEqual(selectCuts(c, 2, 10), [5]);
});
