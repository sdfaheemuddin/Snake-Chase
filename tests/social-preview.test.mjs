import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const gameUrl = 'https://sdfaheemuddin.github.io/Snake-Chase/';
const previewUrl = gameUrl + 'assets/snake-chase-og-v1.jpg';
const html = readFileSync(new URL('index.html', root), 'utf8');
function meta(attribute, name) {
  const row = html.split('\n').find(line => line.includes('<meta ' + attribute + '="' + name + '"'));
  return row?.match(/content="([^"]+)"/)?.[1] ?? '';
}

test('social preview URLs are absolute and consistent', () => {
  assert.ok(html.includes('<link rel="canonical" href="' + gameUrl + '">'));
  assert.equal(meta('property', 'og:url'), gameUrl);
  assert.equal(meta('property', 'og:image'), previewUrl);
  assert.equal(meta('property', 'og:image:secure_url'), previewUrl);
  assert.equal(meta('name', 'twitter:image'), previewUrl);
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
});

test('social card metadata has dimensions, title and accessible description', () => {
  assert.equal(meta('property', 'og:image:type'), 'image/jpeg');
  assert.equal(meta('property', 'og:image:width'), '1200');
  assert.equal(meta('property', 'og:image:height'), '630');
  assert.match(meta('property', 'og:title'), /Snake Chase/i);
  assert.ok(meta('property', 'og:description').length > 50);
  assert.ok(meta('property', 'og:image:alt').length > 30);
  assert.ok(meta('name', 'twitter:description').length > 30);
});

test('public preview and poster assets are nonempty JPEG images', () => {
  for (const file of ['assets/snake-chase-og-v1.jpg', 'assets/snake-chase-launch-poster.jpg']) {
    const filename = fileURLToPath(new URL(file, root));
    assert.ok(statSync(filename).size > 30000, file + ' is too small');
    assert.deepEqual([...readFileSync(filename).subarray(0, 3)], [255, 216, 255], file + ' is not JPEG');
  }
});
