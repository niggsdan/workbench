import test from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../js/history.js';

test('desfazer e refazer andam pela pilha', () => {
  const h = new History({ n: 0 });
  h.push({ n: 1 }, 'um');
  h.push({ n: 2 }, 'dois');
  assert.equal(h.current.n, 2);
  assert.equal(h.undoLabel, 'dois');
  h.undo();
  assert.equal(h.current.n, 1);
  assert.equal(h.redoLabel, 'dois');
  h.redo();
  assert.equal(h.current.n, 2);
  assert.equal(h.redo(), false);
});

test('ação nova depois de desfazer joga fora o que dava pra refazer', () => {
  const h = new History({ n: 0 });
  h.push({ n: 1 }, 'um');
  h.push({ n: 2 }, 'dois');
  h.undo();
  h.push({ n: 9 }, 'nove');
  assert.equal(h.canRedo, false);
  assert.equal(h.total, 3);
  h.undo();
  assert.equal(h.current.n, 1);
});

test('gesto contínuo com a mesma chave vira um passo só', () => {
  const h = new History({ v: 50 });
  for (const v of [51, 60, 70, 80]) h.push({ v }, 'Posição', 'ox:0');
  assert.equal(h.total, 2);
  assert.equal(h.current.v, 80);
  h.undo();
  assert.equal(h.current.v, 50);
});

test('seal separa dois gestos seguidos', () => {
  const h = new History({ v: 0 });
  h.push({ v: 1 }, 'a', 'k');
  h.seal();
  h.push({ v: 2 }, 'a', 'k');
  assert.equal(h.total, 3);
});

test('limite descarta os passos mais antigos', () => {
  const h = new History({ n: 0 }, 'Início', 5);
  for (let i = 1; i <= 10; i++) h.push({ n: i }, 'p' + i);
  assert.equal(h.total, 5);
  assert.equal(h.current.n, 10);
});

test('snapshot é cópia: mexer no objeto depois não muda o histórico', () => {
  const s = { list: [1] };
  const h = new History(s);
  s.list.push(2);
  assert.deepEqual(h.current.list, [1]);
});
