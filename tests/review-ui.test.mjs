import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
test('research UI has no compartment selector or legacy segmentation tools',()=>{
 assert.doesNotMatch(html,/Compartment<select|Legacy CT mask-guided/);
 assert.match(html,/id="radius"[^>]*value="8"/);
 assert.match(html,/id="adaptiveSensitivity"[^>]*value="50"/);
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
 assert.match(app,/\$\('undo'\)\.onclick=\(\)=>\{[^}]*edits\?\.undo\(\)[^}]*action\(`Undo restored/);
});
test('radius markers draw physical diameter in every view',()=>{
 assert.match(app,/physicalPointRadius/);
 assert.match(html,/sampling radius/i);
});
