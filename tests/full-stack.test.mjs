import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8');
test('fill sensitivity control adjusts an active proposal without accepting it',()=>{
 const html=read('index.html'),app=read('app.mjs');
 assert.match(html,/id="fillSensitivity"[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*value="50"/);
 assert.match(html,/id="fillSensitivityText"/);
 assert.match(app,/\$\('fillSensitivity'\)\.addEventListener\('input'/);
 assert.match(app,/proposeFill\(volume,mask,label,seedMarkers,exclusionMarkers,Number\(\$\('radius'\)\.value\),Number\(\$\('fillSensitivity'\)\.value\)\)/);
});
test('marker-guided fill has separate exclusion, preview, accept and discard controls',()=>{
 const html=read('index.html'),app=read('app.mjs');
 for(const id of ['proposeFill','acceptFill','discardFill','clearExclusions'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/<option value="exclude">/);
 assert.match(app,/proposeFill\(volume,mask,label,seedMarkers,exclusionMarkers/);
 assert.match(app,/edits\.commit\(fillCandidate\.indices,fillCandidate\.label\)/);
});
test('crosshair is a thin, muted dashed overlay rather than a solid bright stroke',()=>{
 const app=read('app.mjs');
 assert.match(app,/ctx\.strokeStyle='rgba\(188,200,210,0\.65\)'/);
 assert.match(app,/ctx\.lineWidth=w\/\(Math\.max\(1,canvas\.clientWidth\)\*zoom\)/);
 assert.match(app,/ctx\.setLineDash\(\[4\*ctx\.lineWidth,4\*ctx\.lineWidth\]\)/);
});
test('file and folder upload inputs remain keyboard-focusable with visible focus',()=>{
 const html=read('index.html'),css=read('style.css');
 for(const id of ['files','folder']){
  const input=html.match(new RegExp(`<input id="${id}"[^>]*>`))?.[0];
  assert.ok(input,`${id} input exists`);
  assert.doesNotMatch(input,/\bhidden\b|\btabindex="-1"/);
 }
 assert.match(css,/\.upload:focus-within\s*\{/);
 assert.match(css,/\.upload input\[type=file\]\s*\{/);
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
test('Segment clicks edit at the clicked voxel without moving the 3D cursor',()=>{
 const app=read('app.mjs');
 const beforeNav=app.split('const xyz=point(e,plane);')[1].split("if($('interaction-nav').checked)")[0];
 assert.doesNotMatch(beforeNav,/setCross\(/);
 const nav=app.split("if($('interaction-nav').checked){")[1].split("const tool=$('tool')")[0];
 assert.match(nav,/setCross\(xyz\)/);
});
test('a Segment grow or shrink press defers cursor redraw until its preview',()=>{
 const app=read('app.mjs');
 assert.match(app,/function setCross\(xyz,redraw=true\)/);
 assert.match(app,/preview=localEdit\([^;]+;draw\(\)/);
});
test('a Segment seed press draws only the accepted mask, not an intermediate cursor',()=>{
 const app=read('app.mjs');
 assert.ok(app.includes("if(hits.length>200000){action('Local seed exceeds 200,000 grid voxels: reduce Radius.');draw();return;}"));
 const seed=app.split("if(tool==='seed'){")[1].split('holding={')[0];
 assert.equal((seed.match(/draw\(\)/g)||[]).length,2);
 assert.ok(seed.indexOf('edits.commit(')<seed.lastIndexOf('draw();renderVolumes();return;'));
});
