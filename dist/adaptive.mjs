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

// Markers are measurements, not accepted spheres. Propose one bounded mask at once.
export function adaptiveFill(volume,positives,negatives,mask,radiusMm=8,sensitivity=50,{maxNodes=3000000,maxProposal=200000}={}){
 const blocked=reason=>({status:'blocked',reason,indices:[]});
 const {dims,data,matrix}=volume||{};
 if(!dims||dims.length!==3||!data||data.length!==dims[0]*dims[1]*dims[2]||!matrix||matrix.length!==9||mask?.length!==data.length)return blocked('Invalid image or mask');
 const valid=p=>Array.isArray(p)&&p.length===3&&p.every((v,a)=>Number.isInteger(v)&&v>=0&&v<dims[a]);
 if(!Array.isArray(positives)||!positives.length||positives.length>64||positives.some(p=>!valid(p)))return blocked('Place up to 64 positive points inside the target');
 if(!Array.isArray(negatives)||negatives.length>64||negatives.some(p=>!valid(p)))return blocked('Invalid background points');
 if(!Number.isFinite(radiusMm)||radiusMm<=0||!Number.isFinite(sensitivity)||sensitivity<0||sensitivity>100)return blocked('Invalid fill settings');
 let inv;try{inv=inverse3(matrix);}catch(e){return blocked(e.message);}
 const spacing=[0,1,2].map(a=>Math.hypot(inv[a*3],inv[a*3+1],inv[a*3+2]));
 const lo=[0,1,2].map(a=>Math.max(0,Math.min(...positives.map(p=>p[a]))-Math.ceil(radiusMm*spacing[a])));
 const hi=[0,1,2].map(a=>Math.min(dims[a]-1,Math.max(...positives.map(p=>p[a]))+Math.ceil(radiusMm*spacing[a])));
 const size=hi.map((v,a)=>v-lo[a]+1),n=size[0]*size[1]*size[2];if(n>maxNodes)return {status:'refused',reason:'Computational resource refusal: marker ROI exceeds the bounded search budget; no complete diagnostic or preview computed.',indices:[],roiVoxels:n};
 const mm2=(p,x,y,z)=>{const dx=x-p[0],dy=y-p[1],dz=z-p[2];return (matrix[0]*dx+matrix[1]*dy+matrix[2]*dz)**2+(matrix[3]*dx+matrix[4]*dy+matrix[5]*dz)**2+(matrix[6]*dx+matrix[7]*dy+matrix[8]*dz)**2;};
 const coreRadius=Math.min(2,Math.max(.8,radiusMm*.28)),coreReach=spacing.map(s=>Math.ceil(coreRadius*s));
 const collect=p=>{const samples=[];for(let z=Math.max(0,p[2]-coreReach[2]);z<=Math.min(dims[2]-1,p[2]+coreReach[2]);z++)for(let y=Math.max(0,p[1]-coreReach[1]);y<=Math.min(dims[1]-1,p[1]+coreReach[1]);y++)for(let x=Math.max(0,p[0]-coreReach[0]);x<=Math.min(dims[0]-1,p[0]+coreReach[0]);x++)if(mm2(p,x,y,z)<=coreRadius**2){const i=flat(dims,x,y,z),value=data[i];if(Number.isFinite(value))samples.push({i,value});}return samples;};
 const positiveSamples=[],cores=[];
 for(const p of positives){const points=collect(p),values=points.map(s=>s.value).sort((a,b)=>a-b);if(values.length<3)return blocked('Too few finite pixels near a positive point');const low=quantile(values,.2),high=quantile(values,.8),clean=points.filter(s=>s.value>=low&&s.value<=high);positiveSamples.push(...clean.map(s=>s.value));cores.push(clean);}
 positiveSamples.sort((a,b)=>a-b);const mid=quantile(positiveSamples,.5),mad=median(positiveSamples.map(v=>Math.abs(v-mid))),spread=Math.max((quantile(positiveSamples,.9)-quantile(positiveSamples,.1))/2,1.4826*mad,Math.abs(mid)*.02,.01),tolerance=(1.5+2*sensitivity/100)*spread;
 let minIntensity=mid-tolerance,maxIntensity=mid+tolerance;
 const negativeValues=negatives.flatMap(p=>{const v=collect(p).map(s=>s.value).sort((a,b)=>a-b);return v.length?v.slice(Math.floor(v.length*.2),Math.max(Math.floor(v.length*.2)+1,Math.ceil(v.length*.8))):[];}).sort((a,b)=>a-b);
 const negativeMedian=negativeValues.length?quantile(negativeValues,.5):null;
 let warning='';
 if(negativeMedian!==null){if(Math.abs(negativeMedian-mid)<spread*1.5)warning='Background and target intensities overlap; negative points only block their local neighborhood.';
 else if(negativeMedian<mid)minIntensity=Math.max(minIntensity,(negativeMedian+mid)/2);
 else maxIntensity=Math.min(maxIntensity,(negativeMedian+mid)/2);}
 const forbidden=(x,y,z)=>negatives.some(p=>mm2(p,x,y,z)<=Math.min(3,radiusMm/2)**2);
 const accepted=i=>{const x=i%dims[0],y=Math.floor(i/dims[0])%dims[1],z=Math.floor(i/(dims[0]*dims[1]));return x>=lo[0]&&x<=hi[0]&&y>=lo[1]&&y<=hi[1]&&z>=lo[2]&&z<=hi[2]&&!forbidden(x,y,z)&&(mask[i]===0||mask[i]===1)&&Number.isFinite(data[i])&&data[i]>=minIntensity&&data[i]<=maxIntensity;};
 const seen=new Uint8Array(n),queue=new Int32Array(n),indices=[];let read=0,write=0,touchesBoundary=false,potentialVoxels=0,potentialMl=0;
 const determinant=Math.abs(matrix[0]*(matrix[4]*matrix[8]-matrix[5]*matrix[7])-matrix[1]*(matrix[3]*matrix[8]-matrix[5]*matrix[6])+matrix[2]*(matrix[3]*matrix[7]-matrix[4]*matrix[6]));
 const factor=volume.reductionFactor||1,source=volume.sourceDims||dims;
 const local=i=>{const x=i%dims[0],y=Math.floor(i/dims[0])%dims[1],z=Math.floor(i/(dims[0]*dims[1]));return flat(size,x-lo[0],y-lo[1],z-lo[2]);};
 for(const core of cores){const best=core.filter(s=>accepted(s.i)).sort((a,b)=>Math.abs(a.value-mid)-Math.abs(b.value-mid))[0];if(!best)return blocked('A positive point has no representative target pixels nearby');const k=local(best.i);if(!seen[k]){seen[k]=1;queue[write++]=best.i;}}
 while(read<write){const i=queue[read++],x=i%dims[0],y=Math.floor(i/dims[0])%dims[1],z=Math.floor(i/(dims[0]*dims[1]));if(mask[i]===0){potentialVoxels++;potentialMl+=determinant/1000*Math.min(factor,source[0]-x*factor)*Math.min(factor,source[1]-y*factor)/(factor*factor);if(potentialVoxels<=maxProposal)indices.push(i);}
  if(x===lo[0]||x===hi[0]||y===lo[1]||y===hi[1]||z===lo[2]||z===hi[2])touchesBoundary=true;
  for(const [a,b,c] of [[x-1,y,z],[x+1,y,z],[x,y-1,z],[x,y+1,z],[x,y,z-1],[x,y,z+1]]){
   if(a<lo[0]||a>hi[0]||b<lo[1]||b>hi[1]||c<lo[2]||c>hi[2])continue;
   const k=flat(size,a-lo[0],b-lo[1],c-lo[2]);if(seen[k])continue;seen[k]=1;
   const j=flat(dims,a,b,c);if(accepted(j))queue[write++]=j;
  }
 }
 if(potentialVoxels>maxProposal)return {status:'oversized',reason:'Potential growth exceeds the proposal cap; this is NOT empty anatomy. Add background points and recalculate. No preview can be accepted.',indices:[],potentialVoxels,potentialMl,touchesBoundary,roiVoxels:n,warning};
 if(touchesBoundary)warning=(warning?warning+' ':'')+'Proposal touches the spatial search boundary; inspect for truncation.';
 return {status:indices.length?'ok':'blocked',reason:indices.length?'':'No new connected pixels match the learned intensity range',indices,minIntensity,maxIntensity,median:mid,negativeMedian,warning};
}
