import test from 'node:test';
import assert from 'node:assert/strict';
import { findJpegs } from '../js/raw.js';
import { kindOf, isRaw } from '../js/media.js';

// JPEG mínimo: SOI, APP1 (com uma JPEG pequena dentro), SOS, dados com FF00 escapado e RST, EOI
function jpeg(payload, inner = []) {
  const app1 = [0xff, 0xe1, 0, 2 + inner.length, ...inner];
  const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0];
  return [0xff, 0xd8, ...app1, ...sos, ...payload, 0xff, 0xd9];
}
test('acha a JPEG grande sem se perder na miniatura de dentro nem no FF escapado', () => {
  const thumb = jpeg([1, 2, 3]);
  const big = jpeg([...new Array(500).fill(7), 0xff, 0x00, 9, 0xff, 0xd3, 4, 5], thumb);
  const file = new Uint8Array([0x49, 0x49, 0x2a, 0, 1, 2, 3, ...jpeg([5, 5]), 9, 9, ...big, 0, 0]);
  const j = findJpegs(file);
  assert.equal(j.length, 2);
  assert.equal(j[0].size, big.length);
  assert.equal(file[j[0].end - 1], 0xd9);
});
test('formatos de câmera viram o tipo certo', () => {
  for (const n of ['DJI_20261004074148_0127_D.LRF', 'GX010.LRV', 'VID.insv', '00001.MTS', 'C0001.MXF']) assert.equal(kindOf(n), 'video', n);
  for (const n of ['PA170004.ORF', 'P1000123.RW2', 'IMG.CR3', 'DSC.NEF', 'A.ARW', 'X.RAF', 'Y.DNG']) { assert.equal(kindOf(n), 'image', n); assert.ok(isRaw(n), n); }
  assert.ok(!isRaw('a.jpg'));
});
