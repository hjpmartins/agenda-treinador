import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addStroke,
  clearMoment,
  crossedMoment,
  findMoment,
  groupByMotive,
  normalizeTrim,
  undoStroke,
  type Stroke,
} from '../src/lib/annotations.ts';

const s = (color = '#fff'): Stroke => ({ tool: 'arrow', color, points: [[0.1, 0.1], [0.5, 0.5]] });

test('traços no mesmo instante juntam-se no mesmo momento', () => {
  let m = addStroke([], 1000, s('a'));
  m = addStroke(m, 1020, s('b'));
  m = addStroke(m, 3000, s('c'));
  assert.equal(m.length, 2);
  assert.equal(m[0].strokes.length, 2);
  assert.equal(findMoment(m, 990)?.atMs, 1000);
  assert.equal(findMoment(m, 2000), undefined);
});

test('desfazer e apagar', () => {
  let m = addStroke(addStroke([], 1000, s()), 1000, s());
  m = undoStroke(m, 1000);
  assert.equal(m[0].strokes.length, 1);
  m = undoStroke(m, 1000);
  assert.equal(m.length, 0);
  m = clearMoment(addStroke([], 500, s()), 510);
  assert.equal(m.length, 0);
});

test('a reprodução para nos momentos atravessados, não em saltos', () => {
  const m = addStroke([], 2000, s());
  assert.equal(crossedMoment(m, 1950, 2010)?.atMs, 2000);
  assert.equal(crossedMoment(m, 2000, 2050), undefined);
  assert.equal(crossedMoment(m, 0, 5000), undefined); // arrastou a barra
});

test('corte', () => {
  assert.equal(normalizeTrim({ startMs: 0, endMs: 10000 }, 10000), null);
  assert.deepEqual(normalizeTrim({ startMs: 2000 }, 10000), { startMs: 2000, endMs: 10000 });
  assert.deepEqual(normalizeTrim({ startMs: 5000, endMs: 5200 }, 10000), { startMs: 5000, endMs: 6000 });
  assert.deepEqual(normalizeTrim({ startMs: 9800, endMs: 9900 }, 10000), { startMs: 8900, endMs: 9900 });
});

test('agrupar por motivo', () => {
  const clips = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const g = groupByMotive(clips, { a: { motive: 'Y' }, b: { motive: 'X' }, c: { motive: 'Y' } }, ['X', 'Y', 'Z']);
  assert.deepEqual(g.map((x) => [x.motive, x.clips.length]), [['X', 1], ['Y', 2]]);
});

import { groupByPlayer, parseRosterLink, playerLabel, togglePlayer } from '../src/lib/annotations.ts';

test('plantel enviado pela Agenda', () => {
  const data = [{ n: '8', nome: 'Carlota Raquel' }, { n: '00', nome: 'Matilde Vaz' }, { n: '', nome: '' }, { n: '13', nome: 'Petra' }];
  const r = parseRosterLink(`clipsjogo://plantel?d=${encodeURIComponent(JSON.stringify(data))}`);
  assert.deepEqual(r?.map((p) => p.n), ['00', '8', '13']);
  assert.equal(parseRosterLink('clipsjogo://outra'), null);
  assert.equal(parseRosterLink('clipsjogo://plantel?d=lixo'), null);
  assert.equal(playerLabel({ n: '8', nome: 'Carlota Raquel' }), '#8 Carlota');
  assert.equal(playerLabel({ n: '', nome: 'Ana' }), 'Ana');
});

test('jogadoras nos clips', () => {
  assert.deepEqual(togglePlayer(undefined, '8'), ['8']);
  assert.deepEqual(togglePlayer(['8', '5'], '8'), ['5']);
  const roster = [{ n: '5', nome: 'A' }, { n: '8', nome: 'B' }, { n: '9', nome: 'C' }];
  const g = groupByPlayer([{ id: 'x' }, { id: 'y' }], { x: { players: ['8', '5'] }, y: { players: ['8'] } }, roster);
  assert.deepEqual(g.map((x) => [x.player.n, x.clips.length]), [['5', 1], ['8', 2]]);
});
