"""Read the pinned SDK's generated reflection to follow cooked BlobAssetRefs."""
from pathlib import Path, PurePosixPath
from functools import lru_cache
import re
import struct


def fnv32(text):
    value = 2166136261
    for byte in text.encode():
        value = ((value ^ byte) * 16777619) & 0xffffffff
    return value


class CookedAssets:
    def __init__(self, app):
        self.root = app / 'cooked'
        self.fields, self.unions, self.sizes = {}, {}, {}
        for folder in [app / 'hz/src/generated', app / 'src/generated']:
            for header in folder.rglob('*.gen.h'):
                text = re.sub(r'HZ_LAYOUT\((\d+),\s*\d+\)', r'\1', header.read_text())
                for name, body in re.findall(r'static const FieldInfo (\w+)_fields\[\] = \{(.*?)\n\};', text, re.S):
                    self.fields[name] = [[v.strip() for v in row.split(',')] for row in re.findall(r'\{(.*?)\}', body)]
                for name, body in re.findall(r'static const UnionMember (\w+)_members\[\] = \{(.*?)\n\};', text, re.S):
                    self.unions[name] = [[v.strip() for v in row.split(',')] for row in re.findall(r'\{(.*?)\}', body)]
                for name, size in re.findall(r'static const TypeInfo (\w+)_typeinfo = \{\s*\.name = "[^"]+",\s*\.size = (\d+)', text):
                    self.sizes[name] = int(size)
        self.types = {fnv32(name): name for name in self.fields}

    def safe_name(self, name):
        path = PurePosixPath(name)
        if not name or path.is_absolute() or '..' in path.parts:
            raise ValueError(f'Unsafe cooked path {name}')
        source = self.root / path
        if self.root.resolve() not in source.resolve().parents or not source.is_file():
            raise ValueError(f'Missing or external cooked file {name}')
        return path.as_posix()

    @staticmethod
    def type_name(value):
        return value.removeprefix('&').removesuffix('_typeinfo')

    @lru_cache(None)
    def has_refs(self, name):
        for field in self.fields.get(name, []):
            kind = field[1]
            if kind == 'FIELD_TYPE_ASSET_REF' or field[8] == 'FIELD_TYPE_ASSET_REF':
                return True
            if kind == 'FIELD_TYPE_UNION':
                for member in self.unions[field[7][1:]]:
                    if member[1] == 'FIELD_TYPE_ASSET_REF' or self.has_refs(self.type_name(member[3])):
                        return True
            elif field[4] != 'NULL' and kind not in ('FIELD_TYPE_HANDLE', 'FIELD_TYPE_STRING'):
                if self.has_refs(self.type_name(field[4])):
                    return True
        return False

    def string(self, data, at):
        offset, length = struct.unpack_from('<iI', data, at)
        if not length:
            return ''
        start = at + offset
        if start < 0 or start + length >= len(data) or data[start + length] != 0:
            raise ValueError('Invalid cooked StringBlob')
        return data[start:start + length].decode()

    def walk(self, data, name, base=0, depth=0):
        if depth > 32:
            raise ValueError('Recursive asset metadata')
        fields = self.fields[name]
        for field in fields:
            kind, at = field[1], base + int(field[2])
            if field[15] == 'true' or kind in ('FIELD_TYPE_HANDLE', 'FIELD_TYPE_STRING'):
                continue
            if kind == 'FIELD_TYPE_ASSET_REF':
                yield self.string(data, at)
            elif kind == 'FIELD_TYPE_UNION':
                discriminator = int(field[11])
                members = self.unions[field[7][1:]]
                if discriminator < 0:
                    if any(m[1] == 'FIELD_TYPE_ASSET_REF' for m in members):
                        raise ValueError(f'Untagged asset union in {name}')
                    continue
                tag = struct.unpack_from('<i', data, base + int(fields[discriminator][2]))[0]
                for member in members:
                    if int(member[4]) == tag:
                        if member[1] == 'FIELD_TYPE_ASSET_REF':
                            yield self.string(data, at)
                        elif self.has_refs(self.type_name(member[3])):
                            yield from self.walk(data, self.type_name(member[3]), at, depth + 1)
            elif kind in ('FIELD_TYPE_STRUCT', 'FIELD_TYPE_BLOB_HEADER'):
                element = self.type_name(field[4])
                if self.has_refs(element):
                    yield from self.walk(data, element, at, depth + 1)
            elif kind in ('FIELD_TYPE_ARRAY', 'FIELD_TYPE_FIXED_ARRAY'):
                element = self.type_name(field[4])
                if field[8] != 'FIELD_TYPE_ASSET_REF' and not self.has_refs(element):
                    continue
                if kind == 'FIELD_TYPE_ARRAY':
                    if field[13] != 'true':
                        raise ValueError(f'Non-blob array in {name}')
                    offset, size, stride, _ = struct.unpack_from('<iIII', data, at)
                    if not size:
                        continue
                    start, end = at + offset, at + offset + size
                    if not stride or start < 0 or end > len(data) or size % stride:
                        raise ValueError(f'Invalid array in {name}')
                else:
                    count, items = int(field[6]), int(field[9])
                    if items:
                        count = min(count, struct.unpack_from('<I', data, at)[0])
                    stride = 24 if field[8] == 'FIELD_TYPE_ASSET_REF' else self.sizes[element]
                    start, end = at + items, at + items + count * stride
                for item in range(start, end, stride):
                    if field[8] == 'FIELD_TYPE_ASSET_REF':
                        yield self.string(data, item)
                    else:
                        yield from self.walk(data, element, item, depth + 1)

    def resolve(self, reference):
        name = reference.removeprefix('/').removeprefix('assets/').removeprefix('cooked/')
        if not name:
            return []
        path = PurePosixPath(name)
        if '..' in path.parts or path.is_absolute():
            raise ValueError(f'Unsafe asset reference {reference}')
        if path.suffix == '.glsl':
            stem = path.stem
            shaders = list((self.root / 'shaders').glob(f'{stem}*_metal_ios.hza'))
            template = self.root / 'shaders' / (stem + '_material.hza')
            if template.is_file():
                shaders.append(template)
            if not shaders:
                raise ValueError(f'Missing iOS shader {reference}')
            return [p.relative_to(self.root).as_posix() for p in shaders]
        if path.suffix in ('.hzt', '.vrma'):
            path = path.with_suffix('.hza')
        elif path.suffix in ('.glb', '.vrm'):
            path = path.with_suffix('') / (path.stem + '.hza')
        if not (self.root / path).is_file():
            raise ValueError(f'Missing cooked dependency {reference} -> {path}')
        return [str(path)]

    def dependencies(self, name):
        data = (self.root / name).read_bytes()
        magic, size, type_id, version = struct.unpack_from('<QQQI', data)
        if magic != 0x54455353414800 or size != len(data) or version != 23:
            raise ValueError(f'Unsupported or corrupt cooked asset: {name}')
        asset_type = self.types.get(type_id)
        if asset_type is None:
            raise ValueError(f'Unknown cooked type {type_id}: {name}')
        if asset_type == 'TextureBlobAsset':
            image = self.string(data, 56).lstrip('/')
            candidates = [image + '_astc.ktx', image + '.ktx', image]
            for candidate in candidates:
                if (self.root / candidate).is_file():
                    return [self.safe_name(candidate)]
            raise ValueError(f'Missing iOS image for {name}: {image}')
        dependencies = []
        for reference in self.walk(data, asset_type):
            dependencies.extend(self.resolve(reference))
        # Chunk component rows use dependency indices rather than live BlobAssetRefs.
        offset, size, stride, _ = struct.unpack_from('<iIII', data, 40)
        for at in range(40 + offset, 40 + offset + size, stride or 8):
            dependencies.extend(self.resolve(self.string(data, at)))
        return dependencies

    def closure(self, seeds):
        selected, pending = set(), list(seeds)
        while pending:
            name = self.safe_name(pending.pop())
            if name in selected:
                continue
            selected.add(name)
            if name.endswith('.hza'):
                pending.extend(self.dependencies(name))
        return selected
