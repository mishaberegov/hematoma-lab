import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from '../dist/i18n.mjs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8');

test('action-first layout keeps three columns and all view controls', () => {
  assert.match(html, /class="workspace-column"/);
  assert.match(html, /class="marker-panel panel"/);
  assert.match(html, /class="morph-panel panel"/);
  assert.match(css, /\.tools-layout\s*\{[^}]*grid-template-columns:\s*minmax\([^;]+\)\s+minmax\([^;]+\)\s+minmax\([^;]+\)/);
  assert.match(css, /@media\s*\(max-width:\s*\d+px\)/);
  for (const id of ['series','load','radius','samplingPreview','samplingCircle','samplingNote','samplingPlane','morphStatus','adaptiveStatus','morphPreview','level','width','axial','coronal','sagittal']) assert.match(html, new RegExp(`id="${id}"`));
});

test('cursor and history replace visible interaction and redo controls', () => {
  assert.match(html, /<button id="cursorMode" type="button" aria-pressed="true"/);
  assert.doesNotMatch(html, /id="redo"/);
  assert.doesNotMatch(html, /name="interaction"/);
  assert.match(html, /id="undo"/);
  assert.match(html, /id="resetSegmentation"/);
  assert.match(html, /name="tool"/);
  assert.match(html, /name="morphOperation"/);
});
test('3D cursor button matches the desktop Opening control dimensions', () => {
  assert.match(css, /#cursorMode\s*\{[^}]*width:132px;[^}]*height:39px/);
});

test('local-only source bar uses buttons and hidden native file pickers', () => {
  assert.match(html, /<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"><\/rect><path d="M8 10V7a4 4 0 0 1 8 0v3"><\/path><\/symbol>/);
  assert.match(html, /class="local-badge"[^>]*><svg[^>]*><use href="#i-lock"/);
  assert.match(html, /<button id="pickFiles" type="button"/);
  assert.match(html, /<button id="pickFolder" type="button"/);
  assert.match(html, /<input id="files" type="file"[^>]*multiple/);
  assert.match(html, /<input id="folder" type="file"[^>]*webkitdirectory[^>]*multiple/);
  assert.match(css, /\.local-badge\s*\{[^}]*display:flex;[^}]*align-items:center;[^}]*gap:7px;[^}]*color:#a7b8b1;[^}]*font-size:11px/);
  assert.match(css, /\.local-badge svg\s*\{[^}]*width:14px;[^}]*height:14px/);
});

test('every static translation key resolves in both languages', () => {
  const keys = [...html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)].map(match => match[1]);
  for (const key of keys) assert.ok(catalog[key]?.en && catalog[key]?.ru, `missing ${key}`);
  assert.ok(keys.includes('source.dropAnywhere'));
  assert.ok(keys.includes('controls.cursor'));
});
