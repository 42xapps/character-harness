"""Validate the exported asset contract, not just the Blender source attributes."""
from pathlib import Path
import json
import re
import struct
import sys


def verify(root, check_materials=False):
    folder = root / 'app/assets/environments/quaternius'
    data = (folder / 'clearing.glb').read_bytes()
    json_size = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_size])
    binary = 28 + json_size
    settings = (folder / 'clearing.import.hzt').read_text()

    def accessor(index):
        a = gltf['accessors'][index]
        view = gltf['bufferViews'][a['bufferView']]
        fmt = {5121: 'B', 5123: 'H', 5126: 'f'}[a['componentType']]
        count = {'VEC3': 3, 'VEC4': 4}[a['type']]
        size = struct.calcsize(fmt) * count
        stride = view.get('byteStride', size)
        start = binary + view.get('byteOffset', 0) + a.get('byteOffset', 0)
        scale = 255 if a['componentType'] == 5121 else 65535 if a['componentType'] == 5123 else 1
        return [tuple(v / scale for v in struct.unpack_from('<' + fmt * count, data, start + i * stride)) for i in range(a['count'])]

    assert all(m.get('alphaMode', 'OPAQUE') in ('OPAQUE', 'MASK') for m in gltf['materials']), 'Foliage changed to blended transparency'
    report = []
    terrain_count = 0
    for mesh in gltf['meshes']:
        for primitive in mesh['primitives']:
            name = gltf['materials'][primitive['material']]['name']
            moving = any(word in name.lower() for word in ('leav', 'grass', 'flower'))
            colors = accessor(primitive['attributes']['COLOR_0'])
            assert all(abs(c[3] - 1) < .001 for c in colors), f'{name}: unexpected surface alpha'
            entry = f'  material "{name}"'
            assert ('hz_material' in gltf['materials'][primitive['material']].get('extras', {})) == moving, f'{name}: incorrect wind shader routing'
            if moving:
                weights = [c[0] for c in colors]
                assert max(weights) - min(weights) > .03, f'{name}: constant/missing bend data'
                assert 0 <= min(weights) < max(weights) < 1, f'{name}: unbounded bend weight'
                assert len({round(c[1] * 255) for c in colors}) > 1, f'{name}: missing per-plant phases'
                # Smoothstep pins the bottom of each plant (including grass stems).
                roots = [c for c in colors if c[2] < 1 / 255]
                assert all(c[0] <= 1 / 255 for c in roots), f'{name}: unpinned roots'
                report.append({'material': name, 'max_amplitude_m': round(max(weights) * .08, 4), 'root_vertices': len(roots)})
            elif name == 'ClearingMoss':
                terrain_count += 1
                assert max(c[0] for c in colors) - min(c[0] for c in colors) > .1, 'Missing painted path'
            elif name != 'ClearingMoss':
                assert all(all(abs(channel - 1) < .001 for channel in c[:3]) for c in colors), f'{name}: fixed surface contains wind metadata'
            if check_materials:
                text = (folder / 'materials' / (name + '_mat.hzt')).read_text()
                shader = '/shaders/renderer/nature_wind.glsl' if moving else '/shaders/renderer/standard.glsl'
                assert f'shader_source "{shader}"' in text, f'{name}: stale generated shader binding'
                if moving:
                    assert 'source "/shaders/renderer/nature_shadow.glsl"' in text, f'{name}: static wind shadow'
                    assert 'phase RENDERER_PHASE_SHADOW' in text, f'{name}: missing shadow phase'
                    if gltf['materials'][primitive['material']].get('alphaMode') != 'MASK':
                        assert 'source "/shaders/renderer/nature_depth.glsl"' in text, f'{name}: static depth pass'
                for texture in re.findall(r'texture "([^"]+)" TextureBlobAsset', text):
                    cooked = root / 'app/cooked' / Path(texture.lstrip('/')).with_suffix('.hza')
                    assert cooked.is_file(), f'{name}: missing cooked texture {cooked.name}'
    assert terrain_count == 1, 'Expected one continuous terrain surface'
    assert not any(m.get('name') == 'GoldenPath' for m in gltf['materials']), 'Intersecting path mesh remains'
    return {'status': 'passed', 'fixed_terrain_surfaces': terrain_count, 'vegetation': report}


if __name__ == '__main__':
    print(json.dumps(verify(Path(__file__).resolve().parents[1], '--materials' in sys.argv), indent=2))
