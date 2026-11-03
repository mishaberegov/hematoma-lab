import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
test('research sensitivity control retains the published default',()=>{
 const html=read('index.html'),app=read('app.mjs');
 assert.match(html,/id="adaptiveSensitivity"[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*value="50"/);
 assert.match(app,/\$\('adaptiveSensitivity'\)\.addEventListener\('input'/);
});
test('research binary adaptive fill has separate anti point, preview, accept and discard controls',()=>{
 const html=read('index.html'),app=read('app.mjs');
 for(const id of ['adaptivePreview','adaptiveAccept','adaptiveDiscard','adaptiveClear'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/type="radio" name="tool" value="adaptive-exclude"/);
 assert.match(app,/new Worker\('\.\/adaptive-worker\.mjs/);
 assert.match(app,/edits\.commit\(adaptiveCandidate\.indices,1\)/);
});
test('crosshair is a thin, muted dashed overlay rather than a solid bright stroke',()=>{
 const app=read('app.mjs');
 assert.match(app,/ctx\.strokeStyle='rgba\(188,200,210,0\.65\)'/);
 assert.match(app,/ctx\.lineWidth=w\/\(Math\.max\(1,canvas\.clientWidth\)\*zoom\)/);
 assert.match(app,/ctx\.setLineDash\(\[4\*ctx\.lineWidth,4\*ctx\.lineWidth\]\)/);
});
test('file and folder picker buttons are keyboard-focusable with visible focus',()=>{
 const html=read('index.html'),css=read('style.css'),app=read('app.mjs');
 for(const [button,input] of [['pickFiles','files'],['pickFolder','folder']]){
  assert.match(html,new RegExp(`<button id="${button}" type="button"`));
  assert.match(html,new RegExp(`<input id="${input}" type="file"[^>]*hidden`));
  assert.match(app,new RegExp(`\\$\\('${button}'\\)\\.addEventListener\\('click',\\(\\)=>\\$\\('${input}'\\)\\.click\\(\\)\\)`));
 }
 assert.match(css,/:is\(button,select,input,summary,a\):focus-visible/);
});
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
test('edit clicks do not move the 3D cursor',()=>{
 const app=read('app.mjs');
 const pointer=app.split('const xyz=point(e,plane);')[1].split("});c.addEventListener('pointermove'")[0];
 assert.match(pointer,/if\(cursorMode\(\)\)\{setCross\(xyz\)/);
 assert.doesNotMatch(pointer.split('discardCandidate();')[1],/setCross\(/);
});
test('a Segment grow or shrink press defers cursor redraw until its preview',()=>{
 const app=read('app.mjs');
 assert.match(app,/function setCross\(xyz,redraw=true\)/);
 assert.match(app,/function updatePreview\(\)\{if\(!holding\|\|!volume\)return/);
 assert.match(app,/if\(tool==='morph-grow'\|\|tool==='morph-shrink'\)\{holding=/);
});
test('Segment mode has only point and shape-aware actions, with no immediate CT seed commit',()=>{
 const app=read('app.mjs');
 assert.match(app,/const tool=selectedTool\(\)/);
 assert.match(app,/if\(tool==='adaptive-seed'\|\|tool==='adaptive-exclude'\)/);
 assert.match(app,/if\(tool==='morph-grow'\|\|tool==='morph-shrink'\)/);
 assert.doesNotMatch(app,/if\(tool==='seed'\)|autoSeed\(/);
});
