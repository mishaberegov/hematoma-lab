export const index=(dims,x,y,z)=>(z*dims[1]+y)*dims[0]+x;
export function dragWindow(level,width,dx,dy){const step=Math.max(1,width)/250;return {level:level+dy*step,width:Math.max(1,width+dx*step)};}
export function dragZoom(zoom,dy){return Math.max(.2,Math.min(6,zoom*Math.exp(-dy*.008)));}
export function stepPlaneSlice(dims,plane,xyz,direction){const axis=plane==='axial'?2:plane==='coronal'?1:0,next=xyz.slice();next[axis]=Math.max(0,Math.min(dims[axis]-1,next[axis]+Math.sign(direction)));return next;}
export function voxelFromPlane(plane,a,b,slice){return plane==='axial'?[a,b,slice]:plane==='coronal'?[a,slice,b]:[slice,a,b];}
export function planePixel(plane,[x,y,z]){return plane==='axial'?[x,y]:plane==='coronal'?[x,z]:[y,z];}
// DICOM LPS: patient superior is positive Z. Display superior at canvas top.
const displayZ=(v,z)=>v.matrix[8]>0?v.dims[2]-1-z:z;
export function displayVoxelFromPlane(v,plane,a,b,slice){return voxelFromPlane(plane,a,plane==='axial'?b:displayZ(v,b),slice);}
export function displayRowIndex(v,plane,b,slice){
 const [w,h]=v.dims,z=plane==='axial'?slice:displayZ(v,b);
 return plane==='axial'?[(z*h+b)*w,1]:plane==='coronal'?[(z*h+slice)*w,1]:[(z*h)*w+slice,w];
}
export function displayPlanePixel(v,plane,xyz){const [a,b]=planePixel(plane,xyz);return [a,plane==='axial'?b:displayZ(v,b)];}
export function planeZoomOrigin(v,plane,xyz){const [a,b]=displayPlanePixel(v,plane,xyz),[w,h]=v.dims;return [100*(a+.5)/(plane==='sagittal'?h:w),100*(b+.5)/(plane==='axial'?h:v.dims[2])];}
export function worldAt(v,[x,y,z]){const m=v.matrix;return v.origin.map((o,i)=>o+m[i*3]*x+m[i*3+1]*y+m[i*3+2]*z);}
export function planeAspect(v,plane){
  const [horizontal,vertical]=plane==='axial'?[0,1]:plane==='coronal'?[0,2]:[1,2];
  const length=axis=>Math.hypot(v.matrix[axis],v.matrix[axis+3],v.matrix[axis+6]);
  return v.dims[horizontal]*length(horizontal)/(v.dims[vertical]*length(vertical));
}
const neighbours=(dims,i)=>{const [w,h,d]=dims,z=Math.floor(i/(w*h)),y=Math.floor(i/w)%h,x=i%w,r=[];if(x)r.push(i-1);if(x<w-1)r.push(i+1);if(y)r.push(i-w);if(y<h-1)r.push(i+w);if(z)r.push(i-w*h);if(z<d-1)r.push(i+w*h);return r;};
const valid=(v,[x,y,z])=>Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)&&x>=0&&y>=0&&z>=0&&x<v.dims[0]&&y<v.dims[1]&&z<v.dims[2];
export function localEdit(v,mask,seed,label,mode,radiusMm,strength=1){
  if(!valid(v,seed)||!Number.isFinite(radiusMm)||radiusMm<=0||!Number.isFinite(strength)||strength<=0)return [];
  const start=index(v.dims,...seed),adding=mode==='grow';if(mode!=='grow'&&mode!=='shrink')throw Error('Unknown edit mode');
  if(!adding&&mask[start]!==label)return [];
  if(adding&&(mask[start]!==0||!Number.isFinite(v.data[start])||v.data[start]<30||v.data[start]>100))return [];
  const visited=new Uint8Array(mask.length),queue=[start],result=[];visited[start]=1;let touchesBoundary=false;
  for(let p=0;p<queue.length;p++){
    const i=queue[p],x=i%v.dims[0],y=Math.floor(i/v.dims[0])%v.dims[1],z=Math.floor(i/(v.dims[0]*v.dims[1]));
    const m=v.matrix,dx=x-seed[0],dy=y-seed[1],dz=z-seed[2];
    if(Math.hypot(m[0]*dx+m[1]*dy+m[2]*dz,m[3]*dx+m[4]*dy+m[5]*dz,m[6]*dx+m[7]*dy+m[8]*dz)>radiusMm*strength+1e-7)continue;
    if(adding?(mask[i]!==0||!Number.isFinite(v.data[i])||v.data[i]<30||v.data[i]>100):mask[i]!==label)continue;
    result.push(i);
    const adjacent=neighbours(v.dims,i);
    if(adding){if(adjacent.some(j=>mask[j]===label))touchesBoundary=true;}
    else if(x===0||y===0||z===0||x===v.dims[0]-1||y===v.dims[1]-1||z===v.dims[2]-1||adjacent.some(j=>mask[j]!==label))touchesBoundary=true;
    for(const j of adjacent)if(!visited[j]){visited[j]=1;queue.push(j);}
  }
  return touchesBoundary?result:[];
}
export function autoSeed(v,seed,minHU=30,maxHU=100,radiusMm=8){
  if(!valid(v,seed)||!Number.isFinite(radiusMm)||radiusMm<=0)return [];
  const start=index(v.dims,...seed),seen=new Uint8Array(v.data.length),queue=[start],result=[];seen[start]=1;
  for(let p=0;p<queue.length;p++){
    const i=queue[p],x=i%v.dims[0],y=Math.floor(i/v.dims[0])%v.dims[1],z=Math.floor(i/(v.dims[0]*v.dims[1])),m=v.matrix;
    const dx=x-seed[0],dy=y-seed[1],dz=z-seed[2];
    if(Math.hypot(m[0]*dx+m[1]*dy+m[2]*dz,m[3]*dx+m[4]*dy+m[5]*dz,m[6]*dx+m[7]*dy+m[8]*dz)>radiusMm+1e-7)continue;
    const hu=v.data[i];if(!Number.isFinite(hu)||hu<minHU||hu>maxHU)continue;result.push(i);
    for(const j of neighbours(v.dims,i))if(!seen[j]){seen[j]=1;queue.push(j);}
  }
  return result;
}
export function proposeFill(v,mask,label,markers,excluded=[],marginMm=8,sensitivity=50){
  const empty=reason=>({indices:[],reason,minHU:null,maxHU:null});
  if(!Number.isFinite(marginMm)||marginMm<=0)return empty('Invalid physical margin.');
  if(!Number.isFinite(sensitivity)||sensitivity<0||sensitivity>100)return empty('Fill sensitivity must be 0–100.');
  const positives=markers.filter(m=>m.label===label&&valid(v,m.xyz)&&mask[index(v.dims,...m.xyz)]===label);
  if(positives.length<3)return empty('Place at least three accepted seed spheres around the target first.');
  const samples=[];
  for(const marker of positives){const centerHU=v.data[index(v.dims,...marker.xyz)];for(const i of marker.indices){const hu=v.data[i];if(mask[i]===label&&Number.isFinite(hu)&&Math.abs(hu-centerHU)<=15)samples.push(hu);}}
  if(samples.length<3)return empty('Not enough accepted CT pixels to estimate a local HU range.');
  samples.sort((a,b)=>a-b);
  const quantile=p=>samples[Math.floor((samples.length-1)*p)];
  const huPadding=2+sensitivity*.12;
  let minHU=Math.max(20,quantile(.1)-huPadding),maxHU=Math.min(120,quantile(.9)+huPadding);
  const negatives=excluded.filter(xyz=>valid(v,xyz));
  const negativeHU=negatives.map(xyz=>v.data[index(v.dims,...xyz)]).filter(Number.isFinite);
  if(negativeHU.length){
    const mean=negativeHU.reduce((a,b)=>a+b,0)/negativeHU.length,positive=quantile(.5);
    if(mean<positive-8)minHU=Math.max(minHU,(mean+positive)/2);
    if(mean>positive+8)maxHU=Math.min(maxHU,(mean+positive)/2);
  }
  if(minHU>maxHU)return empty('Positive and exclusion samples have incompatible HU.');
  const spacing=[0,1,2].map(axis=>Math.hypot(v.matrix[axis],v.matrix[axis+3],v.matrix[axis+6]));
  if(spacing.some(s=>!Number.isFinite(s)||s<=0))return empty('Invalid CT geometry.');
  const lo=[0,1,2].map(axis=>Math.max(0,Math.min(...positives.map(p=>p.xyz[axis]))-Math.ceil(marginMm/spacing[axis])));
  const hi=[0,1,2].map(axis=>Math.min(v.dims[axis]-1,Math.max(...positives.map(p=>p.xyz[axis]))+Math.ceil(marginMm/spacing[axis])));
  if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>3000000)return empty('Marker region exceeds 3 million grid voxels; place marks more locally.');
  const blocked=(x,y,z)=>negatives.some(n=>{
    const d=[x-n[0],y-n[1],z-n[2]],m=v.matrix;
    return Math.hypot(m[0]*d[0]+m[1]*d[1]+m[2]*d[2],m[3]*d[0]+m[4]*d[1]+m[5]*d[2],m[6]*d[0]+m[7]*d[1]+m[8]*d[2])<=Math.min(3,marginMm/2);
  });
  const queue=[],seen=new Set(),indices=[],[w,h]=v.dims;
  for(const marker of positives)for(const i of marker.indices)if(mask[i]===label&&!seen.has(i)){seen.add(i);queue.push(i);}
  for(let p=0;p<queue.length;p++){
    const i=queue[p],x=i%w,y=Math.floor(i/w)%h,z=Math.floor(i/(w*h));
    for(const j of neighbours(v.dims,i)){
      if(seen.has(j))continue;seen.add(j);
      const nx=j%w,ny=Math.floor(j/w)%h,nz=Math.floor(j/(w*h));
      if(nx<lo[0]||nx>hi[0]||ny<lo[1]||ny>hi[1]||nz<lo[2]||nz>hi[2]||blocked(nx,ny,nz)||mask[j]!==0)continue;
      const hu=v.data[j];if(!Number.isFinite(hu)||hu<minHU||hu>maxHU)continue;
      indices.push(j);queue.push(j);
      if(indices.length>200000)return empty('Proposed fill exceeds 200,000 voxels; add exclusion marks or tighten the marked region.');
    }
  }
  return {indices,minHU,maxHU,reason:indices.length?'':'No connected, HU-matched voxels between the marks.'};
}
export function history(mask,v){const undoStack=[],redoStack=[],counts={};
  const factor=v?.reductionFactor||1,[w,h]=v?.dims||[0,0],sourceWidth=v?.sourceDims?.[0],sourceHeight=v?.sourceDims?.[1];
  const weight=i=>factor===1?1:Math.min(factor,sourceWidth-(i%w)*factor)*Math.min(factor,sourceHeight-(Math.floor(i/w)%h)*factor);
  if(v)for(let i=0;i<mask.length;i++)if(mask[i])counts[mask[i]]=(counts[mask[i]]||0)+weight(i);
  const apply=(changes,forward)=>{for(const [i,old,next] of changes){const from=forward?old:next,to=forward?next:old;if(v){const n=weight(i);if(from)counts[from]-=n;if(to)counts[to]=(counts[to]||0)+n;}mask[i]=to;}};
  return {
  commit(indices,label){const changes=Array.from(new Set(indices)).filter(i=>mask[i]!==label).map(i=>[i,mask[i],label]);apply(changes,true);if(changes.length){undoStack.push(changes);redoStack.length=0;}return changes.length;},
  undo(){const changes=undoStack.pop();if(!changes)return false;apply(changes,false);redoStack.push(changes);return true;},
  redo(){const changes=redoStack.pop();if(!changes)return false;apply(changes,true);undoStack.push(changes);return true;},
  volumes(){if(!v)throw Error('Volume geometry required');const m=v.matrix,voxel=Math.abs(m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]))/1000,unit=voxel/(factor*factor),out={total:0};for(const [label,count] of Object.entries(counts))if(count){out[label]=count*unit;out.total+=out[label];}return out;}
};}
export function volumes(mask,v){const m=v.matrix;const voxel=Math.abs(m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]))/1000;
  const factor=v.reductionFactor||1,counts={};
  if(factor===1){for(const label of mask)if(label)counts[label]=(counts[label]||0)+1;}
  else{const [w,h]=v.dims,[sourceWidth,sourceHeight]=v.sourceDims;
   for(let i=0;i<mask.length;i++){const label=mask[i];if(!label)continue;
    const x=i%w,y=Math.floor(i/w)%h;
    counts[label]=(counts[label]||0)+Math.min(factor,sourceWidth-x*factor)*Math.min(factor,sourceHeight-y*factor);
   }
  }
  const unit=factor===1?voxel:voxel/(factor*factor),out={total:0};
  for(const [label,count] of Object.entries(counts)){out[label]=count*unit;out.total+=out[label];}return out;
}
