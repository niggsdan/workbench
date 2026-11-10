import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/grade.js';

const px = (r, g, b) => new Uint8ClampedArray([r, g, b, 255]);
const run = (grade, d, cubes) => { G.applyGrade(d, [G.compileGrade(grade, cubes)]); return d; };

test('grade padrão é neutra e não mexe na imagem', () => {
  const g = G.defaultGrade(); const c = G.compileGrade(g);
  assert.equal(c.neutral, true);
  assert.deepEqual([...run(g, px(10, 120, 250))], [10, 120, 250, 255]);
});
test('contraste abre as luzes e fecha as sombras em torno do pivô', () => {
  const g = G.defaultGrade(); g.serial[0].prim.contrast = 1.5;
  const d = run(g, new Uint8ClampedArray([200, 200, 200, 255, 40, 40, 40, 255]));
  assert.ok(d[0] > 200 && d[4] < 40);
});
test('temperatura negativa esfria: menos vermelho, mais azul', () => {
  const g = G.defaultGrade(); g.serial[0].prim.temp = -300;
  const d = run(g, px(128, 128, 128));
  assert.ok(d[0] < 128 && d[2] > 128);
});
test('saturação 0 vira cinza', () => {
  const g = G.defaultGrade(); g.serial[0].prim.sat = 0;
  const d = run(g, px(200, 50, 50));
  assert.ok(Math.abs(d[0] - d[1]) < 3 && Math.abs(d[1] - d[2]) < 3);
});
test('roda: puck <-> vetor é reversível', () => {
  const p = [0.4, -0.3]; const v = G.puckToVec(p, 0.5);
  assert.ok(Math.abs(v[0] + v[1] + v[2]) < 1e-9);
  const q = G.vecToPuck(v, 0.5); assert.ok(Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9);
});
test('nó em bypass não altera', () => {
  const g = G.defaultGrade(); g.serial[0].prim.contrast = 2; g.serial[0].on = false;
  assert.deepEqual([...run(g, px(200, 30, 30))], [200, 30, 30, 255]);
});
test('curva em S escurece sombras e clareia luzes', () => {
  const g = G.defaultGrade(); g.serial[1].pts = [[0, 0], [0.25, 0.15], [0.5, 0.5], [0.75, 0.85], [1, 1]];
  const d = run(g, new Uint8ClampedArray([64, 64, 64, 255, 192, 192, 192, 255]));
  assert.ok(d[0] < 64 && d[4] > 192);
});
test('qualificador de pele só mexe em tons de pele', () => {
  const g = G.defaultGrade(); g.par[0].adj.hue = 0; g.par[0].adj.sat = 80;
  const d = run(g, new Uint8ClampedArray([205, 140, 110, 255, 60, 90, 200, 255]));
  assert.ok(d[0] !== 205 || d[1] !== 140 || d[2] !== 110, 'pele mudou');
  assert.deepEqual([...d.slice(4, 8)], [60, 90, 200, 255]); // azul fica
});
test('.cube: bakeCube -> parseCube -> aplicar reproduz a grade', () => {
  const g = G.defaultGrade(); g.serial[0].prim.contrast = 1.3; g.serial[0].prim.temp = 200;
  const comp = G.compileGrade(g);
  const text = G.bakeCube([comp], 17, 'teste');
  assert.match(text, /LUT_3D_SIZE 17/);
  const cube = G.parseCube(text); assert.equal(cube.size, 17); assert.equal(cube.title, 'teste');
  const g2 = G.defaultGrade(); g2.serial[0].lut = 'x';
  const a = px(180, 100, 60); const b = px(180, 100, 60);
  G.applyGrade(a, [comp]); G.applyGrade(b, [G.compileGrade(g2, { x: cube })]);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) <= 3, 'canal ' + i + ': ' + a[i] + ' vs ' + b[i]);
});
test('.cube inválido dá erro claro', () => {
  assert.throws(() => G.parseCube('LUT_1D_SIZE 4\n0 0 0'), /1D/);
  assert.throws(() => G.parseCube('TITLE x'), /LUT_3D_SIZE/);
  assert.throws(() => G.parseCube('LUT_3D_SIZE 2\n0 0 0'), /incompleto/);
});
test('paleta separa claros, médios e escuros', () => {
  const d = new Uint8ClampedArray(4 * 300);
  for (let i = 0; i < 300; i++) { const v = i < 100 ? 240 : i < 200 ? 120 : 20; d.set([v, v * 0.8, v * 0.6, 255], i * 4); }
  const [cl, me, es] = G.extractPalette(d);
  const l = (h) => G.hexToRgb(h)[0];
  assert.ok(l(cl[0]) > 200 && l(me[0]) > 80 && l(me[0]) < 160 && l(es[0]) < 60);
});
test('ponto de partida: referência quente puxa a grade pro quente', () => {
  const cur = [['#d0d0d0'], ['#808080'], ['#202020']]; const ref = [['#f0c070'], ['#a07030'], ['#201008']];
  const p = G.primFromPalettes(cur, ref); const v = G.puckToVec(p.gain, G.WHEEL_K.gain);
  assert.ok(v[0] > v[2], 'mais vermelho que azul no gain');
});
test('scopes e histograma contam todos os pixels', () => {
  const d = new Uint8ClampedArray(4 * 16).fill(100);
  assert.equal(G.histogram(d)[3].reduce((a, b) => a + b, 0), 16);
  assert.equal(G.waveform(d, 4, 4, 4, 8).grid.reduce((a, b) => a + b, 0), 16);
});
test('halation só acende perto das luzes', () => {
  const w = 16; const h = 16; const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([20, 20, 20, 255], i * 4);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) data.set([255, 255, 255, 255], (y * w + x) * 4);
  const o = G.bloom({ data, w, h }, 0.6, 0.3);
  assert.ok(o[(8 * w + 8) * 4] > 10 && o[(8 * w + 8) * 4] > o[0]);
});
test('master da roda: lift Y levanta os pretos, gain Y abaixa as luzes', () => {
  const g = G.defaultGrade(); g.serial[0].prim.liftY = 0.4; g.serial[0].prim.gainY = -0.3;
  const d = run(g, new Uint8ClampedArray([5, 5, 5, 255, 240, 240, 240, 255]));
  assert.ok(d[0] > 20, 'preto subiu'); assert.ok(d[4] < 230, 'luz desceu');
});
test('paleta: cor igual à do material vai pra cor do filme', () => {
  const src = [['#e0e0e0'], ['#808080'], ['#202020']]; const dst = [['#f0d0a0'], ['#a06030'], ['#301808']];
  const f = G.palTransfer(src, dst, { amount: 1 });
  const m = f(128, 128, 128); assert.ok(m[0] > 140 && m[2] < 90, 'médio esquentou: ' + m.map(Math.round));
  const g = G.defaultGrade(); g.serial.push(G.newNode('pal', { src, dst })); const d = run(g, px(128, 128, 128));
  assert.ok(d[0] > d[2] + 30); g.serial[2].amount = 0; assert.deepEqual([...run(g, px(128, 128, 128))], [128, 128, 128, 255]);
});
