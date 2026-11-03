// Experimental local removal proposal; never mutates the accepted mask.
const refuse=(status,reason)=>({status,indices:[],reason,boundaryDetected:false,radiusClipped:false});
const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export function morphShrink(volume,mask,seedXYZ,{radiusMm,stage=0,maxRemovedVoxels=200000}={}){
 const invalid=reason=>refuse('invalid',reason);
 const dims=volume?.dims,m=volume?.matrix,data=volume?.data;
 if(!Array.isArray(dims)||dims.length!==3||dims.some(n=>!Number.isSafeInteger(n)||n<3)||
  !Number.isSafeInteger(dims[0]*dims[1]*dims[2])||!data||!mask||
  data.length!==dims[0]*dims[1]*dims[2]||mask.length!==data.length||
  !m||m.length!==9||Array.from(m).some(n=>!Number.isFinite(n))||
  !Array.isArray(seedXYZ)||seedXYZ.length!==3||seedXYZ.some((n,a)=>!Number.isInteger(n)||n<0||n>=dims[a])||
  !Number.isFinite(radiusMm)||radiusMm<=0||!Number.isSafeInteger(maxRemovedVoxels)||maxRemovedVoxels<1||
  (stage!==0&&stage!==1))return invalid('Invalid volume, affine, seed or bounds.');
 const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);
 if(!Number.isFinite(det)||Math.abs(det)<1e-10)return invalid('Singular affine.');
 const inv=[(m[4]*m[8]-m[5]*m[7])/det,(m[2]*m[7]-m[1]*m[8])/det,(m[1]*m[5]-m[2]*m[4])/det,
  (m[5]*m[6]-m[3]*m[8])/det,(m[0]*m[8]-m[2]*m[6])/det,(m[2]*m[3]-m[0]*m[5])/det,
  (m[3]*m[7]-m[4]*m[6])/det,(m[1]*m[6]-m[0]*m[7])/det,(m[0]*m[4]-m[1]*m[3])/det];
 const extent=[0,1,2].map(a=>Math.ceil(radiusMm*Math.hypot(...inv.slice(a*3,a*3+3)))+2);
 if(extent.some(n=>!Number.isSafeInteger(n)))return invalid('Physical bounds overflow.');
 const lo=extent.map((e,a)=>Math.max(0,seedXYZ[a]-e)),hi=extent.map((e,a)=>Math.min(dims[a]-1,seedXYZ[a]+e));
 const size=lo.map((l,a)=>hi[a]-l+1),count=size[0]*size[1]*size[2];
 if(!Number.isSafeInteger(count)||count>1000000)return refuse('budget','Search ROI exceeds one million voxels.');
 const [w,h]=dims,[rw,rh]=size;
 const global=(x,y,z)=>(z*h+y)*w+x;
 const local=(x,y,z)=>((z-lo[2])*rh+y-lo[1])*rw+x-lo[0];
 const within=(x,y,z)=>x>=lo[0]&&x<=hi[0]&&y>=lo[1]&&y<=hi[1]&&z>=lo[2]&&z<=hi[2];
 const face=(x,y,z)=>x===0||y===0||z===0||x===dims[0]-1||y===dims[1]-1||z===dims[2]-1;
 const distance=(x,y,z)=>{const a=x-seedXYZ[0],b=y-seedXYZ[1],c=z-seedXYZ[2];return Math.hypot(m[0]*a+m[1]*b+m[2]*c,m[3]*a+m[4]*b+m[5]*c,m[6]*a+m[7]*b+m[8]*c);};
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)
  if(!Number.isFinite(data[global(x,y,z)])||Math.abs(data[global(x,y,z)])>Number.MAX_VALUE/64)return invalid('Nonfinite or unsafe intensity in ROI.');
 const start=global(...seedXYZ);
 if(!mask[start])return refuse('no-mask','Click must be inside the accepted mask.');
 if(face(...seedXYZ))return refuse('no-boundary','Click touches image face.');
 // Contrast is learned from the bounded masked neighborhood, not from CT units.
 const values=[];
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++)
  if(mask[global(x,y,z)]&&distance(x,y,z)<=radiusMm)values.push(data[global(x,y,z)]);
 if(!values.length)return refuse('no-boundary','No accepted voxels in radius.');
 values.sort((a,b)=>a-b);
 const contrast=values[Math.floor(.95*(values.length-1))]-values[Math.floor(.05*(values.length-1))];
 if(!Number.isFinite(contrast)||contrast<=0)return refuse('no-boundary','No useful image boundary in accepted mask.');
 const seedValue=data[start],limit=contrast*(stage===0?.28:.48);
 const visited=new Uint8Array(count),queue=[seedXYZ],indices=[];
 visited[local(...seedXYZ)]=1;
 let boundaryDetected=false,radiusClipped=false,surface=false,imageFace=false;
 for(let q=0;q<queue.length;q++){
  const xyz=queue[q],gi=global(...xyz);indices.push(gi);
  if(indices.length>maxRemovedVoxels)return refuse('overflow','Removal cap exceeded; no partial proposal.');
  if(face(...xyz))imageFace=true;
  for(const d of dirs){
   const next=xyz.map((v,a)=>v+d[a]);
   if(next.some((n,a)=>n<0||n>=dims[a])){imageFace=true;continue;}
   const ni=global(...next);
   if(!mask[ni]){surface=true;continue;}
   if(!within(...next))continue;
   const li=local(...next);if(visited[li])continue;visited[li]=1;
   if(distance(...next)>radiusMm+1e-7){radiusClipped=true;continue;}
   if(Math.abs(data[ni]-seedValue)>limit){boundaryDetected=true;continue;}
   queue.push(next);
  }
 }
 if(imageFace)return refuse('no-boundary','Candidate touches image face.');
 if(!boundaryDetected||!surface)return refuse('no-boundary','No useful interface or outer surface in local radius.');
 // One-pass, mild surface support: remove only isolated terminal spurs.
 // Never trim the click itself or an outer-surface voxel; no whole-mask erosion.
 const proposed=new Set(indices);
 const supported=indices.filter(i=>{
  if(i===start)return true;
  const x=i%w,y=Math.floor(i/w)%h,z=Math.floor(i/(w*h));
  let faces=0,near=0,outer=false;
  for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy&&!dz)continue;
   const a=x+dx,b=y+dy,c=z+dz;
   if(a<0||a>=dims[0]||b<0||b>=dims[1]||c<0||c>=dims[2])continue;
   const j=global(a,b,c),isFace=Math.abs(dx)+Math.abs(dy)+Math.abs(dz)===1;
   if(isFace&&!mask[j])outer=true;
   if(proposed.has(j)){near++;if(isFace)faces++;}
  }
  return outer||faces>1||near>3;
 });
 if(!supported.length)return refuse('no-boundary','Surface support too weak.');
 return {status:'ok',indices:supported,reason:'',boundaryDetected:true,radiusClipped};
}
