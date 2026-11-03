import {test} from 'node:test';
import assert from 'node:assert/strict';
import {morphGrow,regularizeSurface} from '../dist/morph-grow.mjs';

const at=(d,x,y,z)=>(z*d[1]+y)*d[0]+x;
function fixture(fn,dims=[41,41,41],matrix=[1,0,0,0,1,0,0,0,1]) {
 const data=new Float32Array(dims.reduce((a,b)=>a*b,1));
 for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)data[at(dims,x,y,z)]=fn(x,y,z);
 return [{dims,matrix,data,modality:'MR'},new Uint8Array(data.length)];
}
const ell=(x,y,z)=>((x-20)/12)**2+((y-20)/5)**2+((z-20)/4)**2;

test('surface regularizer removes a one-voxel labyrinth branch but keeps a broad irregular core',()=>{
 const d=[13,13,13],mask=new Uint8Array(d.reduce((a,b)=>a*b,1)),candidate=[];
 for(let z=4;z<=8;z++)for(let y=4;y<=8;y++)for(let x=4;x<=8;x++)candidate.push(at(d,x,y,z));
 for(let x=9;x<=11;x++)candidate.push(at(d,x,6,6));
 const kept=regularizeSurface(candidate,mask,d,[6,6,6]);
 assert(kept.includes(at(d,8,6,6)));
 assert(!kept.includes(at(d,10,6,6)));
 assert(kept.includes(at(d,4,4,4)));
 assert.equal(mask.reduce((a,b)=>a+b,0),0);
});

test('heterogeneous elongated MR structure grows without imposing a spherical mask or mutating input',()=>{
 const [v,mask]=fixture((x,y,z)=>ell(x,y,z)<1?80+((x*7+y*13+z*5)%11)*2: -80+((x+y+z)%3));
 mask[at(v.dims,20,20,20)]=1;
 const before=mask.slice();
 const r=morphGrow(v,mask,[20,20,20],{radiusMm:17});
 assert.equal(r.status,'ok',r.reason);assert.equal(r.boundaryDetected,true);
 assert(r.indices.includes(at(v.dims,29,20,20)));
 assert(!r.indices.includes(at(v.dims,20,29,20)));
 assert(r.indices.length>350,String(r.indices.length));
 assert.deepEqual(mask,before);
});

test('same CT-shaped proposal is invariant to affine intensity rescaling, including negative MR-like values',()=>{
 const shape=(x,y,z)=>((x-20)/8)**2+((y-20)/6)**2+((z-20)/5)**2<1;
 const [ct,mask]=fixture((x,y,z)=>shape(x,y,z)?75:-20);
 const [mr]=fixture((x,y,z)=>shape(x,y,z)?-150:230);
 const a=morphGrow(ct,mask,[20,20,20],{radiusMm:12});
 const b=morphGrow(mr,mask,[20,20,20],{radiusMm:12});
 assert.equal(a.status,'ok',a.reason);assert.equal(b.status,'ok',b.reason);
 assert.deepEqual(b.indices,a.indices);
});

test('stage 1 crosses weak interface but not strong outer interface',()=>{
 const [v,m]=fixture((x,y,z)=>{const d=Math.hypot(x-20,y-20,z-20);return d<5?80:d<9?57:-80;});
 const a=morphGrow(v,m,[20,20,20],{radiusMm:13}),b=morphGrow(v,m,[20,20,20],{radiusMm:13,stage:1});
 assert.equal(a.status,'ok',a.reason);assert.equal(b.status,'ok',b.reason);
 assert(b.indices.length>a.indices.length*2,`${a.indices.length},${b.indices.length}`);
 assert(!b.indices.includes(at(v.dims,32,20,20)));
});

test('partial local radius clipping is disclosed when another part has image edge evidence',()=>{
 const [v,m]=fixture((x,y,z)=>Math.hypot(x-20,y-20,z-20)<10?80:-80);
 const r=morphGrow(v,m,[24,20,20],{radiusMm:8});
 assert.equal(r.status,'ok',r.reason);assert.equal(r.radiusClipped,true);
 assert(r.indices.every(i=>{const x=i%41,y=Math.floor(i/41)%41,z=Math.floor(i/1681);return Math.hypot(x-24,y-20,z-20)<=8+1e-7;}));
});

test('homogeneous data and image face contact never yield partial proposals',()=>{
 const [v,m]=fixture(()=>42);
 for(const stage of [0,1]){const r=morphGrow(v,m,[20,20,20],{radiusMm:10,stage});assert.equal(r.status,'no-boundary');assert.deepEqual(r.indices,[]);}
 const [face,mask]=fixture((x,y,z)=>x<14?80:-80);
 const r=morphGrow(face,mask,[7,20,20],{radiusMm:12});
 assert.notEqual(r.status,'ok');assert.deepEqual(r.indices,[]);
});

test('sheared affine constrains physical distance and distant existing mask is preserved',()=>{
 const mat=[1,.8,0,0,1,0,0,0,3];
 const [v,m]=fixture((x,y,z)=>Math.hypot(x-20+.8*(y-20),y-20,3*(z-20))<8?80:-80,[41,41,41],mat);
 m[at(v.dims,3,3,3)]=1;
 const r=morphGrow(v,m,[20,20,20],{radiusMm:12});
 assert.equal(r.status,'ok',r.reason);
 assert(r.indices.every(i=>{let x=i%41-20,y=Math.floor(i/41)%41-20,z=Math.floor(i/1681)-20;return Math.hypot(x+.8*y,y,3*z)<=12+1e-7;}));
 assert(r.indices.includes(at(v.dims,25,20,20)));
 assert(!r.indices.includes(at(v.dims,20,20,23)));
 assert.equal(m[at(v.dims,3,3,3)],1);
});

test('cap, budget, nonfinite data and malformed geometry refuse atomically',()=>{
 const [v,m]=fixture((x,y,z)=>ell(x,y,z)<1?80:-80);
 let r=morphGrow(v,m,[20,20,20],{radiusMm:17,maxNewVoxels:15});
 assert.equal(r.status,'overflow');assert.deepEqual(r.indices,[]);
 const [large,largeMask]=fixture(()=>0,[110,110,110]);
 r=morphGrow(large,largeMask,[55,55,55],{radiusMm:100});assert.equal(r.status,'budget');assert.deepEqual(r.indices,[]);
 v.data[at(v.dims,20,20,21)]=NaN;
 r=morphGrow(v,m,[20,20,20],{radiusMm:12});assert.equal(r.status,'invalid');assert.deepEqual(r.indices,[]);
 v.data[at(v.dims,20,20,21)]=80;
 for(const [volume,opts] of [[{...v,matrix:[1,0,0,0,0,0,0,0,1]},{radiusMm:10}],[v,{radiusMm:10,stage:2}],[v,{radiusMm:Infinity}],[v,{radiusMm:10,maxNewVoxels:0}]]){
  r=morphGrow(volume,m,[20,20,20],opts);assert.equal(r.status,'invalid');assert.deepEqual(r.indices,[]);
 }
});
