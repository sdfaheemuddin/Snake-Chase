import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('single always-on 9:16 portrait frame fits both available width and height', () => {
  const frame = css.substring(css.lastIndexOf('/* ONE portrait game frame'));
  assert.ok(frame.length > 1500);
  assert.match(frame, /\.app-shell\s*\{[^}]*aspect-ratio:9\s*\/\s*16;/);
  assert.match(frame, /width:min\(100vw,56\.25dvh,var\(--game-frame-max-width\)\)/);
  assert.match(frame, /height:min\(100dvh,177\.777778vw,var\(--game-frame-max-height\)\)/);
  assert.match(frame, /body\s*\{[^}]*place-items:center/);
  assert.match(frame, /container-type:inline-size/);
});

test('portrait frame scales typography with its own width, including narrow landscape frames', () => {
  assert.match(css, /\.stat-value\{font-size:clamp\([^}]*cqw/);
  assert.match(css, /@container \(max-width:300px\)/);
  assert.match(css, /\.speed-row \.lives-group\{grid-column:1 \/ -1/);
  assert.ok(!css.includes('/* Desktop / tablet landscape: present the game'));
});

test('versioned stylesheet and offline cache match', () => {
  assert.match(html, /href="\.\/styles\.css\?v=14"/);
  assert.match(sw, /snake-chase-pwa-/);
  assert.match(sw, /\$\{CACHE_PREFIX\}v14/);
  assert.ok(sw.includes("'./styles.css?v=14'"));
});
