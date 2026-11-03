import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveSeed,adaptiveFill} from '../dist/adaptive.mjs';

const dims=[25,25,21],matrix=[.8,0,0,0,.8,0,0,0,1.5];
const idx=(x,y,z)=>(z*dims[1]+y)*dims[0]+x;
const xyz=i=>[i%dims[0],Math.floor(i/dims[0])%dims[1],Math.floor(i/(dims[0]*dims[1]))];
function fixture({lesion=75,background=30}={}){
 const data=new Float32Array(dims.reduce((a,b)=>a*b,1)).fill(background);
 const inside=(x,y,z)=>Math.hypot((x-12)*.8,(y-12)*.8,(z-10)*1.5)<=4;
 for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)if(inside(x,y,z))data[idx(x,y,z)]=lesion+2*Math.sin(x+y+z);
 return {volume:{dims,matrix,data},inside};
}
test('adaptive seed clips its sphere to a locally homogeneous lesion',()=>{
 const {volume,inside}=fixture();const result=adaptiveSeed(volume,[13,12,10],8,50);
 assert.equal(result.status,'ok');assert(result.indices.length>100);
 assert(result.indices.every(i=>inside(...xyz(i))));
 assert(!result.indices.includes(idx(21,12,10)));
});
test('outliers outside a clean clicked center do not widen the seed',()=>{
 const {volume,inside}=fixture();volume.data[idx(12,12,11)]=280;
 const result=adaptiveSeed(volume,[12,12,10],8,50);
 assert.equal(result.status,'ok');assert(result.indices.every(i=>inside(...xyz(i))));
 assert(!result.indices.includes(idx(12,12,11)));
});
test('the same seed algorithm accepts MR-like arbitrary intensities without HU bounds',()=>{
 const {volume,inside}=fixture({lesion:880,background:620});
 const result=adaptiveSeed(volume,[12,12,10],8,50);
 assert.equal(result.status,'ok');assert(result.indices.length>100);
 assert(result.indices.every(i=>inside(...xyz(i))));
});
test('low local contrast is disclosed, not silently called a good border',()=>{
 const {volume}=fixture({lesion:730,background:730});
 const result=adaptiveSeed(volume,[12,12,10],8,50);
 assert.equal(result.status,'ok');assert.match(result.warning,/contrast|separat/i);
});
test('invalid clicks and too-large local ROI fail without an accepted mask',()=>{
 const {volume}=fixture();assert.equal(adaptiveSeed(volume,[-1,12,10],8).status,'blocked');
 assert.equal(adaptiveSeed(volume,[12,12,10],18,50,{maxNodes:100}).status,'blocked');
});
test('multiple unaccepted points yield one clipped fill without mutating the accepted mask',()=>{
 const {volume,inside}=fixture();const mask=new Uint8Array(volume.data.length);
 const result=adaptiveFill(volume,[[11,12,10],[14,12,10],[12,14,10]],[],mask,8,50);
 assert.equal(result.status,'ok');assert(result.indices.length>100);
 assert(result.indices.every(i=>inside(...xyz(i))));
 assert.equal(mask.reduce((a,b)=>a+b,0),0);
 assert(result.minIntensity>30&&result.maxIntensity<100);
});
test('calcium and water in marker neighborhoods do not force a wider corridor',()=>{
 const {volume,inside}=fixture(),mask=new Uint8Array(volume.data.length);
 for(const [x,y,z,value] of [[11,12,10,900],[12,12,10,-300],[13,12,10,900],[14,12,10,0]])volume.data[volume.dims[0]*volume.dims[1]*z+volume.dims[0]*y+x]=value;
 const result=adaptiveFill(volume,[[11,12,10],[14,12,10],[12,14,10]],[],mask,8,50);
 assert.equal(result.status,'ok');assert(result.minIntensity>40&&result.maxIntensity<100);
 assert(result.indices.every(i=>inside(...xyz(i))));
});
test('background points exclude a local patch without accepting any voxels',()=>{
 const {volume,inside}=fixture(),mask=new Uint8Array(volume.data.length),negative=[16,12,10],ni=volume.dims[0]*volume.dims[1]*negative[2]+volume.dims[0]*negative[1]+negative[0];
 const baseline=adaptiveFill(volume,[[11,12,10],[14,12,10],[12,14,10]],[],mask,8,50);
 const guided=adaptiveFill(volume,[[11,12,10],[14,12,10],[12,14,10]],[negative],mask,8,50);
 assert.equal(guided.status,'ok');assert(baseline.indices.includes(ni));assert(!guided.indices.includes(ni));
 assert(guided.indices.every(i=>inside(...xyz(i))));assert.equal(mask.reduce((a,b)=>a+b,0),0);
 assert.match(guided.warning,/overlap/);
});
