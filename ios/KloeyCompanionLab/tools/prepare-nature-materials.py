"""Author complete Kaigen materials in glTF extras; never patch generated .hzt files."""
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parents[1]


def wind_pass(shader, phase):
    return {
        'source': f'/shaders/renderer/{shader}.glsl', 'phase': f'RENDERER_PHASE_{phase}',
        'order': 0, 'state_mask': 7, 'cull_mode': 'GPU_CULL_NONE',
        'depth_compare': 'GPU_COMPARE_GREATER_EQUAL', 'depth_write': True,
        'depth_bias': 0, 'slope_scaled_depth_bias': 0, 'keywords': [],
    }


def prepare():
    folder = ROOT / 'app/assets/environments/quaternius'
    path = folder / 'clearing.glb'
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + size])
    for material in gltf['materials']:
        if not any(w in material['name'].lower() for w in ('leav', 'grass', 'flower')):
            continue
        extras = material.setdefault('extras', {})
        cutout = material.get('alphaMode') == 'MASK'
        pbr = material.get('pbrMetallicRoughness', {})
        keywords = ['SHADOWS', 'LIGHTING_CLUSTERS', 'IBL', 'GTAO', 'FOG']
        if cutout:
            keywords.append('ALPHA_CUTOUT')
        properties = [
            {'name': 'color', 'type': 'MAT_PROP_COLOR4', 'c4': dict(zip('rgba', pbr.get('baseColorFactor', [1, 1, 1, 1])))},
            {'name': 'metallic', 'type': 'MAT_PROP_FLOAT', 'f': pbr.get('metallicFactor', 0)},
            {'name': 'smoothness', 'type': 'MAT_PROP_FLOAT', 'f': 1 - pbr.get('roughnessFactor', 1)},
            {'name': 'emission_color', 'type': 'MAT_PROP_COLOR4', 'c4': dict(zip('rgba', [0, 0, 0, 1]))},
            {'name': 'emission_intensity', 'type': 'MAT_PROP_FLOAT', 'f': 0},
            {'name': 'albedo', 'type': 'MAT_PROP_TEXTURE', 'texture_index': pbr['baseColorTexture']['index']},
        ]
        normal = material.get('normalTexture')
        if normal:
            properties.append({'name': 'normal_map', 'type': 'MAT_PROP_TEXTURE', 'texture_index': normal['index']})
        extras['hz_material'] = {
            'material_shader': '/shaders/renderer/nature_wind.glsl',
            'depth_test': True, 'depth_write': True, 'depth_compare': 'GPU_COMPARE_GREATER_EQUAL',
            'cull_mode': 'GPU_CULL_NONE', 'is_transparent': False, 'alpha_cutoff': cutout,
            'properties': properties, 'keywords': [{'name': 'HZ_RENDERER_' + k, 'value': ''} for k in keywords],
            'passes': [wind_pass('nature_shadow', 'SHADOW')] + ([] if cutout else [wind_pass('nature_depth', 'DEPTH_PREPASS')]),
        }
    payload = json.dumps(gltf, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    tail = data[20 + size:]
    rebuilt = struct.pack('<III', 0x46546C67, 2, 20 + len(payload) + len(tail))
    rebuilt += struct.pack('<II', len(payload), 0x4E4F534A) + payload + tail
    if rebuilt != data:
        path.write_bytes(rebuilt)
    sidecar = folder / 'clearing.import.hzt'
    text = 'type ModelImportSettings\nversion 23\n---\nrig_mode "none"\nimport_scale 1\nshader_override 0\npass_override 0\n'
    if sidecar.read_text() != text:
        sidecar.write_text(text)


if __name__ == '__main__':
    prepare()
