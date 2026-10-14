import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromMarks, lastSeconds } from '../src/lib/clipRange.ts';
import { formatClock, formatHoursMinutes, recordingTimeLeftMs } from '../src/lib/format.ts';

test('últimos 20s aos 13:00 de gravação', () => {
  assert.deepEqual(lastSeconds(13 * 60_000, 20), { startMs: 760_000, endMs: 780_000 });
});

test('ajustes de ±5s no início e no fim', () => {
  assert.deepEqual(lastSeconds(100_000, 10, -5_000, 5_000), { startMs: 85_000, endMs: 105_000 });
});

test('início nunca é negativo', () => {
  assert.deepEqual(lastSeconds(4_000, 30), { startMs: 0, endMs: 4_000 });
});

test('duração mínima de 2s', () => {
  assert.deepEqual(lastSeconds(10_000, 10, 15_000, 0), { startMs: 15_000, endMs: 17_000 });
});

test('marcas por qualquer ordem', () => {
  assert.deepEqual(fromMarks(50_000, 20_000), { startMs: 20_000, endMs: 50_000 });
});

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(754_000), '12:34');
  assert.equal(formatClock(3_754_000), '1:02:34');
});

test('tempo restante conta com o vídeo final (dobro do espaço)', () => {
  assert.equal(recordingTimeLeftMs(2_000_000, 1_000), 1_000_000);
  assert.equal(formatHoursMinutes(95 * 60_000), '1 h 35');
});
