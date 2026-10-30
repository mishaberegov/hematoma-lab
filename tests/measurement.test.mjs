import test from 'node:test';import assert from 'node:assert/strict';
import {measurementGeometry,buildMeasuredVolume,planReducedGrid} from '../dist/measurement.mjs';
const make=(positions)=>({name:'test',modality:'CT',frameUID:'1',ts:'1.2.840.10008.1.2.1',frames:positions.map((z,i)=>({ipp:[0,0,z],iop:[1,0,0,0,1,0],norm:[0,0,1],spacing:[.5,.5],rows:2,cols:2,thickness:1,slope:1,intercept:-1024,huCalibrated:true,ds:{string:()=>''},index:i}))});
test('regular CT source slices remain Float32 and source dimensions',async()=>{
 const g=make([0,1,2]);const geometry=measurementGeometry(g);assert.deepEqual(geometry.dims,[2,2,3]);
 const volume=await buildMeasuredVolume(g,{decode:async f=>new Float32Array(4).fill(f.index-1024)});
 assert(volume.data instanceof Float32Array);assert.equal(volume.data.length,12);assert.equal(volume.data[8],-1022);
});
test('missing slice is rejected, never interpolated',()=>assert.throws(()=>measurementGeometry(make([0,1,3])),/gap|irregular/i));
test('in-plane drift and duplicate slice are rejected',()=>{
 const drift=make([0,1,2]);drift.frames[1].ipp[0]=.3;assert.throws(()=>measurementGeometry(drift),/drift|offset/i);
 assert.throws(()=>measurementGeometry(make([0,1,1])),/duplicate/i);
});
test('non CT and single slice cannot yield measured volume',()=>{
 const mr=make([0,1]);mr.modality='MR';assert.throws(()=>measurementGeometry(mr),/CT/);
 assert.throws(()=>measurementGeometry(make([0])),/two slices/i);
});
test('missing rescale tags cannot masquerade as calibrated HU',()=>{
 const g=make([0,1,2]);g.frames[1].huCalibrated=false;
 assert.throws(()=>measurementGeometry(g),/calibration|rescale/i);
});
const seamGroup=(positions,acquisitions)=>{
 const g=make(positions);
 g.frames.forEach((f,i)=>{f.acquisition=String(acquisitions[i]);f.ds={string:tag=>({'x0020000d':'study-1','x00200052':'frame-1'}[tag]||'')};});
 return g;
};
test('one shared acquisition endpoint keeps the longer acquisition source slice, not an interpolated image',async()=>{
 const g=seamGroup([0,1,1,2,3],[1,1,2,2,2]);
 const geo=measurementGeometry(g);
 assert.deepEqual(geo.dims,[2,2,4]);assert.deepEqual(geo.frames.map(f=>f.index),[0,2,3,4]);
 assert.equal(geo.seamRemoved,1);
 const v=await buildMeasuredVolume(g,{decode:async f=>new Float32Array(4).fill(f.index)});
 assert.deepEqual(Array.from(v.data.filter((_,i)=>i%4===0)),[0,2,3,4]);
 assert.match(v.warnings.join(' '),/граничн/);
});
test('720 files from two contiguous acquisitions retain 719 original physical positions',()=>{
 const positions=[...Array.from({length:319},(_,i)=>i),...Array.from({length:401},(_,i)=>i+318)];
 const g=seamGroup(positions,[...Array(319).fill(1),...Array(401).fill(2)]);
 const geo=measurementGeometry(g);
 assert.equal(geo.frames.length,719);assert.equal(geo.frames[318].index,319);
 assert.equal(geo.seamRemoved,1);
});
test('same-acquisition duplicates and multiple overlaps remain blocked',()=>{
 assert.throws(()=>measurementGeometry(seamGroup([0,1,1,2],[1,1,1,1])),/duplicate/i);
 assert.throws(()=>measurementGeometry(seamGroup([0,1,2,1,2,3],[1,1,1,2,2,2])),/duplicate/i);
});
test('a seam across distinct studies or frames remains blocked',()=>{
 const g=seamGroup([0,1,1,2,3],[1,1,2,2,2]);
 g.frames[2].ds={string:tag=>tag==='x0020000d'?'other-study':'frame-1'};
 assert.throws(()=>measurementGeometry(g),/duplicate/i);
});
test('a 720-file shared-seam series automatically fits the whole 719-slice depth',()=>{
 const plan=planReducedGrid(512,512,719,60000000);
 assert.equal(plan.factor,2);assert.deepEqual(plan.dims,[256,256,719]);
 assert.equal(plan.dims[2],719);
});

test('automatic reduction retains every Z position, averages finite source pixels, and reports derived geometry',async()=>{
 const g=make([0,1,2]);g.frames.forEach(f=>{f.cols=5;f.rows=3});
 const pixels=Float32Array.from([0,2,4,6,8,10,12,14,16,18,20,22,24,26,28]);
 const v=await buildMeasuredVolume(g,{maxVoxels:18,decode:async()=>pixels});
 assert.deepEqual(v.dims,[3,2,3]);assert.deepEqual(v.sourceDims,[5,3,3]);
 assert.equal(v.reductionFactor,2);assert.deepEqual(v.origin,[.25,.25,0]);
 assert.deepEqual(v.matrix,[1,0,0,0,1,0,0,0,1]);
 assert.deepEqual(Array.from(v.data.slice(0,6)),[6,10,13,21,25,28]);
 assert.equal(v.data[6],6);assert.equal(v.data[12],6);
 assert.match(v.warnings.join(' '),/приблизительн/);
 assert.match(v.warnings.join(' '),/5×3×3.*3×2×3/);
});
test('automatic reduction ignores padding NaNs but preserves all-NaN source blocks',async()=>{
 const g=make([0,1]);g.frames.forEach(f=>{f.cols=4;f.rows=4});
 const pixels=Float32Array.from([NaN,2,NaN,NaN,4,6,NaN,NaN,8,10,12,14,16,18,20,22]);
 const v=await buildMeasuredVolume(g,{maxVoxels:8,decode:async()=>pixels});
 assert.deepEqual(v.dims,[2,2,2]);assert.equal(v.data[0],4);assert(Number.isNaN(v.data[1]));
});
