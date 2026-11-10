import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/seq.js';

test('sequência: clipe novo vai pro fim da faixa e ocupa faixa nova se bater', () => {
  const s = S.newSeq();
  S.addClip(s, { lib: 'a', name: 'a', kind: 'video', dur: 4 });
  const b = S.addClip(s, { lib: 'b', name: 'b', kind: 'video', dur: 3 });
  assert.equal(b.start, 4); assert.equal(b.track, 'V1');
  const c = S.addClip(s, { lib: 'c', name: 'c', kind: 'video', dur: 2, start: 1, track: 'V1' });
  assert.equal(c.track, 'V2');
  assert.equal(S.topVideoAt(s, 1.5).lib, 'c');
  assert.equal(S.seqEnd(s), 7);
});

test('sequência: cortar, aparar e limpar faixas', () => {
  const s = S.newSeq();
  const a = S.addClip(s, { lib: 'a', name: 'a', kind: 'video', dur: 4, src: 4 });
  const b = S.splitClip(s, a.id, 1.5);
  assert.deepEqual([a.dur, b.start, b.in, b.dur], [1.5, 1.5, 1.5, 2.5]);
  S.trimClip(s, b.id, 'l', 2); assert.deepEqual([b.start, b.in, b.dur], [2, 2, 2]);
  S.trimClip(s, b.id, 'r', 10); assert.equal(b.dur, 2); // não passa do fim do arquivo
  S.addTrack(s, 'video'); S.tidy(s); assert.equal(s.tracks.filter((t) => t.kind === 'video').length, 1);
  assert.equal(S.sanitizeSeq(JSON.parse(JSON.stringify(s))).clips.length, 2);
});
