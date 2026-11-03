import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const source=['clearMorph','cursorMode','setCursorMode','selectedTool','updateMorphAvailability'].map(name=>{
 const line=app.split('\n').find(line=>line.startsWith(`function ${name}(`));
 assert.ok(line,`missing ${name}`);
 return line;
}).join('\n');
function harness(){
 const tools=['adaptive-seed','adaptive-exclude','morph-grow','morph-shrink'].map(value=>({value,checked:value==='adaptive-seed'}));
 const ops=['open','close'].map(value=>({value,checked:false,disabled:false}));
 const nodes={cursorMode:{pressed:'true',getAttribute(){return this.pressed;},setAttribute(_key,value){this.pressed=value;}},'tool-adaptive-seed':tools[0],morphPreview:{disabled:false},morphAccept:{hidden:true},morphDiscard:{hidden:true}};
 const document={getElementById:id=>nodes[id],querySelectorAll:selector=>selector.includes('morphOperation')?ops:tools,querySelector:selector=>selector.includes('morphOperation')?ops.find(x=>x.checked):tools.find(x=>x.checked)};
 const context=vm.createContext({document,draw(){},action(){},msg:x=>x});
 vm.runInContext(`let volume=null,edits=null,morphWorker=null,morphCandidate=null,morphGeneration=0;const $=id=>document.getElementById(id);${source}`,context);
 const evaluate=expression=>vm.runInContext(expression,context);
 return {tools,ops,nodes,evaluate};
}
test('cursor removes tool; returning to editing selects target and clears cleanup',()=>{
 const h=harness();h.evaluate('setCursorMode(true)');assert.equal(h.tools.filter(x=>x.checked).length,0);
 h.evaluate('setCursorMode(false)');assert.equal(h.tools.find(x=>x.checked)?.value,'adaptive-seed');
 h.ops[0].checked=true;h.evaluate('setCursorMode(true)');assert.equal(h.ops[0].checked,true);
 h.evaluate('setCursorMode(false)');assert.equal(h.ops.some(x=>x.checked),false);
});
test('accepted mask gates both cleanup choices and preview and zero mask clears selection',()=>{
 const h=harness();h.evaluate('updateMorphAvailability()');assert.equal(h.ops.every(x=>x.disabled),true);
 h.evaluate('volume={};edits={volumes:()=>({total:0.002})};setCursorMode(true);updateMorphAvailability()');
 assert.equal(h.ops.every(x=>!x.disabled),true);assert.equal(h.nodes.morphPreview.disabled,true);
 h.ops[0].checked=true;h.evaluate('updateMorphAvailability()');assert.equal(h.nodes.morphPreview.disabled,false);
 h.evaluate('edits={volumes:()=>({total:0})};updateMorphAvailability()');
 assert.equal(h.ops.some(x=>x.checked),false);assert.equal(h.nodes.morphPreview.disabled,true);
 h.evaluate('volume=null;edits=null;updateMorphAvailability()');assert.equal(h.ops.every(x=>x.disabled),true);
});
