import {test} from 'node:test';
import assert from 'node:assert/strict';
import {morphShrink} from '../dist/morph-shrink.mjs';

const at=(d,x,y,z)=>(z*d[1]+y)*d[0]+x;
function fixture(modality='CT',matrix=[1,0,0,0,1,0,0,0,1],dims=[41,41,41]){
 const data=new Float32Array(dims.reduce((a,b)=>a*b,1));
 const mask=new Uint8Array(data.length);
 for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  const r=Math.hypot(x-20,y-20,z-20),i=at(dims,x,y,z);
  mask[i]=r<12?1:0;
  data[i]=r<8?(modality==='CT'?80:-120):(modality==='CT'?20:240);
 }
 return [{dims,matrix,data,modality},mask];
}

test('CT shell click shrinks locally to image interface, preserving the accepted mask',()=>{
 const [v,m]=fixture(),before=m.slice(),r=morphShrink(v,m,[29,20,20],{radiusMm:9});
 assert.equal(r.status,'ok',r.reason);
 assert.equal(r.boundaryDetected,true);
 assert(r.indices.includes(at(v.dims,30,20,20)));
 assert(!r.indices.includes(at(v.dims,20,20,20)));
 assert(r.indices.every(i=>m[i]===1));
 assert.deepEqual(m,before);
});

test('MR intensity rescaling gives the same local shrink as CT',()=>{
 const [ct,mask]=fixture('CT'),[mr]=fixture('MR');
 const a=morphShrink(ct,mask,[29,20,20],{radiusMm:9});
 const b=morphShrink(mr,mask,[29,20,20],{radiusMm:9});
 assert.equal(b.status,'ok',b.reason);
 assert.deepEqual(b.indices,a.indices);
});

test('internal click cannot drill a closed hole; distant mask remains intact',()=>{
 const [v,m]=fixture();m[at(v.dims,3,3,3)]=1;
 const before=m.slice(),r=morphShrink(v,m,[20,20,20],{radiusMm:11});
 assert.equal(r.status,'no-boundary');assert.deepEqual(r.indices,[]);
 assert.deepEqual(m,before);
});

test('full sheared affine bounds the local removal in physical millimeters',()=>{
 const matrix=[1,.8,0,0,1,0,0,0,3];
 const [v,m]=fixture('MR',matrix);
 const r=morphShrink(v,m,[29,20,20],{radiusMm:8});
 assert.equal(r.status,'ok',r.reason);
 assert(r.indices.every(i=>{const x=i%41-29,y=Math.floor(i/41)%41-20,z=Math.floor(i/1681)-20;return Math.hypot(x+.8*y,y,3*z)<=8+1e-7;}));
 assert(!r.indices.includes(at(v.dims,29,20,23)));
});

test('stage 1 cautiously crosses weak image interface but retains strong core',()=>{
 const [v,m]=fixture();
 for(let z=0;z<41;z++)for(let y=0;y<41;y++)for(let x=0;x<41;x++){
  const r=Math.hypot(x-20,y-20,z-20);
  v.data[at(v.dims,x,y,z)]=r<7?80:r<9?45:20;
 }
 const a=morphShrink(v,m,[29,20,20],{radiusMm:10});
 const b=morphShrink(v,m,[29,20,20],{radiusMm:10,stage:1});
 assert.equal(a.status,'ok',a.reason);assert.equal(b.status,'ok',b.reason);
 assert(b.indices.length>a.indices.length,`${a.indices.length}, ${b.indices.length}`);
 assert(!b.indices.includes(at(v.dims,20,20,20)));
});

test('mild surface support drops a one-voxel inward tendril without eroding the broad shell',()=>{
 const [v,m]=fixture();
 v.data[at(v.dims,13,20,20)]=20;
 v.data[at(v.dims,14,20,20)]=20;
 const r=morphShrink(v,m,[29,20,20],{radiusMm:23});
 assert.equal(r.status,'ok',r.reason);
 assert(!r.indices.includes(at(v.dims,14,20,20)));
 assert(r.indices.includes(at(v.dims,30,20,20)));
});

test('no mask, no contrast, image face, cap, budget and unsafe ROI refuse atomically',()=>{
 const [v,m]=fixture();
 let r=morphShrink(v,new Uint8Array(m.length),[29,20,20],{radiusMm:9});
 assert.equal(r.status,'no-mask');assert.deepEqual(r.indices,[]);
 r=morphShrink(v,m,[29,20,20],{radiusMm:9,maxRemovedVoxels:2});
 assert.equal(r.status,'overflow');assert.deepEqual(r.indices,[]);
 const [large,lm]=fixture('CT',[1,0,0,0,1,0,0,0,1],[110,110,110]);
 r=morphShrink(large,lm,[55,55,55],{radiusMm:100});assert.equal(r.status,'budget');assert.deepEqual(r.indices,[]);
 v.data.fill(42);
 r=morphShrink(v,m,[29,20,20],{radiusMm:9});assert.equal(r.status,'no-boundary');assert.deepEqual(r.indices,[]);
 v.data[at(v.dims,30,20,20)]=NaN;
 r=morphShrink(v,m,[29,20,20],{radiusMm:9});assert.equal(r.status,'invalid');assert.deepEqual(r.indices,[]);
 const [face,fm]=fixture();fm[at(face.dims,0,20,20)]=1;
 r=morphShrink(face,fm,[0,20,20],{radiusMm:7});assert.notEqual(r.status,'ok');assert.deepEqual(r.indices,[]);
 r=morphShrink(face,fm,[29,20,20],{radiusMm:9,stage:2});assert.equal(r.status,'invalid');
});
