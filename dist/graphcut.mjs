// Experimental browser-only 3D s/t min-cut. Search box is computational, never anatomy.
const index=(d,x,y,z)=>(z*d[1]+y)*d[0]+x;
const median=a=>{a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)/2)];};
export function graphCutFill(volume,positives,negatives,mask,radiusMm=8,sensitivity=50,{maxNodes=150000}={}){
 const fail=(status,reason,extra={})=>({status,reason,indices:[],...extra});
 const {dims:d,data,matrix:m}=volume||{};
 if(!d||d.length!==3||!d.every(x=>Number.isInteger(x)&&x>0)||!data||data.length!==d[0]*d[1]*d[2]||!m||m.length!==9||mask?.length!==data.length||m.some(x=>!Number.isFinite(x)))return fail('blocked','Invalid image or mask');
 const valid=p=>Array.isArray(p)&&p.length===3&&p.every((v,a)=>Number.isInteger(v)&&v>=0&&v<d[a]);
 if(!Array.isArray(positives)||!positives.length||positives.length>64||positives.some(p=>!valid(p)))return fail('blocked','Place up to 64 target points');
 if(!Array.isArray(negatives)||!negatives.length||negatives.length>64||negatives.some(p=>!valid(p)))return fail('blocked','Place at least one explicit background point');
 const targetIds=new Set(positives.map(p=>index(d,...p)));
 if(negatives.some(p=>targetIds.has(index(d,...p))))return fail('blocked','Target and background points overlap; move contradictory points');
 if(!Number.isFinite(radiusMm)||radiusMm<=0||radiusMm>24||!Number.isFinite(sensitivity)||sensitivity<0||sensitivity>100)return fail('blocked','Invalid settings');
 const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);
 if(!Number.isFinite(det)||Math.abs(det)<1e-8)return fail('blocked','Invalid physical geometry');
 const inverse=[(m[4]*m[8]-m[5]*m[7])/det,(m[2]*m[7]-m[1]*m[8])/det,(m[1]*m[5]-m[2]*m[4])/det,(m[5]*m[6]-m[3]*m[8])/det,(m[0]*m[8]-m[2]*m[6])/det,(m[2]*m[3]-m[0]*m[5])/det,(m[3]*m[7]-m[4]*m[6])/det,(m[1]*m[6]-m[0]*m[7])/det,(m[0]*m[4]-m[1]*m[3])/det];
 const reach=[0,1,2].map(a=>Math.ceil(radiusMm*Math.hypot(...inverse.slice(a*3,a*3+3))));
 const marks=[...positives,...negatives],lo=reach.map((r,a)=>Math.max(0,Math.min(...marks.map(p=>p[a]))-r)),hi=reach.map((r,a)=>Math.min(d[a]-1,Math.max(...marks.map(p=>p[a]))+r));
 const s=lo.map((v,a)=>hi[a]-v+1),n=s[0]*s[1]*s[2];
 if(!Number.isSafeInteger(n)||n>maxNodes||n<1)return fail('refused','Computational resource refusal: explicit-point search ROI exceeds node budget; no partial preview.',{roiVoxels:n,maxNodes});
 const coords=k=>[lo[0]+k%s[0],lo[1]+Math.floor(k/s[0])%s[1],lo[2]+Math.floor(k/(s[0]*s[1]))];
 const local=p=>index(s,p[0]-lo[0],p[1]-lo[1],p[2]-lo[2]);
 const core=p=>{const a=[];for(let z=Math.max(0,p[2]-2);z<=Math.min(d[2]-1,p[2]+2);z++)for(let y=Math.max(0,p[1]-2);y<=Math.min(d[1]-1,p[1]+2);y++)for(let x=Math.max(0,p[0]-2);x<=Math.min(d[0]-1,p[0]+2);x++){
  const q=[x-p[0],y-p[1],z-p[2]],mm=Math.hypot(m[0]*q[0]+m[1]*q[1]+m[2]*q[2],m[3]*q[0]+m[4]*q[1]+m[5]*q[2],m[6]*q[0]+m[7]*q[1]+m[8]*q[2]);
  if(mm<=2&&Number.isFinite(data[index(d,x,y,z)]))a.push(data[index(d,x,y,z)]);
 }return a;};
 const positive=positives.flatMap(core),negative=negatives.flatMap(core);
 if(positive.length<3||negative.length<3)return fail('blocked','Too few finite target/background samples');
 const target=median(positive),background=median(negative),contrast=Math.abs(target-background);
 if(contrast<1e-5)return fail('blocked','Target and background have indistinguishable sampled intensities; no reliable proposal');
 const values=new Float32Array(n),global=new Int32Array(n);
 for(let k=0;k<n;k++){const p=coords(k),i=index(d,...p);global[k]=i;values[k]=data[i];}
 // Typed-array residual graph, at most 16 arcs/node; no per-voxel JS objects.
 const maxArcs=16*n+4,head=new Int32Array(n+2).fill(-1),to=new Int32Array(maxArcs),next=new Int32Array(maxArcs),cap=new Float64Array(maxArcs);let arcs=0;
 const edge=(a,b,c)=>{to[arcs]=b;cap[arcs]=c;next[arcs]=head[a];head[a]=arcs++;to[arcs]=a;cap[arcs]=0;next[arcs]=head[b];head[b]=arcs++;};
 const source=n,sink=n+1,hard=1e8;
 const positiveSet=new Set(positives.map(local)),negativeSet=new Set(negatives.map(local));
 const scale=contrast*.4,smooth=1.2+(sensitivity/100)*1.2;
 for(let k=0;k<n;k++){
  const v=values[k],finite=Number.isFinite(v),dt=finite?Math.abs(v-target)/scale:100,db=finite?Math.abs(v-background)/scale:0;
  // source→voxel is cost of background; voxel→sink is cost of foreground.
  edge(source,k,positiveSet.has(k)?hard:Math.min(12,db)+.02);
  edge(k,sink,negativeSet.has(k)||!finite?hard:Math.min(12,dt)+.02);
  const [x,y,z]=coords(k);
  for(const [a,b,step] of [[0,1,1],[1,s[0],1],[2,s[0]*s[1],1]]){
   if((a===0&&x===hi[0])||(a===1&&y===hi[1])||(a===2&&z===hi[2]))continue;
   const j=k+b,delta=Math.abs(v-values[j]),length=Math.hypot(m[a],m[3+a],m[6+a]);
   const weight=finite&&Number.isFinite(values[j])?smooth*Math.exp(-delta*delta/(2*scale*scale))/Math.max(length,.1):.001;
   edge(k,j,weight);edge(j,k,weight);
  }
 }
 const level=new Int32Array(n+2),queue=new Int32Array(n+2),cursor=new Int32Array(n+2);
 const bfs=()=>{level.fill(-1);let r=0,w=0;queue[w++]=source;level[source]=0;while(r<w){const u=queue[r++];for(let e=head[u];e!==-1;e=next[e])if(cap[e]>1e-9&&level[to[e]]===-1){level[to[e]]=level[u]+1;queue[w++]=to[e];}}return level[sink]!==-1;};
 const dfs=(u,flow)=>{if(u===sink)return flow;for(let e=cursor[u];e!==-1;e=cursor[u]=next[e]){const v=to[e];if(cap[e]>1e-9&&level[v]===level[u]+1){const pushed=dfs(v,Math.min(flow,cap[e]));if(pushed>1e-9){cap[e]-=pushed;cap[e^1]+=pushed;return pushed;}}}return 0;};
 while(bfs()){cursor.set(head);while(dfs(source,Infinity)>1e-9){}}
 // Reachable source side is the exact complete min-cut, never a truncated proposal.
 const seen=new Uint8Array(n+2);let r=0,w=0;queue[w++]=source;seen[source]=1;
 while(r<w){const u=queue[r++];for(let e=head[u];e!==-1;e=next[e])if(cap[e]>1e-9&&!seen[to[e]]){seen[to[e]]=1;queue[w++]=to[e];}}
 const indices=[];let touchesBoundary=false;
 for(let k=0;k<n;k++)if(seen[k]){const [x,y,z]=coords(k);if(x===lo[0]||x===hi[0]||y===lo[1]||y===hi[1]||z===lo[2]||z===hi[2])touchesBoundary=true;if(!mask[global[k]])indices.push(global[k]);}
 return indices.length?{status:'ok',indices,roiVoxels:n,touchesBoundary,warning:touchesBoundary?'Proposal touches the computational search boundary; it may be truncated. Review all planes.':'Review all planes; intensity similarity is not an anatomical boundary.',minIntensity:Math.min(target,background),maxIntensity:Math.max(target,background)}:fail('blocked','No new voxels in complete cut');
}
