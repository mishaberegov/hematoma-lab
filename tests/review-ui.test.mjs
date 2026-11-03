import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
test('viewer uses patient-space mapping for pixels, clicks, slices, markers and zoom',()=>{
 for(const name of ['patientMapping','patientRowIndex','patientPlanePixel','patientVoxelFromPlane','patientZoomOrigin','stepPatientPlaneSlice'])assert.match(app,new RegExp(name+'\\('));
 assert.match(app,/patientMapping\(volume,plane\)\.normalAxis/);
 assert.doesNotMatch(app,/plane==='axial'\?2:plane==='coronal'\?1:0/);
});
test('each named plane slider follows its anatomical normal instead of a fixed array axis',()=>{
 for(const plane of ['axial','coronal','sagittal'])assert.match(html,new RegExp(`id="${plane}Slice"`));
 assert.match(app,/const axis=patientMapping\(volume,plane\)\.normalAxis;\$\(plane\+'Slice'\)\.max=/);
});
test('binary adaptive UI has no visible compartment selector',()=>{
 assert.doesNotMatch(html,/Compartment<select/);
 assert.match(html,/<label hidden>Binary target<select id="label"><option value="1">Target<\/option><\/select><\/label>/);
 assert.match(html,/id="radius"[^>]*value="8"/);
 assert.match(html,/id="adaptiveSensitivity"[^>]*value="50"/);
});
test('loading CT after MR resets window so CT pixels do not appear black',()=>{
 assert.match(app,/if\(v\.modality==='CT'\)\{\$\('level'\)\.value='60';\$\('width'\)\.value='160';\}/);
});
test('only requested CT/MR tools and collective adaptive points remain visible',()=>{
 for(const value of ['adaptive-seed','adaptive-exclude','seed','morph-grow','morph-shrink'])assert.match(html,new RegExp(`<option value="${value}"`));
 for(const value of ['grow','shrink','exclude','contour-grow'])assert.doesNotMatch(html,new RegExp(`<option value="${value}"`));
 assert.doesNotMatch(html,/<details class="legacy panel">/);
 for(const id of ['proposeFill','clearExclusions','demo','demoMR'])assert.doesNotMatch(html,new RegExp(`id="${id}"`));
});
test('shape-aware grow and shrink are CT/MR held tools with one Undo commit',()=>{
 assert.match(html,/<option value="morph-grow">Shape-aware grow/);
 assert.match(html,/<option value="morph-shrink">Shape-aware shrink/);
 assert.match(app,/import \{morphGrow\} from '\.\/morph-grow\.mjs/);
 assert.match(app,/import \{morphShrink\} from '\.\/morph-shrink\.mjs/);
 assert.match(app,/tool==='morph-grow'\|\|tool==='morph-shrink'/);
 assert.match(app,/holding\.tool==='morph-shrink'/);
 assert.match(app,/morphGrow\(volume,mask,holding\.xyz/);
 assert.match(app,/morphShrink\(volume,mask,holding\.xyz/);
 assert.match(app,/holding\.boundaryAt\s*\+\s*1200/);
 assert.match(app,/holding\.pendingMorph/);
 assert.match(app,/holding\.visibleComplete=false/);
 assert.match(app,/holding\.visibleComplete=true/);
 assert.match(app,/changes=holding\.visibleComplete\?preview\|\|\[\]:\[\]/);
 assert.match(app,/shrinking\?0:holding\.label/);
});
test('mask cleanup provides non-destructive preview and one-action Undo for CT/MR',()=>{
 for(const id of ['morphOperation','morphRadius','morphPreview','morphAccept','morphDiscard','morphStatus'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/<option value="erode">/);
 assert.match(html,/<option value="open">/);
 assert.match(html,/<option value="close">/);
 assert.match(app,/new Worker\('\.\/morphology-worker\.mjs/);
 assert.match(app,/edits\.commitDelta\(candidate\.removed,candidate\.added\)/);
 assert.match(app,/candidate\.added/);
 assert.match(app,/recordMaskAction\(/);
 assert.match(app,/morphCandidate=null/);
});
test('loading a new series clears the previous mask-cleanup status',()=>{
 assert.match(app,/function clearVolume\(\)\{[^\n]*\$\('morphStatus'\)\.textContent='Preview before changing the accepted mask/);
});
test('binary target remains one label',()=>{
 assert.doesNotMatch(app,/options\[0\]\.textContent=mr\|\|adaptive\?'Target lesion':'Intraparenchymal'/);
 assert.match(app,/span\.textContent='Target lesion: '/);
});
test('requested copy and demo buttons are absent without removing local upload',()=>{
 for(const text of ['Local CT / MR · research prototype · not for clinical decisions','No upload · pixels stay in this tab','Experimental method · not validated for diagnosis or clinical measurement.','SOURCE <span>01</span>'])assert(!html.includes(text),text);
 assert.match(html,/id="files"/);assert.match(html,/id="folder"/);
});
test('Navigate/Segment selected border remains visible on both sides',()=>{
 assert.match(css,/\.interaction label:last-of-type span\{[^}]*border-left:1px/);
 assert.match(css,/\.interaction input:checked\+span\{[^}]*z-index:1/);
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
