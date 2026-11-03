// Non-destructive, physical-space morphology. The returned delta is a preview,
// not a commit: callers must explicitly review/accept it as one undoable edit.
const DEFAULT_MAX_ROI_VOXELS=3_000_000;
const MAX_OFFSET_BOX=100_000;
const MAX_NEIGHBOR_CHECKS=100_000_000;
const refusal=(status,reason)=>({status,removed:[],added:[],reason});

export function proposeMaskMorphology(volume,mask,{operation,radiusMm=1,maxRoiVoxels=DEFAULT_MAX_ROI_VOXELS}={}){
 const dims=volume?.dims,m=volume?.matrix;
 if(!Array.isArray(dims)||dims.length!==3||!dims.every(n=>Number.isSafeInteger(n)&&n>0)
  ||!Array.isArray(m)||m.length!==9||!m.every(Number.isFinite)
  ||!(mask instanceof Uint8Array)||!['erode','open'].includes(operation)
  ||!Number.isFinite(radiusMm)||radiusMm<=0||!Number.isFinite(radiusMm*radiusMm)||!Number.isSafeInteger(maxRoiVoxels)||maxRoiVoxels<1)
  return refusal('invalid','Invalid mask, volume geometry, operation or morphology options.');
 const [w,h,d]=dims,n=w*h*d;
 const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);
 if(!Number.isSafeInteger(n)||mask.length!==n||!Number.isFinite(det)||Math.abs(det)<1e-12)
  return refusal('invalid','Invalid mask length or singular volume geometry.');
 const inverse=[
  (m[4]*m[8]-m[5]*m[7])/det,(m[2]*m[7]-m[1]*m[8])/det,(m[1]*m[5]-m[2]*m[4])/det,
  (m[5]*m[6]-m[3]*m[8])/det,(m[0]*m[8]-m[2]*m[6])/det,(m[2]*m[3]-m[0]*m[5])/det,
  (m[3]*m[7]-m[4]*m[6])/det,(m[1]*m[6]-m[0]*m[7])/det,(m[0]*m[4]-m[1]*m[3])/det
 ];
 const reach=[0,1,2].map(i=>Math.min(dims[i],Math.floor(radiusMm*Math.hypot(...inverse.slice(3*i,3*i+3))+1e-9)));
 if(reach.some(v=>!Number.isSafeInteger(v)))return refusal('invalid','Invalid physical neighborhood.');
 // The source bounding box is enough: opening is anti-extensive, and only
 // source voxels can appear in either output. Image exterior is background.
 let lo=[w,h,d],hi=[-1,-1,-1];
 for(let i=0;i<n;i++)if(mask[i]){
  const x=i%w,y=Math.floor(i/w)%h,z=Math.floor(i/(w*h));
  if(x<lo[0])lo[0]=x;if(y<lo[1])lo[1]=y;if(z<lo[2])lo[2]=z;
  if(x>hi[0])hi[0]=x;if(y>hi[1])hi[1]=y;if(z>hi[2])hi[2]=z;
 }
 if(hi[0]<0)return {status:'ok',removed:[],added:[],reason:'No target voxels to change; review preview before acceptance.',operation,radiusMm};
 const size=hi.map((v,i)=>v-lo[i]+1),roi=size[0]*size[1]*size[2];
 if(!Number.isSafeInteger(roi)||roi>maxRoiVoxels)
  return refusal('budget',`Mask ROI exceeds the ${maxRoiVoxels}-voxel budget; no partial preview.`);
 const box=reach.reduce((a,r)=>a*(2*r+1),1);
 if(!Number.isSafeInteger(box)||box>MAX_OFFSET_BOX||roi*box>MAX_NEIGHBOR_CHECKS)
  return refusal('budget','Physical-neighborhood compute budget exceeded; no partial preview.');
 const offsets=new Int32Array(box*3);let count=0;
 const r2=radiusMm*radiusMm;
 for(let z=-reach[2];z<=reach[2];z++)for(let y=-reach[1];y<=reach[1];y++)for(let x=-reach[0];x<=reach[0];x++){
  const px=m[0]*x+m[1]*y+m[2]*z,py=m[3]*x+m[4]*y+m[5]*z,pz=m[6]*x+m[7]*y+m[8]*z;
  if(px*px+py*py+pz*pz<=r2+1e-9){offsets[count*3]=x;offsets[count*3+1]=y;offsets[count*3+2]=z;count++;}
 }
 // One compact ROI buffer, never a full-volume list of source coordinates.
 const eroded=new Uint8Array(roi),sx=size[0],sy=size[1];
 const local=(x,y,z)=>((z-lo[2])*sy+y-lo[1])*sx+x-lo[0];
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
  if(!mask[(z*h+y)*w+x])continue;
  let survives=true;
  for(let j=0;j<count;j++){
   const a=x+offsets[3*j],b=y+offsets[3*j+1],c=z+offsets[3*j+2];
   if(a<0||a>=w||b<0||b>=h||c<0||c>=d||!mask[(c*h+b)*w+a]){survives=false;break;}
  }
  if(survives)eroded[local(x,y,z)]=1;
 }
 const removed=[];
 for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
  const index=(z*h+y)*w+x;if(!mask[index])continue;
  let remains=!!eroded[local(x,y,z)];
  if(operation==='open'&&!remains)for(let j=0;j<count;j++){
   const a=x+offsets[3*j],b=y+offsets[3*j+1],c=z+offsets[3*j+2];
   if(a>=lo[0]&&a<=hi[0]&&b>=lo[1]&&b<=hi[1]&&c>=lo[2]&&c<=hi[2]&&eroded[local(a,b,c)]){remains=true;break;}
  }
  if(!remains)removed.push(index);
 }
 return {status:'ok',removed,added:[],reason:`Preview only: ${removed.length} voxels would be removed; thin regions may disappear. Review before acceptance.`,operation,radiusMm};
}
