import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextToPrune, sessionsToPrune } from '../src/lib/retention.ts';

const c = (sessionId: string, createdAtMs: number) => ({ sessionId, createdAtMs });

test('ficam só os 3 jogos mais recentes', () => {
  const clips = [c('a', 1), c('a', 5), c('b', 2), c('c', 3), c('d', 4)];
  // a (5) > d (4) > c (3) > b (2)
  assert.deepEqual(sessionsToPrune(clips), ['b']);
  assert.deepEqual(sessionsToPrune(clips.slice(0, 3)), []);
});

test('aviso: qual será apagado no próximo jogo', () => {
  assert.equal(nextToPrune([c('a', 1), c('b', 2), c('c', 3)]), 'a');
  assert.equal(nextToPrune([c('a', 1), c('b', 2)]), null);
});
