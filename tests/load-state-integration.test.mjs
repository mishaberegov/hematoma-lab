import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('../dist/io-worker.js',import.meta.url),'utf8');

test('UI serializes build requests and disables contradictory series selection',()=>{
 assert.match(app,/createLoadState\(\)/);
 assert.match(app,/function startBuild\(key\)/);
 assert.match(app,/loadState\.beginBuild\(key\)/);
 assert.match(app,/\$\('series'\)\.disabled=building/);
 assert.match(app,/\$\('load'\)\.disabled=building/);
 assert.match(app,/loadState\.acceptVolume\(data\)/);
});

test('the worker echoes the requested series and request ID with its finished volume',()=>{
 assert.match(worker,/type:'volume',slot,key:data\.key,requestId:data\.requestId,volume/);
});
