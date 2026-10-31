import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');

test('orthogonal canvases fill their physical-aspect boxes rather than letterboxing native pixel ratios',()=>{
 const rule=css.match(/\.viewImage canvas\{([^}]*)\}/)?.[1]||'';
 assert.match(rule,/object-fit:fill/);
 assert.match(rule,/width:min\(100%,calc\(60vh\s*\*\s*var\(--physical-aspect\)\)\)/);
 assert.match(app,/style\.setProperty\('--physical-aspect',String\(planeAspect\(volume,plane\)\)\)/);
 assert.doesNotMatch(css,/\.viewImage canvas\{max-height:/,'mobile must not independently clamp canvas height and stretch pixels');
 assert.match(css,/@media\(max-width:700px\)[\s\S]*?\.viewImage\{min-height:300px;height:auto\}/,'mobile view must grow to show the entire canvas');
});
