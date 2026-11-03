import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog} from '../dist/i18n.mjs';
const css = readFileSync(new URL('../dist/style.css', import.meta.url), 'utf8');
import {localizeStatic, languageHref} from '../dist/localize-static.mjs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

function fakeDocument(search = '') {
  const nodes = [...html.matchAll(/<([\w-]+)\b([^<>]*\bdata-i18n(?:-aria-label|-title)?="[^"]+"[^<>]*)>/g)].map(([, tag, attrs]) => {
    const attributes = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
    return {tagName: tag.toUpperCase(), attributes, textContent: '', setAttribute(k, v) {this.attributes[k] = v;}, removeAttribute(k) {delete this.attributes[k];}, getAttribute(k) {return this.attributes[k];}};
  });
  const root = {lang: 'en'};
  const title = {textContent: ''};
  return {nodes, root, title, document: {documentElement: root, title: '', querySelectorAll() {return nodes;}, getElementById(id) {return nodes.find(n => n.getAttribute('id') === id);}}, location: {search, pathname: '/hematoma-lab-graphcut/', hash: '#view'}};
}

test('static markup covers every presented label and attribute with catalog keys', () => {
  for (const id of ['status','adaptiveStatus','morphStatus','samplingNote','samplingPlane','hint','volumeHeading','volumes','level','width','resetSegmentation','axialSlice','coronalSlice','sagittalSlice']) {
    assert.match(html, new RegExp(`(?:id="${id}"[^>]*data-i18n|data-i18n[^>]*id="${id}")`), id);
  }
  assert.match(html, /data-i18n-aria-label="views.axialSlice"/);
  for (const key of ['brand.name','units.oneMillimeter','units.twoMillimeters','units.threeMillimeters','units.eightMillimeters']) assert.match(html, new RegExp(`data-i18n="${key}"`), key);
  assert.match(html, /data-i18n="adaptive.sensitivityDefault"/);
  assert.match(html, /data-i18n="footer.privacy"/);
  assert.match(html, /id="lang-en"[^>]*>EN<\/a>/);
  assert.match(html, /id="lang-ru"[^>]*>RU<\/a>/);
  for (const [, key] of html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)) assert.ok(catalog[key], `missing ${key}`);
  assert.doesNotMatch(html, /Other versions|>Original<|>Graph cut<|Local CT seed|>Erode</);
});

test('localizeStatic renders Russian text, aria and title without replacing input elements', () => {
  const {document, nodes, root} = fakeDocument('?study=1&lang=ru');
  assert.equal(localizeStatic(document, '?study=1&lang=ru', '/hematoma-lab-graphcut/', '#view'), 'ru');
  assert.equal(root.lang, 'ru');
  assert.equal(document.title, catalog['page.title'].ru);
  assert.equal(nodes.find(n => n.getAttribute('id') === 'samplingNote').textContent, catalog['sampling.note'].ru);
  assert.equal(nodes.find(n => n.getAttribute('id') === 'axialSlice').getAttribute('aria-label'), catalog['views.axialSlice'].ru);
  assert.equal(nodes.find(n => n.getAttribute('id') === 'lang-ru').getAttribute('aria-current'), 'page');
  assert.equal(nodes.find(n => n.getAttribute('id') === 'lang-en').getAttribute('href'), '/hematoma-lab-graphcut/?study=1#view');
});

test('language switch has registration-style paired selectable tabs', () => {
  assert.match(css, /\.language-switch\s*\{/);
  assert.match(css, /\.language-switch a\[aria-current="page"\]/);
  assert.match(css, /\.language-switch a:focus-visible/);
});

test('plain URL defaults to English and language links preserve unrelated params, duplicates and hash', () => {
  const {document, nodes, root} = fakeDocument('?case=a&lang=en&case=b');
  assert.equal(localizeStatic(document, '?case=a&lang=en&case=b', '/hematoma-lab-graphcut/', '#view'), 'en');
  assert.equal(root.lang, 'en');
  assert.equal(nodes.find(n => n.getAttribute('id') === 'lang-en').textContent, 'EN');
  assert.equal(nodes.find(n => n.getAttribute('id') === 'lang-ru').textContent, 'RU');
  assert.equal(nodes.find(n => n.getAttribute('id') === 'lang-en').getAttribute('aria-current'), 'page');
  assert.equal(languageHref('?case=a&lang=en&case=b', 'ru', '/lab/', '#scan'), '/lab/?case=a&case=b&lang=ru#scan');
  assert.equal(languageHref('?case=a&lang=ru&case=b', 'en', '/lab/', '#scan'), '/lab/?case=a&case=b#scan');
});
