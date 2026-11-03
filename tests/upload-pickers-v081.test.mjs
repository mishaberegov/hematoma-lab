import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');

test('visible picker buttons activate hidden native file and folder inputs',()=>{
 for(const [button,input] of [['pickFiles','files'],['pickFolder','folder']]){
  assert.match(html,new RegExp(`<button\\b[^>]*id=["']${button}["']`));
  assert.match(html,new RegExp(`<input\\b[^>]*id=["']${input}["'][^>]*\\bhidden\\b`));
  assert.match(app,new RegExp(`\\$\\('${button}'\\)\\.addEventListener\\('click',\\(\\)=>\\$\\('${input}'\\)\\.click\\(\\)\\)`));
 }
 assert.match(html,/<input\b[^>]*id=["']folder["'][^>]*webkitdirectory/);
 assert.match(html,/<input\b[^>]*id=["']files["'][^>]*multiple/);
});
test('both native pickers retain ingestion paths and document-wide drop',()=>{
 assert.match(app,/\$\('files'\)\.onchange=e=>scan\(e\.target\.files\)/);
 assert.match(app,/\$\('folder'\)\.onchange=e=>scan\(e\.target\.files,true\)/);
 assert.match(app,/document\.addEventListener\('drop',async e=>/);
 assert.match(app,/filesFromDrop\(e\.dataTransfer\)/);
});
test('file chooser allows extensionless DICOM just like registration',()=>{
 const files=html.match(/<input\b[^>]*id="files"[^>]*>/)?.[0];
 assert.ok(files);
 assert.doesNotMatch(files,/\baccept=/);
});
