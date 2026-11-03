import test from 'node:test';
import assert from 'node:assert/strict';
import {graphCutFill} from '../dist/graphcut.mjs';
const dims=[80,80,25], matrix=[1,0,0,0,1,0,0,0,1];
const idx=(x,y,z)=>(z*dims[1]+y)*dims[0]+x;
function scene({radius=23, homogeneous=false}={}) {
 const data=new Float32Array(dims[0]*dims[1]*dims[2]).fill(30);
 for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)if(homogeneous||Math.hypot(x-35,y-40,z-12)<=radius)data[idx(x,y,z)]=70;
 return {dims,matrix,data};
}
const run=(v,negatives,options)=>graphCutFill(v,[[35,40,12]],negatives,new Uint8Array(v.data.length),8,50,options);
test('large homogeneous hemorrhage exceeds 16 mm with explicit remote background and leaves mask untouched',()=>{
 const v=scene(), mask=new Uint8Array(v.data.length);
 const r=graphCutFill(v,[[35,40,12]],[[68,40,12]],mask,8,50);
 assert.equal(r.status,'ok',r.reason);assert(r.indices.includes(idx(55,40,12)));
 assert(!r.indices.includes(idx(68,40,12)));assert(r.indices.length>3000);
 assert.equal(mask[idx(35,40,12)],0);assert.equal(r.touchesBoundary,true);
});
test('background point inside otherwise uniform target changes graph cut locally',()=>{
 const v=scene();
 const a=run(v,[[68,40,12]]),b=run(v,[[43,40,12],[68,40,12]]);
 assert.equal(a.status,'ok');assert.equal(b.status,'ok');
 assert(a.indices.includes(idx(43,40,12)));
 assert(!b.indices.includes(idx(43,40,12)));
 assert(b.indices.includes(idx(35,40,12)));
});
test('contradictory target and background at same voxel refuses without preview',()=>{
 const v=scene();const r=run(v,[[35,40,12],[68,40,12]]);
 assert.equal(r.status,'blocked');assert.deepEqual(r.indices,[]);
});
test('search budget refusal returns no partial result',()=>{
 const v=scene();const r=run(v,[[68,40,12]],{maxNodes:100});
 assert.equal(r.status,'refused');assert.deepEqual(r.indices,[]);assert.match(r.reason,/budget/i);
});
test('no explicit background cannot silently learn a 13–16 mm normal shell',()=>{
 const r=run(scene(),[]);assert.equal(r.status,'blocked');assert.deepEqual(r.indices,[]);
});
test('search boundary contact is explicitly warned, not treated as anatomical edge',()=>{
 const r=run(scene(),[[68,40,12]]);
 assert.equal(r.status,'ok');assert.equal(r.touchesBoundary,true);assert.match(r.warning,/search boundary/i);
});
test('MR intensity units do not change the physical cut under affine scaling',()=>{
 const original=scene(),scaled=scene();
 for(let i=0;i<scaled.data.length;i++)scaled.data[i]=scaled.data[i]/1000+2;
 const a=run(original,[[68,40,12]]),b=run(scaled,[[68,40,12]]);
 assert.equal(a.status,'ok');assert.equal(b.status,'ok');
 assert.deepEqual(b.indices,a.indices);
});
