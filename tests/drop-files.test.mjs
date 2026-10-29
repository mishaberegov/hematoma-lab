import test from 'node:test';
import assert from 'node:assert/strict';
import {filesFromDrop} from '../dist/drop-files.mjs';

const fileEntry=name=>({isFile:true,file(resolve){resolve({name})}});
const directory=(batches)=>({isDirectory:true,createReader(){let next=0;return {readEntries(resolve){resolve(batches[next++]||[])}}}});

test('dropped directory recursively discovers DICOM files across readEntries batches',async()=>{
  const nested=directory([[fileEntry('slice-2')],[]]);
  const root=directory([[fileEntry('slice-1')],[nested],[]]);
  const files=await filesFromDrop({items:[{webkitGetAsEntry:()=>root}],files:[]});
  assert.deepEqual(files.map(f=>f.name),['slice-1','slice-2']);
});

test('ordinary dropped files pass through without an entry API',async()=>{
  const f={name:'scan.zip'};
  assert.deepEqual(await filesFromDrop({items:[],files:[f]}),[f]);
});

test('empty dropped directory reports a directory-specific error',async()=>{
  const root=directory([[]]);
  await assert.rejects(filesFromDrop({items:[{webkitGetAsEntry:()=>root}],files:[]}),/папк/i);
});
