import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
test('binary adaptive UI has no visible compartment selector',()=>{
 assert.doesNotMatch(html,/Compartment<select/);
 assert.match(html,/<label hidden>Binary target<select id="label"><option value="1">Target<\/option><\/select><\/label>/);
 assert.match(html,/id="radius"[^>]*value="8"/);
 assert.match(html,/id="adaptiveSensitivity"[^>]*value="50"/);
});
test('CT local editing tools are selectable beside adaptive points',()=>{
 for(const value of ['seed','grow','shrink','exclude'])assert.match(html,new RegExp(`<option value="${value}">`));
 assert.match(html,/<details class="legacy panel">/);
 assert.match(html,/<button id="proposeFill"[^>]*>Propose fill<\/button>/);
 assert.match(html,/<button id="clearExclusions"[^>]*>Clear exclusions<\/button>/);
});
test('binary target remains one label while legacy CT tools are selected',()=>{
 assert.doesNotMatch(app,/options\[0\]\.textContent=mr\|\|adaptive\?'Target lesion':'Intraparenchymal'/);
 assert.match(app,/span\.textContent='Target lesion: '/);
});
test('reset segmentation is explicit, undoable, and preserves loaded image',()=>{
 assert.match(html,/<button id="resetSegmentation"[^>]*>Clear mask and points<\/button>/);
 assert.match(app,/\$\('resetSegmentation'\)\.onclick=/);
 assert.match(app,/confirm\(/);
 assert.match(app,/mask=new Uint8Array\(volume\.data\.length\)/);
 assert.match(app,/edits=history\(mask,volume\)/);
 assert.match(app,/recordAction\(/);
});
test('Undo tracks target and background point placement, not only mask edits',()=>{
 assert.match(app,/function recordAction\(/);
 assert.match(app,/points\.push\(xyz\);recordAction\(/);
 assert.match(app,/\$\('undo'\)\.onclick=\(\)=>\{[^}]*undoActions\.pop\(\)/);
 assert.match(app,/\$\('redo'\)\.onclick=\(\)=>\{[^}]*redoActions\.pop\(\)/);
});
test('oversized proposal is reported as diagnostic with no Accept',()=>{
 assert.match(app,/result\.status==='oversized'/);
 assert.match(app,/Potential growth/);
 assert.match(app,/adaptiveAccept'\)\.hidden=true/);
});
test('high-risk acceptance requires explicit confirmation',()=>{
 assert.match(app,/confirm\(/);
 assert.match(app,/HIGH.RISK/);
});
test('Undo updates the action text after accepting a high-risk proposal',()=>{
 assert.match(app,/refreshAfterHistory\('Undo restored'\)/);
 assert.match(app,/edits\.volumes\(\)\.total\.toFixed\(3\)/);
});
test('radius markers draw physical diameter in every view',()=>{
 assert.match(app,/physicalPointRadius/);
 assert.match(html,/sampling radius/i);
});
