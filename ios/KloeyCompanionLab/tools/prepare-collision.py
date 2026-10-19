"""Bake collision inputs from the exported clearing, excluding deforming foliage."""
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / 'app/assets/environments/quaternius'
data = (folder / 'clearing.glb').read_bytes()
size = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + size])
binary = 28 + size
for node in gltf['nodes']:
    assert not any(k in node for k in ('matrix', 'translation', 'rotation', 'scale')), 'Bake node transforms before collision export'


def read(index):
    accessor = gltf['accessors'][index]
    view = gltf['bufferViews'][accessor['bufferView']]
    fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[accessor['componentType']]
    count = {'SCALAR': 1, 'VEC3': 3}[accessor['type']]
    stride = view.get('byteStride', struct.calcsize(fmt) * count)
    offset = binary + view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from('<' + fmt * count, data, offset + i * stride) for i in range(accessor['count'])]


groups = {'ground': ([], []), 'solid': ([], [])}
for mesh in gltf['meshes']:
    for primitive in mesh['primitives']:
        material = gltf['materials'][primitive['material']]['name']
        if material == 'ClearingMoss':
            group = 'ground'
        elif any(word in material.lower() for word in ('bark', 'rock', 'mushroom')):
            group = 'solid'
        else:
            continue
        source = read(primitive['attributes']['POSITION'])
        indices = [v[0] for v in read(primitive['indices'])]
        vertices, output_indices = groups[group]
        remap = {}
        for i in range(0, len(indices), 3):
            triangle = indices[i:i + 3]
            points = [source[v] for v in triangle]
            if any(max(v[axis] for v in points) < -10 or min(v[axis] for v in points) > 10 for axis in [0, 2]):
                continue
            for old in triangle:
                if old not in remap:
                    remap[old] = len(vertices)
                    vertices.append(source[old])
                output_indices.append(remap[old])
for name, (vertices, indices) in groups.items():
    text = 'type CalmCollisionMeshBlobAsset\nversion 23\n---\n'
    text += f'vertices {len(vertices)}\n'
    text += ''.join(f'  x {x:.9g}\n  y {y:.9g}\n  z {z:.9g}\n' for x, y, z in vertices)
    text += f'triangles {len(indices) // 3}\n'
    text += ''.join(f'  a {indices[i]}\n  b {indices[i + 1]}\n  c {indices[i + 2]}\n' for i in range(0, len(indices), 3))
    path = folder / f'collision_{name}.hzt'
    if not path.is_file() or path.read_text() != text:
        path.write_text(text)
text = 'type CalmWorldBlobAsset\nversion 23\n---\n'
text += 'ground "environments/quaternius/collision_ground.hzt" CalmCollisionMeshBlobAsset\n'
text += 'solid "environments/quaternius/collision_solid.hzt" CalmCollisionMeshBlobAsset\n'
path = folder / 'collision.hzt'
if not path.is_file() or path.read_text() != text:
    path.write_text(text)
print('Authored collision triangles:', {name: len(indices) // 3 for name, (_, indices) in groups.items()})
