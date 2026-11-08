import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadState} from '../dist/load-state.mjs';

test('a discovered series enters a single build and duplicate Load cannot queue a silent request',()=>{
 const load=createLoadState();
 assert.equal(load.snapshot().phase,'idle');
 load.beginScan();
 assert.equal(load.snapshot().phase,'scanning');
 load.found(['A','B']);
 assert.equal(load.snapshot().phase,'choosing');
 const request=load.beginBuild('A');
 assert.deepEqual(Object.keys(request).sort(),['key','requestId']);
 assert.equal(load.snapshot().phase,'building');
 assert.equal(load.beginBuild('B'),null);
 assert.equal(load.beginBuild('A'),null);
 assert.equal(load.acceptVolume({key:'B',requestId:request.requestId}),false);
 assert.equal(load.snapshot().phase,'building');
 assert.equal(load.acceptVolume(request),true);
 assert.equal(load.snapshot().phase,'ready');
 assert.equal(load.snapshot().key,'A');
 assert.equal(load.beginBuild('B').key,'B');
});

test('new input invalidates an old build and a failure permits retrying the selected group',()=>{
 const load=createLoadState();load.beginScan();load.found(['A','B']);
 const old=load.beginBuild('A');
 load.beginScan();load.found(['C']);const next=load.beginBuild('C');
 assert.equal(load.acceptVolume(old),false);
 assert.equal(load.acceptVolume(next),true);
 load.beginScan();load.found(['D']);load.beginBuild('D');load.fail();
 assert.equal(load.snapshot().phase,'failed');
 assert.equal(load.beginBuild('D'),null);
 load.beginScan();load.found(['D']);
 assert.equal(load.beginBuild('D').key,'D');
});
