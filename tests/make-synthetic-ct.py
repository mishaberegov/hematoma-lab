"""Create synthetic (never patient) explicit-VR CT ZIP for browser QA."""
import struct, zipfile, math, sys
out=sys.argv[1]
def tag(group,element,vr,value):
    if vr in ('US','SS'): raw=struct.pack('<'+('H' if vr=='US' else 'h'),value)
    else: raw=value if isinstance(value,bytes) else str(value).encode('ascii')
    if vr not in ('OB','OW') and len(raw)%2:raw+=b'\0' if vr=='UI' else b' '
    if vr in ('OB','OW'):return struct.pack('<HH2sHI',group,element,vr.encode(),0,len(raw))+raw
    return struct.pack('<HH2sH',group,element,vr.encode(),len(raw))+raw
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for z in range(25):
        fields=[tag(2,0x0010,'UI','1.2.840.10008.1.2.1'),tag(8,0x0060,'CS','CT'),tag(0x20,0x000d,'UI','1.2.826.0.1.3680043.10.999.1'),tag(0x20,0x000e,'UI','1.2.826.0.1.3680043.10.999.2'),tag(0x20,0x0052,'UI','1.2.826.0.1.3680043.10.999.3'),tag(0x20,0x0032,'DS',f'0\\0\\{z}'),tag(0x20,0x0037,'DS','1\\0\\0\\0\\1\\0'),tag(0x28,0x0030,'DS','1\\1'),tag(0x28,0x0010,'US',80),tag(0x28,0x0011,'US',80),tag(0x28,0x0002,'US',1),tag(0x28,0x0004,'CS','MONOCHROME2'),tag(0x28,0x0100,'US',16),tag(0x28,0x0101,'US',16),tag(0x28,0x0102,'US',15),tag(0x28,0x0103,'US',1),tag(0x28,0x1053,'DS','1'),tag(0x28,0x1052,'DS','0')]
        pixels=[70 if math.hypot(x-35,y-40,z-12)<=23 else 30 for y in range(80) for x in range(80)]
        fields.append(tag(0x7fe0,0x0010,'OW',struct.pack('<6400h',*pixels)))
        archive.writestr(f'synthetic-{z:03}.dcm',b'\0'*128+b'DICM'+b''.join(fields))
print(out)
