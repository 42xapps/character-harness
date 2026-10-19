"""Check that the cook retained all authored geometry, including trailing arrays."""
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1] / 'app'
for name in ['ground', 'solid']:
    stem = f'environments/quaternius/collision_{name}'
    source = (ROOT / 'assets' / (stem + '.hzt')).read_text()
    data = (ROOT / 'cooked' / (stem + '.hza')).read_bytes()
    vertex_offset, vertex_size, stride, _ = struct.unpack_from('<iIII', data, 56)
    index_offset, index_size, index_stride, _ = struct.unpack_from('<iIII', data, 72)
    vertices = int(re.search(r'^vertices (\d+)', source, re.M)[1])
    indices = int(re.search(r'^triangles (\d+)', source, re.M)[1]) * 3
    assert stride == 12 and vertex_size == vertices * 12 and vertices > 0
    assert index_stride == 12 and index_size == indices * 4 and indices > 0 and indices % 3 == 0
    values = struct.unpack_from('<' + str(indices) + 'i', data, 72 + index_offset)
    assert 0 <= min(values) < max(values) < vertices
    authored_indices = tuple(int(value) for value in re.findall(r'^  [abc] (-?\d+)$', source, re.M))
    assert values == authored_indices, f'{name}: cooked triangle indices differ from their source'
    authored_vertices = [float(value) for value in re.findall(r'^  [xyz] (\S+)$', source, re.M)]
    assert len(authored_vertices) == vertices * 3
    layout = '<' + str(vertices * 3) + 'f'
    expected = struct.unpack(layout, struct.pack(layout, *authored_vertices))
    actual = struct.unpack_from(layout, data, 56 + vertex_offset)
    assert actual == expected, f'{name}: cooked vertex positions differ from their source'
    print(f'{name}: {vertices} vertices, {indices // 3} triangles retained by the cook')
