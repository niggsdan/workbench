import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOf, fmtSize, roleOfPath, parseDriveLink, downloadName, extOf } from '../js/media.js';
import { Library } from '../js/library.js';

test('tipo de mídia por extensão e por mime', () => {
  assert.equal(kindOf('fala_01.MOV', ''), 'video');
  assert.equal(kindOf('cena.mxf', ''), 'video');
  assert.equal(kindOf('trilha.wav', ''), 'audio');
  assert.equal(kindOf('foto.HEIC', ''), 'image');
  assert.equal(kindOf('sem-extensao', 'video/mp4'), 'video');
  assert.equal(kindOf('legenda.srt', 'application/x-subrip'), 'other');
  assert.equal(kindOf('app.ts', 'video/mp2t'), 'video'); // .ts não é extensão de vídeo, vale o mime
  assert.equal(kindOf('app.ts', 'text/plain'), 'other');
});

test('tamanho legível em português', () => {
  assert.equal(fmtSize(0), '0 B');
  assert.equal(fmtSize(1536), '1,5 KB');
  assert.equal(fmtSize(5 * 1024 * 1024), '5,0 MB');
  assert.equal(fmtSize(300 * 1024 * 1024), '300 MB');
  assert.equal(fmtSize(-1), '');
});

test('papel vem da pasta, com ou sem acento e maiúscula', () => {
  assert.equal(roleOfPath('Dia feliz em Sorocaba/Falas/fala_01.mov'), 'Falas');
  assert.equal(roleOfPath('Dia feliz/CENAS/praca.mp4'), 'Cenas');
  assert.equal(roleOfPath('Projeto/Ambiente/estrada.mp4'), 'Cenas');
  assert.equal(roleOfPath('Projeto/Overlays/super8.mov'), 'Overlays');
  assert.equal(roleOfPath('Projeto/Entrevistas/a.mov'), 'Falas');
  assert.equal(roleOfPath('Projeto/Outras/x.mp4'), 'Outros');
  assert.equal(roleOfPath('Falas.mp4'), 'Outros'); // nome de arquivo não conta, só pasta
});

test('link do Drive: pasta, id= e id puro', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
  assert.equal(parseDriveLink('https://drive.google.com/drive/folders/' + id + '?usp=sharing'), id);
  assert.equal(parseDriveLink('https://drive.google.com/drive/u/0/folders/' + id), id);
  assert.equal(parseDriveLink('https://drive.google.com/open?id=' + id), id);
  assert.equal(parseDriveLink(id), id);
  assert.equal(parseDriveLink('https://exemplo.com/abc'), null);
  assert.equal(parseDriveLink(''), null);
});

test('nome de download limpo e com sufixo', () => {
  assert.equal(downloadName('a/b:c.mov'), 'a_b_c.mov');
  assert.equal(downloadName('fala_01.mov', '_convertido.mp4'), 'fala_01_convertido.mp4');
  assert.equal(extOf('x.tar.gz'), 'gz');
});

test('biblioteca: não duplica e agrupa por papel', () => {
  const lib = new Library();
  const a = lib.add({ name: 'fala_01.mov', path: 'P/Falas/fala_01.mov', size: 10 });
  const b = lib.add({ name: 'fala_01.mov', path: 'P/Falas/fala_01.mov', size: 10 });
  assert.equal(a, b);
  lib.add({ name: 'praca.mp4', path: 'P/Cenas/praca.mp4', size: 5 });
  lib.add({ name: 'musica.mp3', path: 'musica.mp3', size: 3 });
  lib.add({ name: 'nota.pdf', path: 'nota.pdf', size: 1, mime: 'application/pdf' });
  const g = lib.byRole();
  assert.deepEqual([g.Falas.length, g.Cenas.length, g.Overlays.length, g.Outros.length], [1, 1, 0, 2]);
  assert.deepEqual(lib.counts(), { video: 2, audio: 1, image: 0, other: 1 });
  assert.equal(lib.get(a.id), a);
});
