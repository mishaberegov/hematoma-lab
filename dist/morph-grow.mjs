// Experimental, browser-only local proposal. Never writes the accepted mask.
const empty=(status,reason)=>({status,indices:[],boundaryDetected:false,radiusClipped:false,reason});
const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

// A conservative one-pass surface-area regularizer: discard only unsupported
// one-voxel tendrils. It is a soft shape preference, not an anatomical prior.
export function regularizeSurface(indices,mask,dims,seedXYZ,matrix=[1,0,0,0,1,0,0,0,1]){
 const [w,h,d]=dims,wh=w*h,proposed=new Set(indices),neighbors=[];
 for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  if(!dx&&!dy&&!dz)continue;
  const length=Math.hypot(matrix[0]*dx+matrix[1]*dy+matrix[2]*dz,matrix[3]*dx+matrix[4]*dy+matrix[5]*dz,matrix[6]*dx+matrix[7]*dy+matrix[8]*dz);
  if(length<=2.5)neighbors.push([dx,dy,dz,Math.abs(dx)+Math.abs(dy)+Math.abs(dz)===1]);
 }
 if(neighbors.length<4)return indices;
 const seed=(seedXYZ[2]*h+seedXYZ[1])*w+seedXYZ[0];
 return indices.filter(i=>{
  if(i===seed)return true;
  const x=i%w,y=Math.floor(i/w)%h,z=Math.floor(i/wh);let faces=0,support=0;
  for(const [dx,dy,dz,face] of neighbors){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||nx>=w||ny<0||ny>=h||nz<0||nz>=d)continue;
   const j=(nz*h+ny)*w+nx;if(proposed.has(j)||mask[j]){support++;if(face)faces++;}
  }
  return !(faces<=2&&support<=3);
 });
}

export function morphGrow(volume,mask,seedXYZ,{radiusMm,stage=0,maxNewVoxels=200000}={}) {
 const fail=reason=>empty('invalid',reason);
 const dims=volume?.dims, data=volume?.data, m=volume?.matrix;
 if(!Array.isArray(dims)||dims.length!==3||dims.some(n=>!Number.isSafeInteger(n)||n<1)||
    !Number.isSafeInteger(dims[0]*dims[1]*dims[2])||!data||!mask||
    data.length!==dims[0]*dims[1]*dims[2]||mask.length!==data.length||
    !m||m.length!==9||Array.from(m).some(n=>!Number.isFinite(n))||
    !Array.isArray(seedXYZ)||seedXYZ.length!==3||seedXYZ.some((n,a)=>!Number.isInteger(n)||n<0||n>=dims[a])||
    !Number.isFinite(radiusMm)||radiusMm<=0||!Number.isSafeInteger(maxNewVoxels)||maxNewVoxels<1||
    (stage!==0&&stage!==1))return fail('Invalid volume, geometry, seed or bounds.');
 const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);
 if(!Number.isFinite(det)||Math.abs(det)<1e-10)return fail('Singular affine.');
 const inv=[(m[4]*m[8]-m[5]*m[7])/det,(m[2]*m[7]-m[1]*m[8])/det,(m[1]*m[5]-m[2]*m[4])/det,
 (m[5]*m[6]-m[3]*m[8])/det,(m[0]*m[8]-m[2]*m[6])/det,(m[2]*m[3]-m[0]*m[5])/det,
 (m[3]*m[7]-m[4]*m[6])/det,(m[1]*m[6]-m[0]*m[7])/det,(m[0]*m[4]-m[1]*m[3])/det];
 const extent=[0,1,2].map(a=>Math.ceil(radiusMm*Math.hypot(...inv.slice(a*3,a*3+3)))+3);
 if(extent.some(n=>!Number.isSafeInteger(n)))return fail('Physical bounds overflow.');
 const lo=extent.map((e,a)=>Math.max(0,seedXYZ[a]-e)),hi=extent.map((e,a)=>Math.min(dims[a]-1,seedXYZ[a]+e));
 const size=lo.map((l,a)=>hi[a]-l+1),count=size[0]*size[1]*size[2];
 if(!Number.isSafeInteger(count)||count>1000000)return empty('budget','Search ROI exceeds one million voxels.');
 const [w,h]=dims,[rw,rh]=size;
 const global=(x,y,z)=>(z*h+y)*w+x;
 const local=(x,y,z)=>((z-lo[2])*rh+y-lo[1])*rw+x-lo[0];
 const inside=(x,y,z)=>x>=lo[0]&&x<=hi[0]&&y>=lo[1]&&y<=hi[1]&&z>=lo[2]&&z<=hi[2];
 const distance=(x,y,z)=>{const a=x-seedXYZ[0],b=y-seedXYZ[1],c=z-seedXYZ[2];return Math.hypot(m[0]*a+m[1]*b+m[2]*c,m[3]*a+m[4]*b+m[5]*c,m[6]*a+m[7]*b+m[8]*c);};
 // Validate every value in the bounded search and its smoothing halo before producing indices.
 const samples=[];const stride=Math.max(1,Math.floor(count/1024));let ordinal=0;
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
  const value=data[global(x,y,z)];
  if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_VALUE/125)return fail('Nonfinite or unsafe intensity in search ROI.');
  if(ordinal++%stride===0)samples.push(value);
 }
 samples.sort((a,b)=>a-b);
 const seedValue=data[global(...seedXYZ)];
 const range=Math.max(samples[Math.floor(.95*(samples.length-1))]-samples[Math.floor(.05*(samples.length-1))],
  Math.abs(seedValue-samples[Math.floor(.05*(samples.length-1))]),
  Math.abs(seedValue-samples[Math.floor(.95*(samples.length-1))]));
 if(!Number.isFinite(range)||range<=0)return empty('no-boundary','No image contrast in local ROI.');
 const fine=new Float64Array(count);fine.fill(NaN);
 const mean=(x,y,z)=>{
  const li=local(x,y,z);if(!Number.isNaN(fine[li]))return fine[li];
  let total=0,n=0;
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const a=x+dx,b=y+dy,c=z+dz;
   if(inside(a,b,c)){total+=data[global(a,b,c)];n++;}
  }
  fine[li]=total/n;return fine[li];
 };
 const coarse=new Float64Array(count);coarse.fill(NaN);
 const meanCoarse=(x,y,z)=>{
  const li=local(x,y,z);if(!Number.isNaN(coarse[li]))return coarse[li];
  let sum=mean(x,y,z),n=1;
  for(const d of directions){const a=x+d[0],b=y+d[1],c=z+d[2];if(inside(a,b,c)){sum+=mean(a,b,c);n++;}}
  coarse[li]=sum/n;return coarse[li];
 };
 // Combine 3-voxel fine smoothing with a wider 5-voxel support.
 const edge=(x,y,z,d)=>{
  const a=[x-d[0],y-d[1],z-d[2]],b=[x+d[0],y+d[1],z+d[2]];
  if(!inside(...a)||!inside(...b))return 0;
  return Math.max(Math.abs(mean(...a)-mean(...b)),Math.abs(meanCoarse(...a)-meanCoarse(...b)));
 };
 const core=[];
 for(const d of directions){
  const a=seedXYZ.map((v,i)=>v-d[i]),b=seedXYZ.map((v,i)=>v+d[i]);
  if(inside(...a)&&inside(...b))core.push(Math.abs(mean(...a)-mean(...b)));
 }
 core.sort((a,b)=>a-b);
 const noise=core.length?core[Math.floor((core.length-1)*.5)]:0;
 // No fixed HU/MR intensity gate. Relax the *relative* interface threshold only on stage 1.
 const threshold=Math.max(range*(stage===0?.16:.30),noise*(stage===0?1.5:2.3));
 const affinityLimit=range*(stage===0?.125:.36);
 const seedMean=mean(...seedXYZ);
 const visited=new Uint8Array(count),queue=[seedXYZ],indices=[];
 const continuing=!!mask[global(...seedXYZ)];
 visited[local(...seedXYZ)]=1;
 if(!continuing)indices.push(global(...seedXYZ));
 let boundaryDetected=false,radiusClipped=false,imageFace=false;
 for(let q=0;q<queue.length;q++){
  const xyz=queue[q];
  if(xyz.some((n,a)=>n===0||n===dims[a]-1))imageFace=true;
  for(const d of directions){
   const next=xyz.map((v,a)=>v+d[a]);if(!inside(...next))continue;
   const li=local(...next);if(visited[li])continue;visited[li]=1;
   if(distance(...next)>radiusMm+1e-7){radiusClipped=true;continue;}
   const gi=global(...next);
   if(mask[gi]){if(continuing)queue.push(next);continue;}
   const deviation=Math.abs(mean(...next)-seedMean);
   if(deviation>affinityLimit||(deviation>range*(stage===0?.06:.10)&&edge(...next,d)>threshold)){boundaryDetected=true;continue;}
   indices.push(gi);
   if(indices.length>maxNewVoxels)return empty('overflow','New-voxel cap exceeded; no partial proposal.');
   queue.push(next);
  }
 }
 if(imageFace||!boundaryDetected||indices.length===0)return empty('no-boundary',imageFace?'Candidate touches image face.':'No reliable boundary within local radius.');
 const smoothed=regularizeSurface(indices,mask,dims,seedXYZ,m);
 if(!smoothed.length)return empty('no-boundary','Surface support too weak for a safe local proposal.');
 // Regularization can cut a narrow bridge. Retain only new cells still
 // face-connected to the clicked accepted component, never detached islands.
 let connected=smoothed;
 if(continuing){
  const proposed=new Set(smoothed),reached=new Set(),seen=new Uint8Array(count),front=[seedXYZ];
  seen[local(...seedXYZ)]=1;
  for(let q=0;q<front.length;q++)for(const d of directions){
   const next=front[q].map((v,a)=>v+d[a]);if(!inside(...next)||distance(...next)>radiusMm+1e-7)continue;
   const li=local(...next);if(seen[li])continue;seen[li]=1;
   const gi=global(...next);
   if(mask[gi]||proposed.has(gi)){
    if(proposed.has(gi))reached.add(gi);
    front.push(next);
   }
  }
  connected=smoothed.filter(i=>reached.has(i));
 }
 if(!connected.length)return empty('no-boundary','Surface support too weak for a safe local proposal.');
 return {status:'ok',indices:connected,boundaryDetected:true,radiusClipped,reason:''};
}
