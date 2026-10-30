import test from 'node:test';
import assert from 'node:assert/strict';
import {index,planePixel,voxelFromPlane,displayVoxelFromPlane,displayPlanePixel,displayRowIndex,worldAt,planeAspect,localEdit,history,volumes,autoSeed,stepPlaneSlice,dragWindow,dragZoom} from '../dist/algorithm.mjs';
const dims=[9,9,5], data=new Float32Array(9*9*5).fill(0);
const v={dims,data,matrix:[.5,0,0,0,.8,0,0,0,2],origin:[10,20,30]};
const at=(x,y,z)=>index(dims,x,y,z);
test('window drag changes level vertically and width horizontally, keeping width positive',()=>{
 assert.deepEqual(dragWindow(60,160,25,-50),{level:28,width:176});
 assert.equal(dragWindow(60,160,-1000,0).width,1);
});
test('zoom drag matches registration exponential scaling and limits',()=>{
 assert.equal(dragZoom(1,-100),Math.exp(.8));
 assert.equal(dragZoom(6,-100),6);
 assert.equal(dragZoom(1,1000),.2);
});
test('wheel steps only the slice axis of its view and clamps at volume edges',()=>{
 const shape=[9,9,5],cursor=[4,5,2];
 assert.deepEqual(stepPlaneSlice(shape,'axial',cursor,1),[4,5,3]);
 assert.deepEqual(stepPlaneSlice(shape,'coronal',cursor,-1),[4,4,2]);
 assert.deepEqual(stepPlaneSlice(shape,'sagittal',cursor,1),[5,5,2]);
 assert.deepEqual(stepPlaneSlice(shape,'axial',[4,5,4],1),[4,5,4]);
 assert.deepEqual(cursor,[4,5,2]);
});
test('three planes map pixel coordinates to same voxel and physical axes',()=>{
  assert.deepEqual(voxelFromPlane('axial',3,4,2),[3,4,2]);
  assert.deepEqual(voxelFromPlane('coronal',3,2,4),[3,4,2]);
  assert.deepEqual(voxelFromPlane('sagittal',4,2,3),[3,4,2]);
  for(const plane of ['axial','coronal','sagittal']) assert.deepEqual(planePixel(plane,[3,4,2]),plane==='axial'?[3,4]:plane==='coronal'?[3,2]:[4,2]);
  assert.deepEqual(worldAt(v,[3,4,2]),[11.5,23.2,34]);
});
test('view aspect uses physical pixel size, not square canvas coordinates',()=>{
  const sample={...v,dims:[100,80,20]};
  assert.equal(planeAspect(sample,'axial'),(100*.5)/(80*.8));
  assert.equal(planeAspect(sample,'coronal'),(100*.5)/(20*2));
  assert.equal(planeAspect(sample,'sagittal'),(80*.8)/(20*2));
});
test('superior is above inferior in both vertical MPR views regardless of slice axis direction',()=>{
 const positive={...v,dims:[9,9,5]};
 for(const plane of ['coronal','sagittal']){
  assert.deepEqual(displayVoxelFromPlane(positive,plane,2,0,3),plane==='coronal'?[2,3,4]:[3,2,4]);
  assert.deepEqual(displayPlanePixel(positive,plane,[3,2,4]),plane==='coronal'?[3,0]:[2,0]);
  const negative={...positive,matrix:[.5,0,0,0,.8,0,0,0,-2]};
  assert.deepEqual(displayVoxelFromPlane(negative,plane,2,0,3),plane==='coronal'?[2,3,0]:[3,2,0]);
  assert.deepEqual(displayPlanePixel(negative,plane,[3,2,0]),plane==='coronal'?[3,0]:[2,0]);
 }
});
test('linear display row indexing matches voxel mapping for every plane and slice direction',()=>{
 for(const sign of [1,-1]){
  const sample={...v,dims:[7,5,4],matrix:[.5,0,0,0,.8,0,0,0,sign*2]};
  for(const plane of ['axial','coronal','sagittal']){
   const w=plane==='sagittal'?5:7,h=plane==='axial'?5:4,slices=plane==='axial'?4:plane==='coronal'?5:7;
   for(let slice=0;slice<slices;slice++)for(let b=0;b<h;b++){
    const [start,stride]=displayRowIndex(sample,plane,b,slice);
    for(let a=0;a<w;a++)assert.equal(start+a*stride,index(sample.dims,...displayVoxelFromPlane(sample,plane,a,b,slice)));
   }
  }
 }
});
test('grow can connect a clicked blood voxel two voxels from an existing contour',()=>{
  const volume={...v,data:new Float32Array(data)};const mask=new Uint8Array(data.length);
  mask[at(2,4,2)]=1;
  for(let x=3;x<=5;x++)volume.data[at(x,4,2)]=65;
  const changes=localEdit(volume,mask,[5,4,2],1,'grow',2,1);
  assert(changes.includes(at(5,4,2)));
  assert(changes.includes(at(3,4,2)));
});
test('local 3D grow remains near seed and changes exact physical volume',()=>{
  const volume={...v,data:new Float32Array(data).fill(60)};const mask=new Uint8Array(data.length);
  mask[at(4,4,2)]=1;
  const changes=localEdit(volume,mask,[5,4,2],1,'grow',2,1);
  assert(changes.length>0);assert(changes.every(i=>Math.hypot((i%9-5)*.5,(Math.floor(i/9)%9-4)*.8,(Math.floor(i/81)-2)*2)<=2));
  for(const i of changes) mask[i]=1;
  assert.equal(volumes(mask,v)[1],(changes.length+1)*.5*.8*2/1000);
});
test('grow cannot leak to disconnected HU island',()=>{
  const volume={...v,data:new Float32Array(data)};const mask=new Uint8Array(data.length);mask[at(2,4,2)]=1;
  for(let x=2;x<=3;x++)volume.data[at(x,4,2)]=65;
  volume.data[at(5,4,2)]=65;
  const changes=localEdit(volume,mask,[3,4,2],1,'grow',5,1);
  assert(!changes.includes(at(5,4,2)));
});
test('shrink remains local; undo and redo restore exactly',()=>{
  const volume={...v,data:new Float32Array(data).fill(60)};const mask=new Uint8Array(data.length).fill(1);const before=mask.slice();
  const changes=localEdit(volume,mask,[0,4,2],1,'shrink',1,1);assert(changes.includes(at(0,4,2)));assert(changes.length<mask.length/4);
  const h=history(mask);h.commit(changes,0);assert.equal(mask[at(0,4,2)],0);
  h.undo();assert.deepEqual(mask,before);h.redo();assert.equal(mask[at(0,4,2)],0);
});
test('shrink does not punch a closed cavity inside a thick segmentation',()=>{
  const volume={...v,data:new Float32Array(data).fill(60)};const mask=new Uint8Array(data.length).fill(1);
  assert.deepEqual(localEdit(volume,mask,[4,4,2],1,'shrink',1,1),[]);
});
test('shrink recognizes a neighboring compartment as the target mask surface',()=>{
 const volume={...v,data:new Float32Array(data).fill(60)},mask=new Uint8Array(data.length).fill(2);
 for(let z=1;z<=3;z++)for(let y=3;y<=5;y++)for(let x=3;x<=5;x++)mask[at(x,y,z)]=1;
 const changes=localEdit(volume,mask,[4,4,2],1,'shrink',2,1);
 assert(changes.includes(at(4,4,2)));
 assert(changes.includes(at(3,4,2)));
 assert(changes.every(i=>mask[i]===1),'shrink cannot remove the adjacent compartment');
});
test('CT seed is 3D connected, never selects disconnected bone or remote blood',()=>{
  const volume={...v,data:new Float32Array(data)};
  volume.data[at(4,4,2)]=65;volume.data[at(4,4,3)]=72;volume.data[at(8,8,2)]=70;volume.data[at(5,4,2)]=450;
  const hits=autoSeed(volume,[4,4,2],30,100);
  assert.deepEqual(hits.sort((a,b)=>a-b),[at(4,4,2),at(4,4,3)].sort((a,b)=>a-b));
});
test('CT seed remains local even when normal tissue joins a huge HU-qualified component',()=>{
 const dims=[80,80,80],volume={dims,data:new Float32Array(80**3).fill(60),matrix:[1,0,0,0,1,0,0,0,1]};
 const hits=autoSeed(volume,[40,40,40],30,100,8);
 assert(hits.length>0);
 assert(hits.length<3000,'a local seed must not select the whole 512000-voxel component');
 assert(hits.every(i=>{const x=i%80,y=Math.floor(i/80)%80,z=Math.floor(i/6400);return Math.hypot(x-40,y-40,z-40)<=8+1e-7;}));
});
test('accepted label changes keep weighted volumes exact through undo and redo',()=>{
 const grid={dims:[3,2,2],matrix:[1,0,0,0,1,0,0,0,1],sourceDims:[5,3,2],reductionFactor:2};
 const mask=new Uint8Array(12),h=history(mask,grid),edge=index(grid.dims,2,1,0),center=index(grid.dims,0,0,0);
 h.commit([center,edge],1);
 assert.deepEqual(h.volumes(),volumes(mask,grid));
 h.commit([edge],2);
 assert.deepEqual(h.volumes(),volumes(mask,grid));
 h.undo();assert.deepEqual(h.volumes(),volumes(mask,grid));
 h.undo();assert.deepEqual(h.volumes(),volumes(mask,grid));
 h.redo();h.redo();assert.deepEqual(h.volumes(),volumes(mask,grid));
});
test('derived-grid volume weights partial edge blocks by their actual source-pixel area',()=>{
 const derived={dims:[3,2,3],matrix:[1,0,0,0,1,0,0,0,1],sourceDims:[5,3,3],reductionFactor:2};
 const mask=new Uint8Array(18);mask[index(derived.dims,0,0,0)]=1;mask[index(derived.dims,2,1,0)]=2;
 const m=volumes(mask,derived);
 assert.equal(m[1],4*.5*.5/1000);assert.equal(m[2],.5*.5/1000);
 mask.fill(1);
 assert.equal(volumes(mask,derived).total,5*3*3*.5*.5/1000);
});
