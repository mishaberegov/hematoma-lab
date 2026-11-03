import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8');
const header = html.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0] || '';
const morphology = html.match(/<section class="morph-panel panel"[\s\S]*?<\/section>/)?.[0] || '';

test('language links precede the on-device badge as in registration', () => {
  assert.match(header, /class="language-switch"[\s\S]*?id="lang-en"[\s\S]*?id="lang-ru"[\s\S]*?class="local-badge"/);
  assert.doesNotMatch(header, /class="header-divider"/);
});

test('three desktop panels share one visual bottom edge and mobile can size naturally', () => {
  assert.match(css, /\.tools-layout\{[^}]*align-items:stretch/);
  assert.match(css, /\.workspace-column\{[^}]*height:100%/);
  assert.match(css, /\.workspace-column \.diameter-panel\{[^}]*flex:1/);
  assert.match(css, /\.workspace-column \.sampling-preview\{[^}]*flex:1/);
  assert.match(css, /@media\(max-width:720px\)\{[^\n]*\.workspace-column \.diameter-panel\{[^}]*flex:none/);
});

test('Opening and Closing are unselected, disabled native buttons until there is accepted mask', () => {
  for (const value of ['open', 'close']) {
    assert.match(morphology, new RegExp(`<input type="radio" name="morphOperation" value="${value}" disabled><span`));
  }
  assert.doesNotMatch(morphology, /name="morphOperation"[^>]*checked/);
  assert.match(morphology, /id="morphPreview"[^>]*disabled/);
  assert.match(css, /\.tool-buttons input:disabled\+span\{[^}]*opacity:[^;}]+/);
  assert.match(css, /\.tool-buttons input:disabled\+span\{[^}]*cursor:not-allowed/);
});

test('morphology preview and cursor control identifiers stay wired for the behavior layer', () => {
  for (const id of ['cursorMode', 'morphRadius', 'morphPreview', 'morphAccept', 'morphDiscard', 'morphStatus']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
