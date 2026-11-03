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
test('tool panel has exactly four vertically stacked selectable buttons and no CT seed',()=>{
 for(const value of ['adaptive-seed','adaptive-exclude','morph-grow','morph-shrink'])assert.match(html,new RegExp(`type="radio" name="tool" value="${value}"`));
 assert.equal((html.match(/type="radio" name="tool"/g)||[]).length,4);
 assert.doesNotMatch(html,/<select id="tool"/);
 assert.doesNotMatch(html,/value="seed"|Local CT seed/);
 assert.match(css,/\.tool-buttons\{[^}]*flex-direction:column/);
 assert.match(app,/document\.querySelector\('input\[name="tool"\]:checked'\)\?\.value/);
 assert.doesNotMatch(app,/tool==='seed'|autoSeed\(/);
 for(const id of ['proposeFill','clearExclusions','demo','demoMR'])assert.doesNotMatch(html,new RegExp(`id="${id}"`));
});
test('controls are grouped into marker, morphology and global panels',()=>{
 const marker=html.match(/<section class="marker-panel panel"[\s\S]*?<\/section>/)?.[0]||'';
 const morph=html.match(/<section class="morph-panel panel"[\s\S]*?<\/section>/)?.[0]||'';
 const global=html.match(/<section class="global-panel panel"[\s\S]*?<\/section>/)?.[0]||'';
 for(const value of ['adaptive-seed','adaptive-exclude'])assert.match(marker,new RegExp(`name="tool" value="${value}"`));
 for(const id of ['adaptivePreview','adaptiveClear'])assert.match(marker,new RegExp(`id="${id}"`));
 for(const value of ['morph-grow','morph-shrink'])assert.match(morph,new RegExp(`name="tool" value="${value}"`));
 for(const value of ['open','close'])assert.match(morph,new RegExp(`name="morphOperation" value="${value}"`));
 assert.doesNotMatch(morph,/value="erode"/);
 for(const id of ['cursorMode','undo','resetSegmentation'])assert.match(global,new RegExp(`id="${id}"`));
 assert.doesNotMatch(html,/id="redo"|id="interaction-segment"/);
 assert.match(html,/<div class="window-controls panel"[\s\S]*?<\/div>\s*<section class="volumes/);
 assert.doesNotMatch(html,/class="proposal-mark"/);
});
test('sampling diameter sits under workspace actions with zoom-aware physical preview',()=>{
 assert.match(html,/<div class="tools-layout"><div class="workspace-column">[\s\S]*<\/section>\s*<aside class="diameter-panel panel"/);
 const global=html.match(/<section class="global-panel panel"[\s\S]*?<\/section>/)?.[0]||'';
 assert.doesNotMatch(global,/id="radius"/);
 assert.match(html,/id="samplingPreview"/);
 assert.match(html,/id="samplingCircle"/);
 assert.match(app,/physicalPointRadius\(volume,previewPlane,Number\(\$\('radius'\)\.value\)\)/);
 assert.match(app,/canvas\.clientWidth\/canvas\.width\*zoom/);
 assert.match(app,/canvas\.clientHeight\/canvas\.height\*zoom/);
 assert.match(app,/\$\('radiusText'\)\.textContent=.*2\*Number\(\$\('radius'\)\.value\)/);
 assert.match(css,/\.tools-layout\{[^}]*grid-template-columns/);
});
test('choosing a marker or shape-aware tool exits cursor mode',()=>{
 assert.match(app,/radio\.addEventListener\('change',\(\)=>\{setCursorMode\(false\);/);
});
test('shape-aware tool selection persists across CT and MR and resets to target on new volume',()=>{
 assert.match(app,/\$\('tool-adaptive-seed'\)\.checked=true/);
 assert.match(app,/querySelectorAll\('input\[name="tool"\]'\)/);
});
test('shape-aware grow and shrink are CT/MR held tools with one Undo commit',()=>{
 assert.match(html,/type="radio" name="tool" value="morph-grow"[^>]*><span data-i18n="morph.grow">Shape-aware grow/);
 assert.match(html,/type="radio" name="tool" value="morph-shrink"[^>]*><span data-i18n="morph.shrink">Shape-aware shrink/);
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
 for(const id of ['morphRadius','morphPreview','morphAccept','morphDiscard','morphStatus'])assert.match(html,new RegExp(`id="${id}"`));
 assert.doesNotMatch(html,/name="morphOperation" value="erode"/);
 assert.match(html,/name="morphOperation" value="open"/);
 assert.match(html,/name="morphOperation" value="close"/);
 assert.match(app,/new Worker\('\.\/morphology-worker\.mjs/);
 assert.match(app,/edits\.commitDelta\(candidate\.removed,candidate\.added\)/);
 assert.match(app,/candidate\.added/);
 assert.match(app,/recordMaskAction\(/);
 assert.match(app,/morphCandidate=null/);
});
test('loading a new series clears the previous mask-cleanup status',()=>{
 assert.match(app,/function clearVolume\(\)\{[^\n]*\$\('morphStatus'\)\.textContent=msg\('status\.cleanupInstructions'\)/);
});
test('binary target remains one label',()=>{
 assert.doesNotMatch(app,/options\[0\]\.textContent=mr\|\|adaptive\?'Target lesion':'Intraparenchymal'/);
 assert.match(app,/span\.textContent=t\('volumes\.target',lang\(\),/);
});
test('requested copy and demo buttons are absent without removing local upload',()=>{
 for(const text of ['Local CT / MR · research prototype · not for clinical decisions','No upload · pixels stay in this tab','Experimental method · not validated for diagnosis or clinical measurement.','SOURCE <span>01</span>'])assert(!html.includes(text),text);
 assert.match(html,/id="files"/);assert.match(html,/id="folder"/);
});
test('the 3D cursor button keeps a visible pressed state',()=>{
 assert.match(css,/#cursorMode\[aria-pressed="true"\]\{[^}]*border-color/);
 assert.match(html,/<button id="cursorMode" type="button" aria-pressed="true"/);
});
test('reset segmentation is explicit, undoable, and preserves loaded image',()=>{
 assert.match(html,/<button id="resetSegmentation"[^>]*>Clear all<\/button>/);
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
 assert.match(app,/redoActions\.push\(entry\)/);
 assert.doesNotMatch(app,/\$\('redo'\)/);
});
test('oversized proposal is reported as diagnostic with no Accept',()=>{
 assert.match(app,/result\.status==='oversized'/);
 assert.match(app,/t\('status\.oversized',lang\(\),/);
 assert.match(app,/adaptiveAccept'\)\.hidden=true/);
});
test('high-risk acceptance requires explicit confirmation',()=>{
 assert.match(app,/confirm\(/);
 assert.match(app,/confirm\(t\('confirm\.adaptive',lang\(\),/);
});
test('Undo updates the action text after accepting a high-risk proposal',()=>{
 assert.match(app,/refreshAfterHistory\(msg\('action\.undoRestored'\)\)/);
 assert.match(app,/edits\.volumes\(\)\.total\.toFixed\(3\)/);
});
test('radius markers draw physical diameter in every view',()=>{
 assert.match(app,/physicalPointRadius/);
 assert.match(html,/sampling diameter/i);
});
