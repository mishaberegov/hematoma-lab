// The DICOM loader's transitions are independent of DOM controls and Worker timing.
export function createLoadState(){
 let phase='idle',requestId=0,key=null,keys=[];
 return {
  snapshot(){return {phase,key,requestId};},
  beginScan(){phase='scanning';key=null;keys=[];return ++requestId;},
  found(foundKeys){
   if(phase!=='scanning')return false;
   keys=[...foundKeys];phase=keys.length?'choosing':'failed';return true;
  },
  beginBuild(selectedKey){
   if(phase!=='choosing'&&phase!=='ready'||!keys.includes(selectedKey))return null;
   phase='building';key=selectedKey;return {key,requestId:++requestId};
  },
  acceptVolume(result){
   if(phase!=='building'||result?.key!==key||result?.requestId!==requestId)return false;
   phase='ready';return true;
  },
  fail(){phase='failed';key=null;keys=[];requestId++;}
 };
}
