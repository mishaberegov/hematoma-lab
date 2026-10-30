import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
test('large-series UI loads the whole stack without a manual slice range',()=>{
 const html=read('index.html'),app=read('app.mjs'),worker=read('io-worker.js');
 assert.doesNotMatch(html,/id="rangeStart"|id="rangeEnd"|id="sliceRange"/);
 assert.doesNotMatch(app,/configureRange|sliceRange/);
 assert.doesNotMatch(worker,/sliceRange/);
 assert.match(app,/reductionFactor/);
});
test('UI reads accepted mask volumes from incremental edit history',()=>{
 const app=read('app.mjs');
 assert.match(app,/edits=history\(mask,v\)/);
 assert.match(app,/const m=edits\.volumes\(\)/);
 assert.doesNotMatch(app,/volumes\(mask,volume\)/);
});
test('a single discovered series builds without asking for a one-option selection',()=>{
 const app=read('app.mjs');
 assert.match(app,/data\.groups\.length===1/);
 assert.match(app,/worker\.postMessage\(\{type:'build',key:data\.groups\[0\]\.key\}\)/);
});
test('starting a dropped directory immediately cancels the previous decoding worker',()=>{
 const app=read('app.mjs');
 assert.match(app,/const token=inputGate\.begin\(\);\s*worker\?\.terminate\(\);worker=null;/);
 assert.match(app,/const token=inputGate\.begin\(\);\s*worker\?\.terminate\(\);worker=null;\s*clearVolume\(\)/);
});
test('late directory traversal cannot replace a newer input or its status',()=>{
 const app=read('app.mjs');
 assert.match(app,/const token=inputGate\.begin\(\)/);
 assert.match(app,/if\(inputGate\.current\(token\)\)scan\(awaitedFiles,isDirectory\)/);
 assert.match(app,/catch\(error\)\{if\(inputGate\.current\(token\)\)status\(/);
});
test('a Segment grow or shrink press defers cursor redraw until its preview',()=>{
 const app=read('app.mjs');
 assert.match(app,/const editPreview=\$\('interaction-segment'\)\.checked&&e\.button===0&&!e\.shiftKey&&\$\('tool'\)\.value!=='seed';setCross\(xyz,!editPreview\)/);
 assert.match(app,/function setCross\(xyz,redraw=true\)/);
 assert.match(app,/preview=localEdit\([^;]+;draw\(\)/);
});
