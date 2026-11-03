import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const update=app.slice(app.indexOf('function updatePreview(){'),app.indexOf('function adaptiveMl('));

test('release of a safe but partially revealed Grow preview commits only the visible fragment',()=>{
  assert.match(app,/changes=shrinking&&!holding\.visibleComplete\?\[\]:preview\|\|\[\]/);
  assert.match(app,/changed=blocked\|\|denied\?0:edits\.commit\(changes,shrinking\?0:holding\.label\)/);
});

test('partial Grow release retains the proposal radius-clipping warning',()=>{
  assert.match(update,/if\(stage===0\)\{holding\.pendingMorph=result;holding\.radiusClipped=result\.radiusClipped;/);
});

test('continuing Grow keeps every earlier revealed voxel even if a later stage differs',()=>{
  let now=0;
  const context=vm.createContext({
    performance:{now:()=>now},volume:{},mask:{},preview:null,
    holding:{tool:'morph-grow',xyz:[1,1,1],lastStage:-1,lastRadius:null,boundaryAt:null},
    $:()=>({value:'8'}),shapeName:()=> 'Grow',lang:()=> 'en',
    t:()=>'',action(){},draw(){},msg:()=>'',translateBackend:x=>x,
    morphGrow:(_v,_m,_xyz,{stage})=>({status:'ok',indices:stage?[0,11,12]:[0,1,2,3,4,5,6,7,8,9],radiusClipped:false}),
    morphShrink:()=>{throw Error('unexpected shrink');}
  });
  vm.runInContext(update,context);
  vm.runInContext('updatePreview()',context);
  now=500;vm.runInContext('updatePreview()',context);
  assert.deepEqual(Array.from(context.preview),[0,1,2,3,4]);
  now=1000;vm.runInContext('updatePreview()',context);
  assert.deepEqual(Array.from(context.preview),[0,1,2,3,4,5,6,7,8,9]);
  now=2300;vm.runInContext('updatePreview()',context);
  assert.deepEqual(Array.from(context.preview),[0,1,2,3,4,5,6,7,8,9,11,12]);
});
