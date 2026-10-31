// Local image-guided seed: an mm sphere is the search limit, never a forced mask.
const flat=(dims,x,y,z)=>(z*dims[1]+y)*dims[0]+x;
function inverse3(m){
 const [a,b,c,d,e,f,g,h,i]=m,A=e*i-f*h,B=c*h-b*i,C=b*f-c*e,D=f*g-d*i,E=a*i-c*g,F=c*d-a*f,G=d*h-e*g,H=b*g-a*h,I=a*e-b*d,det=a*A+b*D+c*G;
 if(!Number.isFinite(det)||Math.abs(det)<1e-9)throw Error('Invalid physical geometry');
 return [A,B,C,D,E,F,G,H,I].map(x=>x/det);
}
const quantile=(a,q)=>a[Math.floor((a.length-1)*q)];
const median=a=>quantile([...a].sort((x,y)=>x-y),.5);
export function adaptiveSeed(volume,point,radiusMm=8,sensitivity=50,{maxNodes=350000}={}){
 const blocked=reason=>({status:'blocked',reason,indices:[]});
 const {dims,data,matrix}=volume||{};
 if(!dims||dims.length!==3||!data||data.length!==dims[0]*dims[1]*dims[2]||!matrix||matrix.length!==9)return blocked('Invalid image volume');
 if(!Array.isArray(point)||point.some((v,a)=>!Number.isInteger(v)||v<0||v>=dims[a]))return blocked('Click outside image');
 if(!Number.isFinite(radiusMm)||radiusMm<=0||!Number.isFinite(sensitivity)||sensitivity<0||sensitivity>100)return blocked('Invalid adaptive seed settings');
 const centerIndex=flat(dims,...point);if(!Number.isFinite(data[centerIndex]))return blocked('Click a finite image voxel');
 let inv;try{inv=inverse3(matrix);}catch(e){return blocked(e.message);}
 const lo=[],hi=[];for(let axis=0;axis<3;axis++){
  const reach=Math.ceil(radiusMm*Math.hypot(...inv.slice(axis*3,axis*3+3)));
  lo[axis]=Math.max(0,point[axis]-reach);hi[axis]=Math.min(dims[axis],point[axis]+reach+1);
 }
 const size=hi.map((v,a)=>v-lo[a]),n=size[0]*size[1]*size[2];if(n>maxNodes)return blocked('Local 3D search exceeds safety limit');
 const local=new Float32Array(n),distance=new Float32Array(n),core=[],ring=[];
 const inner=Math.min(2,Math.max(.8,radiusMm*.28));
 for(let z=0;z<size[2];z++)for(let y=0;y<size[1];y++)for(let x=0;x<size[0];x++){
  const gx=lo[0]+x,gy=lo[1]+y,gz=lo[2]+z,k=flat(size,x,y,z),value=data[flat(dims,gx,gy,gz)],dx=gx-point[0],dy=gy-point[1],dz=gz-point[2];
  const mm=Math.hypot(matrix[0]*dx+matrix[1]*dy+matrix[2]*dz,matrix[3]*dx+matrix[4]*dy+matrix[5]*dz,matrix[6]*dx+matrix[7]*dy+matrix[8]*dz);
  local[k]=value;distance[k]=mm;
  if(Number.isFinite(value)){if(mm<=inner)core.push(value);else if(mm>=radiusMm*.78&&mm<=radiusMm)ring.push(value);}
 }
 if(core.length<3)return blocked('Too few finite pixels in click core');
 core.sort((a,b)=>a-b);const mid=quantile(core,.5),mad=median(core.map(v=>Math.abs(v-mid))),spread=Math.max((quantile(core,.9)-quantile(core,.1))/2,1.4826*mad,Math.abs(mid)*.02,.01);
 const tolerance=(1.5+2*sensitivity/100)*spread;
 if(Math.abs(data[centerIndex]-mid)>tolerance)return blocked('Clicked voxel is an outlier in its own local core');
 const ringMedian=ring.length>=5?median(ring):null;
 const warning=ringMedian===null?'Insufficient local background to verify contrast.':Math.abs(mid-ringMedian)<2*spread?'Low local contrast: intensity alone may not separate the lesion from its surroundings.':'';
 const start=flat(size,...point.map((v,a)=>v-lo[a])),queue=new Int32Array(n),seen=new Uint8Array(n),indices=[];let read=0,write=0;queue[write++]=start;seen[start]=1;
 while(read<write){
  const k=queue[read++],x=k%size[0],y=Math.floor(k/size[0])%size[1],z=Math.floor(k/(size[0]*size[1])),value=local[k];
  if(distance[k]>radiusMm+1e-6||!Number.isFinite(value)||Math.abs(value-mid)>tolerance)continue;
  indices.push(flat(dims,lo[0]+x,lo[1]+y,lo[2]+z));
  for(const next of [x>0?k-1:-1,x+1<size[0]?k+1:-1,y>0?k-size[0]:-1,y+1<size[1]?k+size[0]:-1,z>0?k-size[0]*size[1]:-1,z+1<size[2]?k+size[0]*size[1]:-1])if(next>=0&&!seen[next]){seen[next]=1;queue[write++]=next;}
 }
 if(!indices.length)return blocked('No connected pixels match the clean click core');
 return {status:'ok',indices,median:mid,tolerance,backgroundMedian:ringMedian,warning,coreCount:core.length};
}
