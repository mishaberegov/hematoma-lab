import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
test('entry and worker pin changed modules to the published release',()=>{
  const html=read('index.html'),app=read('app.mjs'),worker=read('io-worker.js'),measurement=read('measurement.mjs');
  const version=html.match(/app\.mjs\?v=([\d.]+)/)?.[1];
  assert.ok(version,'HTML must version the entry module');
  assert.equal(JSON.parse(read('../package.json')).version,version);
  assert.ok(html.includes(`style.css?v=${version}`),'stylesheet must bypass stale warnings styling');
  assert.ok(app.includes(`from './algorithm.mjs?v=${version}'`),'entry must bypass a cached older volume algorithm');
  assert.ok(app.includes(`from './drop-files.mjs?v=${version}'`),'entry must bypass a cached older folder reader');
  assert.ok(app.includes(`./io-worker.js?v=${version}`),'worker must match the entry release');
  assert.ok(worker.includes(`import('./measurement.mjs?v=${version}')`),'worker must bypass a cached older measurement module');
  assert.ok(worker.includes(`import('./dicom.mjs?v=${version}')`),'worker must use the matching DICOM parser');
  assert.ok(measurement.includes(`from './dicom.mjs?v=${version}'`),'decoder must use the same DICOM parser');
});
