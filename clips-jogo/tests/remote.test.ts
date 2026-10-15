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
