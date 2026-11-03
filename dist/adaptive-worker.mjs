import {adaptiveFill} from './adaptive.mjs?v=0.8.2';
self.onmessage=({data})=>{
 const {generation,volume,positives,negatives,mask,radius,sensitivity}=data;
 const started=performance.now();
 try{
  const result=adaptiveFill(volume,positives,negatives,mask,radius,sensitivity);
  self.postMessage({generation,result,elapsedMs:performance.now()-started});
 }catch(error){self.postMessage({generation,result:{status:'refused',reason:'Computational failure: '+error.message,indices:[]},elapsedMs:performance.now()-started});}
};
