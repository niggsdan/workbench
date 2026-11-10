import test from 'node:test';
import assert from 'node:assert/strict';
import { EYECANDY, CATS } from '../js/eyecandy.js';
import * as F from '../js/fx.js';
import * as M from '../js/model.js';

test('catálogo do Eyecandy: nomes e links únicos, categoria válida', () => {
  assert.ok(EYECANDY.length >= 130);
  assert.equal(new Set(EYECANDY.map((r) => r.slug)).size, EYECANDY.length);
  assert.equal(new Set(EYECANDY.map((r) => r.name)).size, EYECANDY.length);
  for (const r of EYECANDY) { assert.ok(CATS[r.cat], r.name); assert.ok(r.hint.length > 3, r.name); }
});
test('toda técnica marcada como feita aqui aponta pra um efeito que existe', () => {
  for (const r of EYECANDY.filter((x) => x.fx)) {
    if (r.fx.startsWith('tex:')) assert.ok(F.texOf(r.fx.slice(4)), r.name);
    else if (r.fx.startsWith('text:')) assert.ok(F.TEXT_VARIANTS[r.fx.slice(5)], r.name);
    else { assert.ok(F.techOf(r.fx), r.name + ' -> ' + r.fx); const it = F.newTech(r.fx, 1, 20); assert.ok(it.b > it.a, r.name); F.fxState([it], it.a + 0.01); }
  }
  assert.ok(EYECANDY.filter((x) => x.fx).length >= 40);
});
test('efeitos novos aparecem no estado de efeito; slow e fast mudam a velocidade', () => {
  const k = F.newTech('kaleido', 0, 10); assert.equal(F.fxState([k], 1).looks[0].key, 'kaleido');
  assert.equal(F.fxState([F.newTech('slow', 0, 10)], 1).rate, 0.5);
  assert.equal(F.fxState([F.newTech('fast', 0, 10)], 1).rate, 2.5);
  const l = F.newLang(EYECANDY.find((r) => r.slug === 'aerial'), 2, 10); assert.equal(F.fxState([l], 2.5).looks.length, 0); assert.match(F.recipeOf(l), /Marcador de linguagem/);
});
test('paleta da referência em uso vira a paleta do projeto', () => {
  const e = M.newEdit(); assert.equal(M.refPalette(e), null);
  const pal = [['#ffffff'], ['#808080'], ['#000000']]; e.cinema[1].pal = pal; assert.deepEqual(M.refPalette(e), pal);
  const s = M.sanitizeEdit(JSON.parse(JSON.stringify(e))); assert.deepEqual(s.cinema[1].pal, pal); assert.equal(s.cinema[0].dp, 'César Charlone');
  assert.equal(M.sanitizeEdit({ cinema: [{ key: 'x', name: 'X', dir: 'Dir. Fulano', pal: 'ruim' }] }).cinema[0].dir, 'Fulano');
});
