import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from '../dist/i18n.mjs';

const app = readFileSync(new URL('../dist/app.mjs', import.meta.url), 'utf8');

test('runtime locale resolves at message time and every catalog call has a real key', () => {
  assert.match(app, /import\s*\{[^}]*localeFromSearch[^}]*t[^}]*translateBackend[^}]*\}\s*from\s*['"]\.\/i18n\.mjs/);
  assert.match(app, /function lang\(\)\s*\{[^}]*localeFromSearch\(location\.search\)/);
  for (const [, key] of app.matchAll(/\bt\(['"]([^'"]+)['"],\s*lang\(\)/g)) assert.ok(catalog[key], `Missing catalog key: ${key}`);
});

test('dynamic UI paths use catalog, including source, points, preview, history, and confirmations', () => {
  for (const key of ['status.scan','status.workerFailure','status.measurementBlocked','status.progress','status.dropFailure','status.sourceGrid','status.reducedGrid','status.cleanupPreview','status.oversized','status.adaptivePreview','action.shapeAccepted','action.history','action.pointsReady','confirm.reset','confirm.shape','confirm.cleanup','confirm.adaptive']) {
    assert.ok(app.includes(`t('${key}',lang()`) || app.includes(`'${key}'`) && app.includes('msg('), `${key} not wired to runtime locale`);
  }
  assert.doesNotMatch(app, /(?:status|action)\(['"](?:Сканирование|Не удалось|Shape-aware|Navigate:|Segment:)/);
});

test('worker output and nested reasons are translated at display time, not at scan start', () => {
  assert.match(app, /translateBackend\(data\.message,lang\(\)\)/);
  assert.match(app, /translateBackend\(data\.text,lang\(\)\)/);
  assert.match(app, /translateBackend\(result\.reason,lang\(\)\)/);
  assert.match(app, /translateBackend\(result\.warning,lang\(\)\)/);
  assert.match(app, /translateBackend\(w,lang\(\)\)/);
  assert.match(app, /function describeLocalizedInput\(files,isDirectory\).*t\('input\.description',lang\(\)/);
  assert.match(app, /status\(t\('status\.scan',lang\(\)/);
});
