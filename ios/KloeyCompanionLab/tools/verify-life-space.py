"""Check the actual exported world beneath the companion's authored corridor."""
from pathlib import Path
import json, struct
root=Path(__file__).resolve().parents[1]
data=(root/'app/assets/environments/quaternius/clearing.glb').read_bytes()
n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);binary=28+n

def read(index):
 a=g['accessors'][index];view=g['bufferViews'][a['bufferView']]
 fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
 comps={'SCALAR':1,'VEC3':3}[a['type']];size=struct.calcsize(fmt)*comps
 start=binary+view.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*comps,data,start+i*view.get('byteStride',size)) for i in range(a['count'])]

# Full capsule swept area, including stopping clearance, not just destination points.
x0,x1,z0,z1=-.42,.42,-1.64,1.44
triangles=0;ground=0;intrusions=[]
for mesh in g['meshes']:
 for p in mesh['primitives']:
  name=g['materials'][p['material']]['name'];verts=read(p['attributes']['POSITION'])
  indices=[i[0] for i in read(p['indices'])]
  for i in range(0,len(indices),3):
   vs=[verts[k] for k in indices[i:i+3]]
   if max(v[0] for v in vs)<x0 or min(v[0] for v in vs)>x1 or max(v[2] for v in vs)<z0 or min(v[2] for v in vs)>z1:continue
   if name=='ClearingMoss':
    assert all(abs(v[1]+.025)<1e-5 for v in vs),'Walking surface is no longer flat at the collider height'
    ground+=1
   elif max(v[1] for v in vs)>.015 and min(v[1] for v in vs)<1.85:
    intrusions.append(name)
   triangles+=1
assert ground>0,'Missing terrain beneath walkway'
assert not intrusions,f'Props intrude into the swept walking corridor: {set(intrusions)}'
print(f'Life space passed: {ground} flat ground triangles, no prop triangles inside the swept corridor.')
