import test from 'node:test';
import assert from 'node:assert/strict';
import {index,planePixel,voxelFromPlane,worldAt,planeAspect,localEdit,history,volumes,autoSeed} from '../dist/algorithm.mjs';
const dims=[9,9,5], data=new Float32Array(9*9*5).fill(0);
const v={dims,data,matrix:[.5,0,0,0,.8,0,0,0,2],origin:[10,20,30]};
const at=(x,y,z)=>index(dims,x,y,z);
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
test('CT seed is 3D connected, never selects disconnected bone or remote blood',()=>{
  const volume={...v,data:new Float32Array(data)};
  volume.data[at(4,4,2)]=65;volume.data[at(4,4,3)]=72;volume.data[at(8,8,2)]=70;volume.data[at(5,4,2)]=450;
  const hits=autoSeed(volume,[4,4,2],30,100);
  assert.deepEqual(hits.sort((a,b)=>a-b),[at(4,4,2),at(4,4,3)].sort((a,b)=>a-b));
});
