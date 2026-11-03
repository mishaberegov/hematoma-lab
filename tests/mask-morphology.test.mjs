import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proposeMaskMorphology} from '../dist/mask-morphology.mjs';

const at=(d,x,y,z)=>(z*d[1]+y)*d[0]+x;
function fixture(d=[9,9,9],matrix=[1,0,0,0,1,0,0,0,1]){
 return [{dims:d,matrix},new Uint8Array(d[0]*d[1]*d[2])];
}
function box(mask,d,lo,hi,value=1){for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)mask[at(d,x,y,z)]=value;}

test('erosion previews a noisy speck and surface layer without mutating input',()=>{
 const [v,m]=fixture();box(m,v.dims,[2,2,2],[6,6,6]);m[at(v.dims,0,0,0)]=2;
 const before=m.slice(),r=proposeMaskMorphology(v,m,{operation:'erode'});
 assert.equal(r.status,'ok');assert.equal(r.operation,'erode');assert.equal(r.radiusMm,1);
 assert.deepEqual(r.added,[]);assert(r.removed.includes(at(v.dims,0,0,0)));
 assert(!r.removed.includes(at(v.dims,4,4,4)));assert(r.removed.includes(at(v.dims,2,4,4)));
 assert.match(r.reason,/preview|thin/i);assert.deepEqual(m,before);
});

test('opening removes specks and staircase protrusions but restores a broad lesion core',()=>{
 const [v,m]=fixture([13,13,13]);box(m,v.dims,[3,3,3],[9,9,9]);m[at(v.dims,2,6,6)]=1;m[at(v.dims,1,6,6)]=1;m[at(v.dims,0,0,0)]=1;
 const e=proposeMaskMorphology(v,m,{operation:'erode',radiusMm:1});
 const o=proposeMaskMorphology(v,m,{operation:'open',radiusMm:1});
 assert.equal(o.status,'ok');assert(o.removed.includes(at(v.dims,1,6,6)));assert(o.removed.includes(at(v.dims,0,0,0)));
 assert(!o.removed.includes(at(v.dims,3,5,6)));assert(e.removed.includes(at(v.dims,3,5,6)));
 assert.deepEqual(o.added,[]);assert(o.removed.length<e.removed.length);
});

test('closing previews a one-voxel interior hole without mutating the mask',()=>{
 const [v,m]=fixture([9,9,9]);box(m,v.dims,[2,2,2],[6,6,6]);
 const hole=at(v.dims,4,4,4);m[hole]=0;const before=m.slice();
 const r=proposeMaskMorphology(v,m,{operation:'close',radiusMm:1});
 assert.equal(r.status,'ok');assert.equal(r.operation,'close');assert.equal(r.radiusMm,1);
 assert.deepEqual(r.added,[hole]);assert.deepEqual(r.removed,[]);
 assert.deepEqual(m,before);assert.match(r.reason,/preview/i);
});

test('closing joins a narrow step but neither a broad gap nor distant islands at 1 mm',()=>{
 const [v,m]=fixture([19,11,11]);
 box(m,v.dims,[2,2,2],[6,8,8]);box(m,v.dims,[8,2,2],[12,8,8]);
 // One voxel between the broad facing surfaces, and a stepped notch.
 m[at(v.dims,6,5,5)]=0;
 box(m,v.dims,[16,4,4],[17,6,6]);
 const r=proposeMaskMorphology(v,m,{operation:'close',radiusMm:1});
 assert.equal(r.status,'ok');assert(r.added.includes(at(v.dims,7,5,5)));
 assert(r.added.includes(at(v.dims,6,5,5)));
 assert(!r.added.some(i=>i%v.dims[0]===14));
 const [v2,m2]=fixture([21,11,11]);
 box(m2,v2.dims,[2,2,2],[6,8,8]);box(m2,v2.dims,[10,2,2],[14,8,8]);
 const wide=proposeMaskMorphology(v2,m2,{operation:'close',radiusMm:1});
 assert.equal(wide.status,'ok');assert(!wide.added.some(i=>[7,8,9].includes(i%v2.dims[0])));
});

test('closing respects 5 mm slices and the full sheared affine',()=>{
 const [v,m]=fixture([9,9,3],[1,0,0,0,1,0,0,0,5]);
 box(m,v.dims,[2,2,1],[6,6,1]);m[at(v.dims,4,4,1)]=0;
 const r=proposeMaskMorphology(v,m,{operation:'close',radiusMm:1});
 assert.equal(r.status,'ok');assert.deepEqual(r.added,[at(v.dims,4,4,1)]);
 assert(!r.added.some(i=>Math.floor(i/(v.dims[0]*v.dims[1]))!==1));
 const [s,q]=fixture([11,11,3],[1,-1,0,0,0.2,0,0,0,5]);
 box(q,s.dims,[2,2,1],[8,8,1]);q[at(s.dims,5,5,1)]=0;
 const sheared=proposeMaskMorphology(s,q,{operation:'close',radiusMm:0.5});
 assert.equal(sheared.status,'ok');assert(sheared.added.includes(at(s.dims,5,5,1)));
});

test('closing treats image exterior as background without wraparound',()=>{
 const [v,m]=fixture([9,9,9]);box(m,v.dims,[0,2,2],[5,6,6]);
 m[at(v.dims,1,4,4)]=0;
 const r=proposeMaskMorphology(v,m,{operation:'close',radiusMm:1});
 assert.equal(r.status,'ok');assert(r.added.includes(at(v.dims,1,4,4)));
 assert(r.removed.includes(at(v.dims,0,4,4)));
 assert(r.added.every(i=>i>=0&&i<m.length));
});

test('closing empty mask is no-op and invalid input refuses',()=>{
 const [v,m]=fixture([8,8,8]);
 assert.deepEqual(proposeMaskMorphology(v,m,{operation:'close',maxRoiVoxels:1}),{status:'ok',removed:[],added:[],reason:'No target voxels to change; review preview before acceptance.',operation:'close',radiusMm:1});
 for(const options of [{operation:'close',radiusMm:0},{operation:'close',maxRoiVoxels:0},{operation:'close',radiusMm:1e200}]){
  const r=proposeMaskMorphology(v,m,options);assert.equal(r.status,'invalid');assert.deepEqual(r.added,[]);
 }
});

test('closing refuses an over-budget halo before yielding any partial delta',()=>{
 const [v,m]=fixture([20,20,20]);box(m,v.dims,[8,8,8],[10,10,10]);const before=m.slice();
 const r=proposeMaskMorphology(v,m,{operation:'close',radiusMm:1,maxRoiVoxels:27});
 assert.equal(r.status,'budget');assert.match(r.reason,/halo|budget/i);
 assert.deepEqual(r.added,[]);assert.deepEqual(r.removed,[]);assert.deepEqual(m,before);
});

test('5 mm slice spacing prevents through-slice erosion at 1 mm',()=>{
 const [v,m]=fixture([7,7,3],[1,0,0,0,1,0,0,0,5]);box(m,v.dims,[1,1,1],[5,5,1]);
 const r=proposeMaskMorphology(v,m,{operation:'erode',radiusMm:1});
 assert.equal(r.status,'ok');assert(!r.removed.includes(at(v.dims,3,3,1)));
 assert(r.removed.includes(at(v.dims,1,3,1)));
});

test('full shear affine includes diagonal physical neighbors',()=>{
 const [v,m]=fixture([9,9,3],[1,-1,0,0,0.2,0,0,0,5]);
 box(m,v.dims,[1,1,1],[7,7,1]);m[at(v.dims,5,5,1)]=0;
 const r=proposeMaskMorphology(v,m,{operation:'erode',radiusMm:0.5});
 assert.equal(r.status,'ok');assert(r.removed.includes(at(v.dims,4,4,1)));
});

test('image faces are exterior background and thin structures only change in a reviewable delta',()=>{
 const [v,m]=fixture([5,5,5]);box(m,v.dims,[0,1,1],[3,3,3]);
 const r=proposeMaskMorphology(v,m,{operation:'erode'});
 assert.equal(r.status,'ok');assert(r.removed.includes(at(v.dims,0,2,2)));
 assert(!r.removed.includes(at(v.dims,2,2,2)));
 const thin=new Uint8Array(m.length);thin[at(v.dims,2,2,2)]=1;
 const t=proposeMaskMorphology(v,thin,{operation:'open'});
 assert.equal(t.status,'ok');assert.deepEqual(t.removed,[at(v.dims,2,2,2)]);
 assert.match(t.reason,/thin|preview/i);assert.equal(thin[at(v.dims,2,2,2)],1);
});

test('empty mask is a complete no-op even under a small ROI budget',()=>{
 const [v,m]=fixture([100,100,100]);
 assert.deepEqual(proposeMaskMorphology(v,m,{operation:'open',maxRoiVoxels:1}),{status:'ok',removed:[],added:[],reason:'No target voxels to change; review preview before acceptance.',operation:'open',radiusMm:1});
});

test('explicit budget refusal has no partial delta',()=>{
 const [v,m]=fixture();box(m,v.dims,[1,1,1],[7,7,7]);
 const r=proposeMaskMorphology(v,m,{operation:'open',maxRoiVoxels:100});
 assert.equal(r.status,'budget');assert.deepEqual(r.removed,[]);assert.deepEqual(r.added,[]);assert.match(r.reason,/budget/i);
});

test('invalid dimensions, matrix, input, options and mask length refuse',()=>{
 const [v,m]=fixture();
 for(const [vol,mask,opt] of [[v,m,{operation:'blur'}],[v,m,{operation:'erode',radiusMm:0}],[v,m,{operation:'open',maxRoiVoxels:0}],[{...v,matrix:[1,0,0,0,0,0,0,0,1]},m,{operation:'erode'}],[v,new Uint8Array(3),{operation:'open'}],[{...v,dims:[1.5,9,9]},m,{operation:'erode'}]]){
  const r=proposeMaskMorphology(vol,mask,opt);assert.equal(r.status,'invalid');assert.deepEqual(r.removed,[]);assert.deepEqual(r.added,[]);
 }
});

test('extreme finite radius whose square overflows is invalid rather than an all-image edit',()=>{
 const [v,m]=fixture();m[at(v.dims,4,4,4)]=1;
 const r=proposeMaskMorphology(v,m,{operation:'erode',radiusMm:1e200});
 assert.equal(r.status,'invalid');assert.deepEqual(r.removed,[]);
});

test('delta supports a single undo action and disjoint lists',()=>{
 const [v,m]=fixture();box(m,v.dims,[2,2,2],[6,6,6]);const before=m.slice();
 const r=proposeMaskMorphology(v,m,{operation:'open'});
 assert.equal(r.status,'ok');assert.equal(new Set(r.removed).size,r.removed.length);
 assert(r.removed.every(i=>!r.added.includes(i)&&before[i]!==0));
 const edited=m.slice();for(const i of r.removed)edited[i]=0;for(const i of r.added)edited[i]=1;
 assert.deepEqual(m,before);for(const i of r.removed)edited[i]=before[i];for(const i of r.added)edited[i]=before[i];assert.deepEqual(edited,before);
});
