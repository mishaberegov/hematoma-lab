import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
for(const id of ['adaptivePreview','adaptiveAccept','adaptiveDiscard','adaptiveClear','adaptiveStatus','adaptiveSensitivity'])test(`adaptive comparison has ${id}`,()=>assert.match(html,new RegExp(`id="${id}"`)));
test('points are collected without mask edits until one explicit fill proposal and acceptance',()=>{
 assert.match(html,/type="radio" name="tool" value="adaptive-exclude"/);
 assert.match(html,/>Propose fill</);
 assert.match(app,/const points=tool==='adaptive-seed'\?adaptivePositive:adaptiveNegative/);
 assert.match(app,/points\.push\(xyz\)/);
 assert.match(app,/new Worker\('\.\/adaptive-worker\.mjs/);
 assert.match(app,/edits\.commit\(adaptiveCandidate\.indices/);
 assert.doesNotMatch(app,/runAdaptive\(xyz\)/);
});
test('MR loads with a useful image window, without a demo button',()=>{
 assert.doesNotMatch(html,/id="demoMR"/);
 assert.match(app,/modality==='MR'/);
 assert.match(app,/sample\.sort\(\(a,b\)=>a-b\)/);
});
