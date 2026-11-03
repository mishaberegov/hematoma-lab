import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');

test('one pressed 3D cursor replaces Navigate and Segment modes',()=>{
 assert.match(html,/<button\b[^>]*id=["']cursorMode["'][^>]*aria-pressed=["']true["']/);
 assert.doesNotMatch(html,/id=["']interaction-(?:nav|segment)["']/);
 assert.doesNotMatch(app,/\$\('interaction-(?:nav|segment)'\)/);
 assert.match(app,/\$\('cursorMode'\)\.getAttribute\('aria-pressed'\)/);
});
test('cursor click moves the crosshair but an edit click does not',()=>{
 const pointer=app.split("c.addEventListener('pointerdown',e=>{")[1]?.split("c.addEventListener('pointermove'")[0];
 assert.ok(pointer,'canvas pointerdown handler exists');
 assert.match(pointer,/const xyz=point\(e,plane\)/);
 assert.match(pointer,/if\(cursorMode\(\)\)\{setCross\(xyz\)/);
 assert.match(pointer,/const tool=selectedTool\(\)/);
 assert.match(pointer,/points\.push\(xyz\)/);
 assert.equal((pointer.match(/setCross\(xyz\)/g)||[]).length,1);
});
test('cursor drag windows and shift drag zooms without live cursor movement',()=>{
 const pointer=app.split("c.addEventListener('pointerdown',e=>{")[1]?.split("c.addEventListener('pointerup'")[0];
 assert.match(pointer,/kind:e\.shiftKey\?'zoom':'window'/);
 assert.match(pointer,/gesture=\{kind:'window'/);
 assert.match(pointer,/dragWindow\(/);
 assert.match(pointer,/dragZoom\(/);
 assert.doesNotMatch(pointer.split("c.addEventListener('pointermove'")[1],/setCross\(/);
});
test('selecting an editing tool exits cursor mode and cursor button restores it',()=>{
 assert.match(app,/radio\.addEventListener\('change',\(\)=>\{setCursorMode\(false\)/);
 assert.match(app,/\$\('cursorMode'\)\.addEventListener\('click'/);
 assert.match(html,/id=["']tool-adaptive-seed["'][^>]*checked/);
 assert.equal((html.match(/name=["']tool["']/g)||[]).length,4);
 assert.doesNotMatch(html,/id=["']redo["']/);
 assert.doesNotMatch(app,/\$\('redo'\)/);
});
