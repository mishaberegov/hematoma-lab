import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveFill} from '../dist/adaptive.mjs';
const dims=[80,80,40],matrix=[1,0,0,0,1,0,0,0,1];
const volume={dims,matrix,data:new Float32Array(dims.reduce((a,b)=>a*b,1)).fill(70)};
const mask=new Uint8Array(volume.data.length);
const positives=[[20,20,20],[60,60,20]];
test('oversized connected growth is diagnostic, never an empty anatomy or partial proposal',()=>{
 const r=adaptiveFill(volume,positives,[],mask,8,50,{maxNodes:300000,maxProposal:200});
 assert.equal(r.status,'oversized');assert.deepEqual(r.indices,[]);assert(r.potentialVoxels>200);assert(r.potentialMl>0);assert.equal(typeof r.touchesBoundary,'boolean');
 assert.equal(mask.some(Boolean),false);
});
test('ROI over conservative budget is explicit computational refusal with no partial mask',()=>{
 const r=adaptiveFill(volume,positives,[],mask,8,50,{maxNodes:1000,maxProposal:200});
 assert.equal(r.status,'refused');assert.deepEqual(r.indices,[]);assert.match(r.reason,/computational|resource/i);
});
test('anti point changes complete diagnostic and does not mutate mask',()=>{
 const a=adaptiveFill(volume,[[40,40,20]],[],mask,8,50,{maxNodes:300000,maxProposal:200});
 const b=adaptiveFill(volume,[[40,40,20]],[[44,40,20]],mask,8,50,{maxNodes:300000,maxProposal:200});
 assert.equal(a.status,'oversized');assert.equal(b.status,'oversized');assert(b.potentialVoxels<a.potentialVoxels);assert.equal(mask.some(Boolean),false);
});
