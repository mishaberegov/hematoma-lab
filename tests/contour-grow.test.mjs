import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contourGrow} from '../dist/contour-grow.mjs';

const idx=(d,x,y,z)=>(z*d[1]+y)*d[0]+x;
function fixture(fn, dims=[33,33,33], matrix=[1,0,0,0,1,0,0,0,1]) {
 const data=new Float32Array(dims.reduce((a,b)=>a*b));
 for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)data[idx(dims,x,y,z)]=fn(x,y,z);
 return {volume:{dims,data,matrix},mask:new Uint8Array(data.length)};
}
const distance=(x,y,z)=>Math.hypot(x-16,y-16,z-16);

test('sharp 3D contour retains heterogeneous CT interior without leaking background or changing mask',()=>{
 const {volume,mask}=fixture((x,y,z)=>distance(x,y,z)<7?75+((x*13+y*7+z*11)%9)*4:5+((x+y+z)%5));
 mask[idx(volume.dims,16,16,16)]=1;
 const before=mask.slice();
 const result=contourGrow(volume,mask,[16,16,16],{radiusMm:12});
 assert.equal(result.status,'ok');assert.equal(result.boundaryDetected,true);
 assert.ok(result.indices.length>500,result.indices.length);
 assert.ok(result.indices.every(i=>{const x=i%33,y=Math.floor(i/33)%33,z=Math.floor(i/1089);return distance(x,y,z)<8 && mask[i]===0;}));
 assert.deepEqual(mask,before);
});

test('MR-valued negative and positive interior grows without CT HU gates, from a disconnected click',()=>{
 const {volume,mask}=fixture((x,y,z)=>Math.hypot(x-23,y-16,z-16)<5?-110+((x*3+y+z)%7)*8:300);
 mask[idx(volume.dims,4,4,4)]=1;
 const result=contourGrow(volume,mask,[23,16,16],{radiusMm:9});
 assert.equal(result.status,'ok');assert.ok(result.indices.includes(idx(volume.dims,23,16,16)));
 assert.equal(mask[idx(volume.dims,4,4,4)],1);
});

test('stage 1 can cross a weaker interface but still stops at a stronger surrounding 3D interface',()=>{
 const {volume,mask}=fixture((x,y,z)=>distance(x,y,z)<5?80+((x+y+z)%3)*3:distance(x,y,z)<9?57+((x+y+z)%3)*3:-80);
 const first=contourGrow(volume,mask,[16,16,16],{radiusMm:13,stage:0});
 const later=contourGrow(volume,mask,[16,16,16],{radiusMm:13,stage:1});
 assert.equal(first.status,'ok');assert.equal(later.status,'ok');
 assert.ok(later.indices.length>first.indices.length*2,[first.indices.length,later.indices.length]);
 assert.ok(later.indices.every(i=>{const x=i%33,y=Math.floor(i/33)%33,z=Math.floor(i/1089);return distance(x,y,z)<10;}));
});

test('local contour edits may stop at a physical radius after detecting an edge on only part of a large lesion',()=>{
 const {volume,mask}=fixture((x,y,z)=>Math.hypot(x-16,y-16,z-16)<9?80:-80);
 const seed=[20,16,16],result=contourGrow(volume,mask,seed,{radiusMm:8});
 assert.equal(result.status,'ok');
 assert.equal(result.boundaryDetected,true);
 assert.equal(result.radiusClipped,true);
 assert(result.indices.length>0);
 assert(result.indices.every(i=>{const x=i%33,y=Math.floor(i/33)%33,z=Math.floor(i/1089);return Math.hypot(x-seed[0],y-seed[1],z-seed[2])<=8;}));
});

test('no reliable edge and radius-limited homogeneous background refuse with no accept-able partial proposal',()=>{
 const {volume,mask}=fixture(()=>42);
 for(const stage of [0,1]){const result=contourGrow(volume,mask,[16,16,16],{radiusMm:10,stage});assert.equal(result.status,'no-boundary');assert.deepEqual(result.indices,[]);}
});

test('full affine (including shear) constrains physical distance rather than axis-aligned voxel distance',()=>{
 const matrix=[1,0.8,0,0,1,0,0,0,3];
 const {volume,mask}=fixture((x,y,z)=>Math.hypot(x-16+.8*(y-16),y-16,3*(z-16))<8?80:-80,[33,33,33],matrix);
 const result=contourGrow(volume,mask,[16,16,16],{radiusMm:12});
 assert.equal(result.status,'ok');
 assert.ok(result.indices.every(i=>{const x=i%33-16,y=Math.floor(i/33)%33-16,z=Math.floor(i/1089)-16;return Math.hypot(x+.8*y,y,3*z)<=12+1e-7;}));
 assert.ok(result.indices.some(i=>i%33===20));
 assert.ok(!result.indices.some(i=>Math.floor(i/1089)===18));
});

test('new-voxel cap and ROI budget refuse atomically, not truncated accept-able results',()=>{
 const {volume,mask}=fixture((x,y,z)=>distance(x,y,z)<9?80:-80);
 const capped=contourGrow(volume,mask,[16,16,16],{radiusMm:12,maxNewVoxels:20});
 assert.equal(capped.status,'overflow');assert.deepEqual(capped.indices,[]);
 const huge=contourGrow({...volume,dims:[10000,10000,10]},mask,[16,16,16],{radiusMm:10000});
 assert.equal(huge.status,'invalid');assert.deepEqual(huge.indices,[]);
});

test('nonfinite sampled data and invalid geometry/options refuse explicitly',()=>{
 const {volume,mask}=fixture((x,y,z)=>distance(x,y,z)<7?80:-80);
 volume.data[idx(volume.dims,16,16,17)]=NaN;
 assert.equal(contourGrow(volume,mask,[16,16,16],{radiusMm:10}).status,'invalid');
 volume.data[idx(volume.dims,16,16,17)]=80;
 for(const options of [{radiusMm:Infinity},{radiusMm:10,stage:2},{radiusMm:10,maxNewVoxels:0}]){
  const result=contourGrow(volume,mask,[16,16,16],options);assert.equal(result.status,'invalid');assert.deepEqual(result.indices,[]);
 }
 assert.equal(contourGrow({...volume,matrix:[1,0,0,0,0,0,0,0,1]},mask,[16,16,16],{radiusMm:10}).status,'invalid');
});

test('finite numeric extremes whose neighborhood arithmetic overflows refuse without indices',()=>{
 const {volume,mask}=fixture(()=>0);
 volume.data=new Float64Array(volume.data.length);
 volume.data.fill(1e308);
 const result=contourGrow(volume,mask,[16,16,16],{radiusMm:10});
 assert.equal(result.status,'invalid');assert.deepEqual(result.indices,[]);
});
