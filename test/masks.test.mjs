import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../js/masks.js';

test('máscara anda entre keyframes e segura nas pontas', () => {
  let m = K.newMask('blur', 1, 10, 'x');
  m = K.setShapeAt(m, 3, { x: 0.9, y: 0.45, w: 0.4, h: 0.35 });
  assert.equal(m.shapeKf.length, 2);
  assert.equal(K.shapeAt(m, 0).x, 0.5); assert.equal(K.shapeAt(m, 5).x, 0.9);
  assert.ok(Math.abs(K.shapeAt(m, 2).x - 0.7) < 1e-9);
  m = K.setShapeAt(m, 3.01, { x: 0.8, y: 0.45, w: 0.4, h: 0.35 }); assert.equal(m.shapeKf.length, 2, 'mesmo ponto não cria outro');
  assert.equal(K.shapeAt(m, 3).x, 0.8);
  m = K.removeKf(m, m.shapeKf[1].t); assert.equal(m.shapeKf.length, 1); assert.equal(K.removeKf(m, m.shapeKf[0].t).shapeKf.length, 1);
});
