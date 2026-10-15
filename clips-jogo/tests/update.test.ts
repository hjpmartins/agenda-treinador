import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions, pickUpdate } from '../src/lib/update.ts';

const rel = (tag: string, extra: object = {}) => ({
  tag_name: tag,
  body: `notas ${tag}`,
  assets: [{ name: `${tag}.apk`, browser_download_url: `https://x/${tag}.apk`, size: 100 }],
  ...extra,
});

test('comparação de versões', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.ok(compareVersions('0.5.0', '0.5') === 0);
  assert.ok(compareVersions('0.4.3', '0.5.0') < 0);
});

test('escolhe a versão mais recente, ignorando outras releases', () => {
  const r = pickUpdate(
    [rel('clips-jogo-v0.5.0'), rel('agenda-v9.0.0'), rel('clips-jogo-v0.6.1'), rel('clips-jogo-v0.6.0')],
    '0.4.3',
  );
  assert.equal(r?.version, '0.6.1');
  assert.equal(r?.apkUrl, 'https://x/clips-jogo-v0.6.1.apk');
});

test('nada a fazer se já está atualizada', () => {
  assert.equal(pickUpdate([rel('clips-jogo-v0.5.0')], '0.5.0'), null);
  assert.equal(pickUpdate([rel('clips-jogo-v0.4.0')], '0.5.0'), null);
});

test('ignora rascunhos, pré-versões e releases sem APK', () => {
  assert.equal(
    pickUpdate(
      [rel('clips-jogo-v1.0.0', { draft: true }), rel('clips-jogo-v0.9.0', { prerelease: true }), rel('clips-jogo-v0.8.0', { assets: [] })],
      '0.5.0',
    ),
    null,
  );
  assert.equal(pickUpdate({ message: 'rate limit' }, '0.5.0'), null);
});
