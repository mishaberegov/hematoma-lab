import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createLoadState} from '../dist/load-state.mjs';

const app=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function syncLoadControls(){'),app.indexOf("window.addEventListener('resize'"));
function harness(){
 const select={hidden:true,disabled:false,value:'',options:[],replaceChildren(...options){this.options=options;this.value=options[0]?.value||'';}},load={hidden:true,disabled:false},nodes={series:select,load};
 const created=[];let shown=null,clears=0;
 class WorkerFake{constructor(){this.sent=[];this.terminated=false;created.push(this);}postMessage(message){this.sent.push(message);}terminate(){this.terminated=true;}send(data){this.onmessage({data});}}
 const context=vm.createContext({loadState:createLoadState(),inputGate:{begin(){}},worker:null,Worker:WorkerFake,document:{createElement:()=>({})},$:id=>nodes[id],lang:()=> 'en',msg:x=>x,t:x=>x,translateBackend:x=>x,describeLocalizedInput:()=>'',status(){},clearVolume(){clears++;shown=null;},setVolume(volume){shown=volume;}});
 vm.runInContext(source,context);
 return {context,select,load,created,scan:files=>vm.runInContext('scan(files)',Object.assign(context,{files})),start:key=>vm.runInContext('startBuild(key)',Object.assign(context,{key})),get shown(){return shown;},get clears(){return clears;}};
}
const group=key=>({key,name:key,modality:'CT',frames:1,dims:[2,2,2]});

test('rapid A then B cannot display A while the chooser indicates B',()=>{
 const h=harness();h.scan([{name:'synthetic',size:1}]);const w=h.created[0];
 w.send({type:'groups',groups:[group('A'),group('B')],skipped:0});
 assert.equal(h.select.hidden,false);
 h.start('A');assert.equal(h.select.disabled,true);assert.equal(h.load.disabled,true);
 assert.equal(h.start('B'),false);
 assert.equal(w.sent.filter(m=>m.type==='build').length,1);
 const request=w.sent.find(m=>m.type==='build');
 w.send({type:'volume',key:'B',requestId:request.requestId,volume:{id:'wrong'}});
 assert.equal(h.shown,null);
});

test('a completed build re-enables another series and an old worker cannot replace a new scan',()=>{
 const h=harness();h.scan([{name:'first',size:1}]);const old=h.created[0];old.send({type:'groups',groups:[group('A'),group('B')],skipped:0});
 h.start('A');const request=old.sent.find(m=>m.type==='build');
 old.send({...request,type:'volume',volume:{id:'A'}});
 assert.equal(h.shown.id,'A');assert.equal(h.select.disabled,false);
 h.select.value='B';assert.equal(h.start('B'),true);
 h.scan([{name:'second',size:1}]);assert.equal(old.terminated,true);
 old.send({...request,type:'volume',volume:{id:'stale'}});
 assert.equal(h.shown,null);
});
