import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClockSync, recordingTimeAt } from '../src/remote/clockSync.ts';
import { decodePairing, encodePairing } from '../src/remote/pairing.ts';

test('QR: codifica e descodifica', () => {
  const p = { ssid: 'AndroidShare_1234', passphrase: 'abc12345', security: 'wpa2', ips: ['192.168.49.1'], port: 8765, token: 'f00' };
  assert.deepEqual(decodePairing(encodePairing(p)), p);
});

test('QR: ignora códigos de outras apps', () => {
  assert.equal(decodePairing('https://exemplo.pt'), null);
  assert.equal(decodePairing('CLIPSJOGO1:{lixo'), null);
});

test('relógio: escolhe a amostra com menor ida-e-volta', () => {
  const s = new ClockSync();
  // O telemóvel está 10 000 ms à frente. Amostra lenta (assimétrica) e amostra rápida.
  s.addSample(1_000, 11_000 + 150, 1_400); // rtt 400, estimativa com erro de -50
  s.addSample(2_000, 12_010, 2_020); // rtt 20
  assert.equal(s.best?.rttMs, 20);
  assert.equal(s.remoteNow(5_000), 15_000);
});

test('relógio: tempo de gravação a partir do início no telemóvel', () => {
  const s = new ClockSync();
  s.addSample(1_000, 501_000, 1_000);
  // Gravação começou às 440 000 ms do telemóvel; agora (local 1 000) são 501 000 → 61 s de gravação.
  assert.equal(recordingTimeAt(s, 1_000, 440_000), 61_000);
  assert.equal(recordingTimeAt(s, 1_000, null), null);
  assert.equal(recordingTimeAt(new ClockSync(), 1_000, 440_000), null);
});

import { classifySignal, formatBand, LinkStats, overallQuality } from '../src/lib/linkQuality.ts';

test('classificação do sinal Wi-Fi', () => {
  assert.equal(classifySignal(-50).label, 'bom');
  assert.equal(classifySignal(-65).label, 'razoável');
  assert.equal(classifySignal(-75).label, 'fraco');
  assert.equal(classifySignal(-85).label, 'muito fraco');
  assert.equal(classifySignal(null).tone, 'neutral');
  assert.equal(formatBand(2437), '2,4 GHz');
  assert.equal(formatBand(5180), '5 GHz');
});

test('estatísticas da ligação: mediana do tempo de resposta e falhas', () => {
  const s = new LinkStats(5);
  [20, 30, 400, 25].forEach((rttMs) => s.add({ ok: true, rttMs }));
  s.add({ ok: false, rttMs: null });
  assert.deepEqual(s.summary(), { rttMs: 30, failures: 1, total: 5 });
  s.add({ ok: true, rttMs: 22 }); // a mais antiga sai
  assert.equal(s.summary().total, 5);
  assert.equal(overallQuality(-55, 30, 0, 10), 'ok');
  assert.equal(overallQuality(-55, 30, 3, 10), 'danger');
  assert.equal(overallQuality(-74, 30, 0, 10), 'warn');
});
