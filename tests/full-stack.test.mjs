import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
test('mouse mode controls wrap instead of overflowing a narrow viewport',()=>{
 const css=read('style.css');
 const interaction=css.match(/\.interaction\{([^}]*)\}/)?.[1]||'';
 assert.match(interaction,/flex-wrap:wrap/);
 assert.match(interaction,/max-width:100%/);
});
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
 assert.ok(app.includes("const editPreview=$('interaction-segment').checked&&e.button===0&&!e.shiftKey;setCross(xyz,!editPreview)"));
 assert.match(app,/function setCross\(xyz,redraw=true\)/);
 assert.match(app,/preview=localEdit\([^;]+;draw\(\)/);
});
test('a Segment seed press draws only the accepted mask, not an intermediate cursor',()=>{
 const app=read('app.mjs');
 assert.ok(app.includes("const editPreview=$('interaction-segment').checked&&e.button===0&&!e.shiftKey;setCross(xyz,!editPreview)"));
 assert.ok(app.includes("if(hits.length>200000){action('Local seed exceeds 200,000 grid voxels: reduce Radius.');draw();return;}"));
 const seed=app.split("if(tool==='seed'){")[1].split('holding={')[0];
 assert.equal((seed.match(/draw\(\)/g)||[]).length,2);
 assert.ok(seed.indexOf('edits.commit(')<seed.lastIndexOf('draw();renderVolumes();return;'));
});
