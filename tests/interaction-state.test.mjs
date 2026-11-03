import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');

test('startup reconciles the HTML cursor state with tool selection',()=>{assert.match(app,/setCursorMode\(true\);\s*updateMorphAvailability\(\);/);});
test('cursor selection clears the editing radio and never falls through to a tool',()=>{
 assert.match(app,/function setCursorMode\(enabled\)\{[^\n]*querySelectorAll\('input\[name="tool"\]'\)/);
 assert.match(app,/function selectedTool\(\)\{return document\.querySelector\('input\[name="tool"\]:checked'\)\?\.value/);
});
test('cleanup selection requires an accepted mask and activates cursor without selecting another tool',()=>{
 assert.match(app,/function updateMorphAvailability\(\)/);
 assert.match(app,/edits\.volumes\(\)\.total>0/);
 assert.match(app,/radio\.addEventListener\('change',\(\)=>\{[^\n]*setCursorMode\(true\)/);
 assert.match(app,/radio\.addEventListener\('change',\(\)=>\{[^\n]*discardCandidate\(\)/);
});
test('preview refuses missing operation, absent accepted mask, or noncursor state',()=>{
 const preview=app.match(/function runMorphPreview\(\)\{[^\n]*/)?.[0]||'';
 assert.match(preview,/edits\.volumes\(\)\.total/);
 assert.match(preview,/cursorMode\(\)/);
 assert.match(preview,/input\[name="morphOperation"\]:checked/);
 assert.match(preview,/if\(!operation/);
});
test('mask changes, undo and new series reconcile cleanup selection',()=>{
 assert.match(app,/function renderVolumes\(\)\{[^\n]*updateMorphAvailability\(\)/);
 assert.match(app,/function clearVolume\(\)\{[^\n]*updateMorphAvailability\(\)/);
 assert.match(app,/function setVolume\(v\)\{[^\n]*updateMorphAvailability\(\)/);
});
