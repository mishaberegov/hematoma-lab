import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
test('entry and worker pin the changed measurement module to the published release',()=>{
  const html=read('index.html'),app=read('app.mjs'),worker=read('io-worker.js');
  const version=html.match(/app\.mjs\?v=([\d.]+)/)?.[1];
  assert.ok(version,'HTML must version the entry module');
  assert.ok(app.includes(`from './measurement.mjs?v=${version}'`),'entry must bypass a cached older measurement module');
  assert.ok(app.includes(`./io-worker.js?v=${version}`),'worker must match the entry release');
  assert.ok(worker.includes(`import('./measurement.mjs?v=${version}')`),'worker must bypass a cached older measurement module');
});
