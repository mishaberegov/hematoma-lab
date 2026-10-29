import {decodeFrame} from './dicom.mjs';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export function measurementGeometry(g){
 if(g.modality!=='CT')throw Error('Only CT with calibrated HU supports measurement.');
 if(g.frames.length<2)throw Error('At least two slices required for measured volume.');
 if(['1.2.840.10008.1.2.4.50','1.2.840.10008.1.2.4.81','1.2.840.10008.1.2.4.91'].includes(g.ts))throw Error('Lossy compressed CT is not accepted for measurement.');
 const f=g.frames[0],u=f.iop.slice(0,3),v=f.iop.slice(3),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const frames=[...g.frames].sort((a,b)=>dot(a.ipp,normal)-dot(b.ipp,normal));const first=frames[0];
 if(Math.abs(dot(u,u)-1)>.005||Math.abs(dot(v,v)-1)>.005||Math.abs(dot(u,v))>.005)throw Error('Invalid orientation.');
 for(const q of frames){if(q.rows!==first.rows||q.cols!==first.cols||q.spacing.some((x,i)=>!Number.isFinite(x)||x<=0||Math.abs(x-first.spacing[i])>.001)||q.iop.some((x,i)=>Math.abs(x-first.iop[i])>.001))throw Error('Mixed orientation or spacing.');if(!q.huCalibrated||!Number.isFinite(q.slope)||!Number.isFinite(q.intercept)||q.slope===0)throw Error('Missing valid HU calibration (Rescale Slope/Intercept).');}
 const positions=frames.map(q=>dot(q.ipp.map((x,i)=>x-first.ipp[i]),normal));const gaps=positions.slice(1).map((p,i)=>p-positions[i]);
 if(gaps.some(x=>x<.01))throw Error('Duplicate slice positions.');
 const step=gaps.reduce((a,b)=>a+b,0)/gaps.length;
 if(gaps.some(x=>Math.abs(x-step)>Math.max(.05,step*.02)))throw Error('Irregular slice gap: measurement blocked.');
 const dz=frames.at(-1).ipp.map((x,i)=>(x-first.ipp[i])/(frames.length-1));
 for(let z=0;z<frames.length;z++){const offset=frames[z].ipp.map((x,i)=>x-first.ipp[i]-dz[i]*z);if(Math.hypot(...offset)>.05)throw Error('In-plane slice offset/drift: measurement blocked.');}
 if(Math.abs(dot(dz,normal)-step)>.05)throw Error('Invalid slice axis.');
 return {frames,dims:[first.cols,first.rows,frames.length],origin:first.ipp.slice(),matrix:[u[0]*first.spacing[1],v[0]*first.spacing[0],dz[0],u[1]*first.spacing[1],v[1]*first.spacing[0],dz[1],u[2]*first.spacing[1],v[2]*first.spacing[0],dz[2]]};
}
export async function buildMeasuredVolume(g,{decode=decodeFrame,onProgress=()=>{},codec}={}){
 const geo=measurementGeometry(g),[w,h,d]=geo.dims,n=w*h*d;
 if(n>60000000)throw Error('Source grid exceeds 60 million voxels; no downsampling for measurement.');
 const data=new Float32Array(n);
 for(let z=0;z<d;z++){const pixels=await decode(geo.frames[z],{codec});if(pixels.length!==w*h)throw Error('Decoded slice size mismatch.');data.set(pixels,z*w*h);onProgress((z+1)/d);}
 return {dims:geo.dims,matrix:geo.matrix,origin:geo.origin,data,name:g.name,modality:g.modality,synthetic:false};
}
