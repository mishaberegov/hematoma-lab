// Experimental, unaccepted local proposal. The caller must review indices before committing.
const refusal=(status,reason)=>({indices:[],status,boundaryDetected:false,reason});

export function contourGrow(volume,mask,seedXYZ,{radiusMm,stage=0,maxNewVoxels=200000}={}) {
 const invalid=reason=>refusal('invalid',reason);
 const dims=volume?.dims, data=volume?.data, m=volume?.matrix;
 if(!Array.isArray(dims)||dims.length!==3||dims.some(n=>!Number.isSafeInteger(n)||n<1)||
    dims[0]*dims[1]*dims[2]>Number.MAX_SAFE_INTEGER||
    !data||!mask||data.length!==dims[0]*dims[1]*dims[2]||mask.length!==data.length||
    !m||m.length!==9||Array.from(m).some(n=>!Number.isFinite(n))||
    !Array.isArray(seedXYZ)||seedXYZ.length!==3||seedXYZ.some((n,a)=>!Number.isInteger(n)||n<0||n>=dims[a])||
    !Number.isFinite(radiusMm)||radiusMm<=0||!Number.isSafeInteger(maxNewVoxels)||maxNewVoxels<1||
    (stage!==0&&stage!==1))return invalid('Invalid volume, geometry, seed or bounds.');
 const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);
 if(!Number.isFinite(det)||Math.abs(det)<1e-10)return invalid('Singular or nonfinite affine.');
 const inverse=[(m[4]*m[8]-m[5]*m[7])/det,(m[2]*m[7]-m[1]*m[8])/det,(m[1]*m[5]-m[2]*m[4])/det,
 (m[5]*m[6]-m[3]*m[8])/det,(m[0]*m[8]-m[2]*m[6])/det,(m[2]*m[3]-m[0]*m[5])/det,
 (m[3]*m[7]-m[4]*m[6])/det,(m[1]*m[6]-m[0]*m[7])/det,(m[0]*m[4]-m[1]*m[3])/det];
 const extent=[0,1,2].map(a=>Math.ceil(radiusMm*Math.hypot(...inverse.slice(3*a,3*a+3)))+2);
 if(extent.some(n=>!Number.isSafeInteger(n)))return invalid('Physical bounds overflow.');
 const lo=extent.map((n,a)=>Math.max(0,seedXYZ[a]-n)),hi=extent.map((n,a)=>Math.min(dims[a]-1,seedXYZ[a]+n));
 const size=lo.map((n,a)=>hi[a]-n+1),count=size[0]*size[1]*size[2];
 if(!Number.isSafeInteger(count)||count>1000000)return refusal('budget','Search ROI exceeds one million voxels.');
 const [w,h]=dims,wh=w*h,[rw,rh]=size,rwh=rw*rh;
 const local=(x,y,z)=>((z-lo[2])*rh+y-lo[1])*rw+x-lo[0];
 const global=(x,y,z)=>(z*h+y)*w+x;
 // Reject malformed samples before any proposal, including the smoothing halo.
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)
  if(!Number.isFinite(data[global(x,y,z)])||Math.abs(data[global(x,y,z)])>Number.MAX_VALUE/54)
   return invalid('Nonfinite intensity or unsafe arithmetic range in search ROI.');
 const smooth=new Float64Array(count);smooth.fill(NaN);
 const mean=(x,y,z)=>{
  const i=local(x,y,z);if(!Number.isNaN(smooth[i]))return smooth[i];
  let sum=0,n=0;
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const a=x+dx,b=y+dy,c=z+dz;
   if(a>=lo[0]&&a<=hi[0]&&b>=lo[1]&&b<=hi[1]&&c>=lo[2]&&c<=hi[2]){sum+=data[global(a,b,c)];n++;}
  }
  smooth[i]=sum/n;return smooth[i];
 };
 const offsets=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 const inside=(x,y,z)=>x>=lo[0]&&x<=hi[0]&&y>=lo[1]&&y<=hi[1]&&z>=lo[2]&&z<=hi[2];
 const distance=(x,y,z)=>{
  const a=x-seedXYZ[0],b=y-seedXYZ[1],c=z-seedXYZ[2];
  return Math.hypot(m[0]*a+m[1]*b+m[2]*c,m[3]*a+m[4]*b+m[5]*c,m[6]*a+m[7]*b+m[8]*c);
 };
 // Robust local contrast floor; the edge itself is evaluated from spatially averaged
 // opposite-side neighborhoods, not from the intensity of a single candidate voxel.
 const core=[];
 for(let z=Math.max(lo[2]+1,seedXYZ[2]-2);z<=Math.min(hi[2]-1,seedXYZ[2]+2);z++)
  for(let y=Math.max(lo[1]+1,seedXYZ[1]-2);y<=Math.min(hi[1]-1,seedXYZ[1]+2);y++)
   for(let x=Math.max(lo[0]+1,seedXYZ[0]-2);x<=Math.min(hi[0]-1,seedXYZ[0]+2);x++)
    if(distance(x,y,z)<=Math.min(2.5,radiusMm/3))
     for(let a=0;a<3;a++){const d=offsets[2*a];core.push(Math.abs(mean(x+d[0],y+d[1],z+d[2])-mean(x-d[0],y-d[1],z-d[2])));}
 core.sort((a,b)=>a-b);
 const baseline=core.length?core[Math.floor((core.length-1)*.8)]:0;
 const threshold=(Math.max(3,Math.abs(data[global(...seedXYZ)])*.05)+2*baseline)*(stage===1?3:1);
 const visited=new Uint8Array(count),queue=[seedXYZ],indices=[];
 visited[local(...seedXYZ)]=1;
 if(!mask[global(...seedXYZ)])indices.push(global(...seedXYZ));
 if(indices.length>maxNewVoxels)return refusal('overflow','New-voxel cap exceeded; no partial proposal.');
 let boundaryDetected=false,touchedRadius=false,touchedImage=false;
 for(let p=0;p<queue.length;p++){
  const xyz=queue[p],current=mean(...xyz);
  if(xyz.some((n,a)=>n===0||n===dims[a]-1))touchedImage=true;
  for(const d of offsets){
   const x=xyz[0]+d[0],y=xyz[1]+d[1],z=xyz[2]+d[2];
   if(!inside(x,y,z))continue;
   const li=local(x,y,z);if(visited[li])continue;visited[li]=1;
   if(distance(x,y,z)>radiusMm+1e-7){touchedRadius=true;continue;}
   const gi=global(x,y,z);if(mask[gi])continue;
   const bx=x+d[0],by=y+d[1],bz=z+d[2];
   // Gradient across three smoothed planes supplies coherent neighbor evidence.
   const contrast=Math.abs((inside(bx,by,bz)?mean(bx,by,bz):mean(x,y,z))-current);
   if(contrast>threshold){boundaryDetected=true;continue;}
   indices.push(gi);
   if(indices.length>maxNewVoxels)return refusal('overflow','New-voxel cap exceeded; no partial proposal.');
   queue.push([x,y,z]);
  }
 }
 if(touchedImage||!boundaryDetected)return refusal('no-boundary',touchedImage?'Candidate touches the image edge.':'No reliable boundary inside the local radius.');
 // A local edit may intentionally stop at its physical radius; this is not a complete lesion proposal.
 return {indices,status:'ok',boundaryDetected:true,radiusClipped:touchedRadius,reason:'',stage,threshold};
}
