import {proposeMaskMorphology} from './mask-morphology.mjs?v=0.7.8';
self.onmessage=({data})=>{
  try{self.postMessage({result:proposeMaskMorphology(data.volume,data.mask,data.options)});}
  catch(error){self.postMessage({result:{status:'invalid',reason:'Mask cleanup computation failed: '+error.message,removed:[],added:[]}});}
};
