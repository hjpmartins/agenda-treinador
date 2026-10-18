import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampZoom, cropToZoom, doubleTapZoom, NO_ZOOM, pinchZoom, zoomToCrop } from '../src/lib/zoom.ts';

test('clampZoom: sem zoom não se desloca; com zoom fica dentro da caixa', () => {
  assert.deepEqual(clampZoom({ s: 0.5, x: 30, y: -10 }, 1000, 500), NO_ZOOM);
  assert.deepEqual(clampZoom({ s: 2, x: 900, y: -900 }, 1000, 500), { s: 2, x: 500, y: -250 });
});

test('pinchZoom: o ponto debaixo dos dedos fica no mesmo sítio', () => {
  const z = pinchZoom(NO_ZOOM, { x: 750, y: 250 }, 100, { x: 750, y: 250 }, 200, 1000, 500);
  assert.equal(z.s, 2);
  // Ponto 250 px à direita do centro: com 2x tem de ir 250 px para a esquerda para ficar no mesmo sítio.
  assert.equal(z.x, -250);
  assert.equal(z.y, 0);
});

test('doubleTapZoom: aproxima e depois volta ao normal', () => {
  const z = doubleTapZoom(NO_ZOOM, { x: 500, y: 250 }, 1000, 500);
  assert.deepEqual(z, { s: 2.5, x: 0, y: 0 });
  assert.deepEqual(doubleTapZoom(z, { x: 10, y: 10 }, 1000, 500), NO_ZOOM);
});

test('zoomToCrop / cropToZoom: ida e volta', () => {
  assert.equal(zoomToCrop(NO_ZOOM, 1000, 500), null);
  // 2x a mostrar o quarto de cima à esquerda.
  const z = { s: 2, x: 500, y: 250 };
  assert.deepEqual(zoomToCrop(z, 1000, 500), [0, 0, 0.5, 0.5]);
  assert.deepEqual(cropToZoom([0, 0, 0.5, 0.5], 1000, 500), z);
  // Centro.
  assert.deepEqual(zoomToCrop({ s: 2, x: 0, y: 0 }, 1000, 500), [0.25, 0.25, 0.5, 0.5]);
});
