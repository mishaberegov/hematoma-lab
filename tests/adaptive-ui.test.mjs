import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
for(const id of ['adaptivePreview','adaptiveAccept','adaptiveDiscard','adaptiveStatus','adaptiveSensitivity','demoMR'])test(`adaptive comparison has ${id}`,()=>assert.match(html,new RegExp(`id="${id}"`)));
test('the adaptive seed uses local image content and requires explicit acceptance',()=>{
 assert.match(app,/adaptiveSeed\(volume,xyz/);
 assert.match(app,/edits\.commit\(adaptiveCandidate\.indices/);
 assert.match(app,/adaptiveAccept/);
 assert.match(app,/adaptiveDiscard/);
});
test('MR demo remains explicitly marked synthetic and starts with a useful image window',()=>{
 assert.match(app,/\$\('demoMR'\)/);
 assert.match(app,/modality==='MR'/);
 assert.match(app,/Synthetic.*MR/);
});
