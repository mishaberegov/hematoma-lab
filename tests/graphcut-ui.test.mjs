import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
test('graph-cut UI retains main CT/MR point and acceptance workflow in browser worker',()=>{
 const html=read('index.html'),app=read('app.mjs'),worker=read('adaptive-worker.mjs');
 for(const id of ['files','folder','tool-adaptive-seed','adaptivePreview','adaptiveAccept','adaptiveDiscard','undo'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(app,/new Worker\('\.\/adaptive-worker\.mjs/);assert.match(worker,/graphCutFill/);
 assert.match(html,/Graph cut/);assert.match(read('i18n.mjs'),/graphcut\.boundary/);
});
test('graph-cut search-margin control does not pretend to be intensity sampling size',()=>{
 const html=read('index.html'),i18n=read('i18n.mjs');
 assert.match(i18n,/'sampling\.title': \['Search margin', 'Отступ области поиска'\]/);
 assert.match(i18n,/2 mm intensity cores/);
 assert.match(html,/data-i18n="sampling\.title">Search margin/);
 assert.match(html,/id="radiusText"[^>]*>8 mm/);
 assert.match(read('app.mjs'),/\('radiusText'\)\.textContent=Number\(\$\('radius'\)\.value\)\+' mm'/);
});
