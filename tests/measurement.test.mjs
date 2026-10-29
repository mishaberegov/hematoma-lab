import test from 'node:test';import assert from 'node:assert/strict';
import {measurementGeometry,buildMeasuredVolume} from '../dist/measurement.mjs';
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
