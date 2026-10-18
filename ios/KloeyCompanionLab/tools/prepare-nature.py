"""Build the companion clearing using Blender; sources and SDK stay unchanged."""
from pathlib import Path
import bpy, math, random, json, colorsys
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
out=root/'app/assets/environments/quaternius'
art=root/'art/nature'
rng=random.Random(42)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
prototypes={}
for path in sorted((art/'source').glob('*.gltf')):
 before=set(bpy.context.scene.objects)
 bpy.ops.import_scene.gltf(filepath=str(path))
 objs=sorted([o for o in set(bpy.context.scene.objects)-before if o.type=='MESH'],key=lambda o:o.name)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs: o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
 o=bpy.context.object
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.name=path.stem; prototypes[path.stem]=o
# Share original material/texture data across all repeated props.
for image in bpy.data.images:
 if image.size[0]>512 or image.size[1]>512:
  ratio=min(512/image.size[0],512/image.size[1]);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio))
 image.pack()
# Imported glTF materials multiply textures by the old active vertex-color layer.
# Remove that legacy link so the export can explicitly select our metadata layer.
def upstream_image(socket):
 for link in socket.links:
  if link.from_node.type=='TEX_IMAGE':return link.from_node
  for input_socket in link.from_node.inputs:
   image=upstream_image(input_socket)
   if image:return image
 return None
for mat in bpy.data.materials:
 if not mat.use_nodes:continue
 nodes=mat.node_tree.nodes
 bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs or not any(n.type=='VERTEX_COLOR' for n in nodes):continue
 image=upstream_image(bs.inputs['Base Color'])
 if image:
  mat.node_tree.links.new(image.outputs['Color'],bs.inputs['Base Color'])
 for node in list(nodes):
  if node.type=='VERTEX_COLOR':
   for output in node.outputs:
    for link in list(output.links):
     link.to_socket.default_value=1.0 if link.to_socket.type=='VALUE' else (1,1,1,1)
   nodes.remove(node)
placed=[]
def height(x,z):
 r=math.hypot(x,z)
 return max(0,r-3.4)*0.10 + 0.6*math.sin(x*.45)*math.sin(z*.38)*min(1,max(0,r-3)/5)
def plant(name,x,z,scale=1,angle=None,autumn=False):
 proto=prototypes[name];o=proto.copy();o.data=proto.data.copy();bpy.context.collection.objects.link(o)
 o.location=(x,-z,height(x,z));o.scale=(scale,)*3;o.rotation_euler[2]=angle if angle is not None else rng.random()*math.tau
 # COLOR_0 is explicit: moving materials read RGB as bend/phase/tip data.
 for attr in list(o.data.color_attributes):
  o.data.color_attributes.remove(attr)
 color=o.data.color_attributes.new(name='NatureData',type='FLOAT_COLOR',domain='CORNER')
 minh=min(v.co.z for v in o.data.vertices)
 maxh=max(v.co.z for v in o.data.vertices)
 tree=name.startswith(('CommonTree','TwistedTree','Pine'))
 amplitude=.075 if tree else min(.035,(maxh-minh)*scale*.10)
 phase=(x*.137+z*.193+scale*.417)%1
 for poly in o.data.polygons:
  mat=o.data.materials[poly.material_index]
  moving=any(word in mat.name.lower() for word in ('leav','grass','flower'))
  for li in poly.loop_indices:
   co=o.data.vertices[o.data.loops[li].vertex_index].co
   t=max(0,min(1,(co.z-minh)/max(maxh-minh,.01)))
   weight=t*t*(3-2*t)*amplitude/.08
   color.data[li].color=(weight,phase,t,1) if moving else (1,1,1,1)
 if autumn:
  for slot in o.material_slots:
   if 'leav' in slot.material.name.lower():
    m=slot.material.copy();m.name='AutumnLeaves';slot.material=m
    node=m.node_tree.nodes.get('Principled BSDF')
    for tex in m.node_tree.nodes:
     if tex.type=='TEX_IMAGE' and tex.image and 'leav' in tex.image.name.lower():
      key='Autumn_'+tex.image.name
      im=bpy.data.images.get(key)
      if im is None:
       original=tex.image;im=original.copy();im.name=key
       px=list(original.pixels[:])
       for k in range(0,len(px),4):
        v=max(px[k:k+3]);rgb=colorsys.hsv_to_rgb(.075,.86,min(1,v*1.45+.12));px[k:k+3]=rgb
       im.pixels[:]=px;im.pack()
      tex.image=im
 placed.append(o)
 return o
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.95
 return m
moss=material('ClearingMoss',(1,1,1))
# Broad low rolling ground and a winding path, with a flat center for the avatar.
verts=[];faces=[];N=96;size=21
for j in range(N+1):
 z=-size+2*size*j/N
 for i in range(N+1):
  x=-size+2*size*i/N;verts.append((x,-z,height(x,z)-.025))
for j in range(N):
 for i in range(N):
  a=j*(N+1)+i;faces.append((a+N+1,a+N+2,a+1,a))
mesh=bpy.data.meshes.new('ClearingGround');mesh.from_pydata(verts,[],faces);mesh.materials.append(moss)
o=bpy.data.objects.new('ClearingGround',mesh);bpy.context.collection.objects.link(o);placed.append(o)
# Tree ring leaves the viewing space and the companion unobstructed.
for i in range(22):
 a=math.tau*i/22;r=rng.uniform(7.5,15)
 x,z=math.cos(a)*r,math.sin(a)*r
 plant(['CommonTree_1','CommonTree_3','Pine_1'][i%3],x,z,rng.uniform(.52,.85),autumn=i%4==0)
plant('TwistedTree_1',-8,-12,.45)
for x,z in [(-3.5,-4.5),(3.8,-5.5),(-1.8,-8),(1,-10),(-5,-8),(5,-10)]:
 plant('CommonTree_3',x,z,rng.uniform(.36,.58),autumn=x>2)
for i in range(110):
 z=rng.uniform(-7,4);c=math.sin(z*.25)*.75;x=c+rng.choice([-1,1])*rng.uniform(1.1,4.5)
 plant('Grass_Common_Tall',x,z,rng.uniform(.12,.23))
for i in range(30):
 x,z=rng.uniform(-13,13),rng.uniform(-14,12)
 if abs(x)<1.5: continue
 plant('Rock_Medium_1' if i%2 else 'Rock_Medium_2',x,z,rng.uniform(.18,.5))
for i in range(42):
 x,z=rng.uniform(-11,11),rng.uniform(-12,10)
 if abs(x)<1.8 or math.hypot(x,z)<2.4:continue
 plant('Bush_Common_Flowers' if i%4==0 else 'Bush_Common',x,z,rng.uniform(.35,.72))
for i in range(320):
 x,z=rng.uniform(-13,13),rng.uniform(-14,12)
 c=math.sin(z*.25)*.75
 if abs(x-c)<1.20 or math.hypot(x,z)<1.5:continue
 plant('Grass_Wispy_Short' if i%3==0 else 'Grass_Common_Tall',x,z,rng.uniform(.14,.36))
for i in range(50):
 side=1 if i%2 else -1;z=rng.uniform(-8,7);x=math.sin(z*.25)*.75+side*rng.uniform(1.45,3.6)
 plant('Flower_4_Group' if i%3 else 'Flower_3_Group',x,z,rng.uniform(.16,.30))
for x,z in [(-1.6,1.6),(2.1,.6),(-2.5,-2),(3,-3),(-4,3.5)]:plant('Fern_1',x,z,.15)
for i in range(14):plant('Mushroom_Common',rng.choice([-1,1])*rng.uniform(1.5,4),rng.uniform(-7,5),rng.uniform(.15,.24))
# Portrait foreground planting and background landmarks.
for i in range(75):
 z=rng.uniform(-2,2.3);x=math.sin(z*.25)*.75+rng.choice([-1,1])*rng.uniform(.76,1.35)
 plant('Grass_Wispy_Short' if i%2 else 'Grass_Common_Tall',x,z,rng.uniform(.09,.18))
for i in range(16):
 z=rng.uniform(-1.5,1.7);x=rng.choice([-1,1])*rng.uniform(.78,1.45)
 plant('Flower_3_Group' if i%2 else 'Flower_4_Group',x,z,rng.uniform(.10,.19))
plant('Fern_1',-1.25,.9,.09)
plant('Fern_1',1.3,.4,.10)
plant('Rock_Medium_1',-2.5,-4,.65)
plant('Rock_Medium_2',3.1,-4.5,.65)
plant('Rock_Medium_1',-4.5,-10,1.7)
plant('CommonTree_1',2.8,-4.5,.6,autumn=True)
plant('CommonTree_3',-2.8,-6,.7)
plant('CommonTree_3',.2,-9,.6)
for proto in prototypes.values():bpy.data.objects.remove(proto,do_unlink=True)
# Merge by material for a small draw count; wind weights remain per vertex.
bpy.ops.object.select_all(action='DESELECT')
for o in placed:o.select_set(True)
bpy.context.view_layer.objects.active=placed[0];bpy.ops.object.join();o=bpy.context.object;o.name='SunlitClearing'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Paint the path on the same ground surface, avoiding intersecting overlay geometry.
attr=o.data.color_attributes.get('NatureData')
for poly in o.data.polygons:
 if o.data.materials[poly.material_index].name.startswith('ClearingMoss'):
  poly.use_smooth=True
  for li in poly.loop_indices:
   co=o.data.vertices[o.data.loops[li].vertex_index].co
   x,z=co.x,-co.y
   half=.58+abs(z)*.025
   edge=abs(x-math.sin(z*.25)*.75)
   t=max(0,min(1,(half+.18-edge)/.36));t=t*t*(3-2*t)
   noise=.98+.025*math.sin(x*4.1+z*3.2)
   rgb=tuple(((1-t)*g+t*p)*noise for g,p in zip((.38,.53,.14),(.64,.48,.25)))
   attr.data[li].color=(*rgb,1)
# Collapse duplicate autumn copies back onto a single reusable material.
canonical={}
for i,m in enumerate(o.data.materials):
 key=m.name.split('.')[0]
 if key in canonical:
  for p in o.data.polygons:
   if p.material_index==i:p.material_index=canonical[key]
 else:canonical[key]=i
# Blender's preview also shows the terrain paint; foliage keeps its texture colors.
node=moss.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='NatureData'
moss.node_tree.links.new(node.outputs['Color'],moss.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# One material per exported mesh avoids Blender's multi-material COLOR_0 substitution.
# The renderer already draws one section per material, so draw count stays the same.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
for surface in bpy.context.selected_objects:
 if surface.type=='MESH' and surface.data.polygons:
  surface.name=surface.data.materials[surface.data.polygons[0].material_index].name+'_surface'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(art/'clearing.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'clearing.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_vertex_color='NAME',export_vertex_color_name='NatureData',export_all_vertex_colors=False,export_cameras=False,export_lights=False)
(art/'preparation.json').write_text(json.dumps({'seed':42,'placed_objects':len(placed),'source':'Quaternius Standard CC0','texture_max':512,'wind':'Explicit COLOR_0 RGB: amplitude, per-plant phase, tip height; fixed surfaces use standard shader'},indent=2))

import struct
b=(out/'clearing.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n])
names=[m['name'] for m in d['materials'] if any(word in m['name'].lower() for word in ('leav','grass','flower'))]
(out/'clearing.import.hzt').write_text('type ModelImportSettings\nversion 23\n---\nrig_mode "none"\nimport_scale 1\nshader_override '+str(len(names))+'\n'+''.join('  material "'+name+'"\n  shader "/shaders/renderer/nature_wind.glsl"\n\n' for name in names)+'pass_override 0\n')

import runpy
validation=runpy.run_path(str(root/'tools/verify-nature.py'))['verify'](root)
print(json.dumps(validation,indent=2))
