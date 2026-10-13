// Reading and writing binary glTF (.glb, .vrm, .vrma): the JSON chunk as an
// object, the BIN chunk as bytes, float accessors as arrays, and appending
// new float data as accessors.

import { readFileSync, statSync } from "node:fs";

// The parts of glTF this code touches; everything else is carried through.
export interface GltfNode {
	name?: string;
	children?: number[];
	mesh?: number;
	translation?: number[];
	rotation?: number[];
	scale?: number[];
	matrix?: number[];
}
export interface GltfAccessor {
	bufferView?: number;
	byteOffset?: number;
	componentType: number;
	normalized?: boolean;
	count: number;
	type: string;
	min?: number[];
	max?: number[];
	sparse?: unknown;
}
export interface GltfChannel {
	sampler: number;
	target: { node?: number; path: string };
}
export interface GltfSampler {
	input: number;
	output: number;
	interpolation?: string;
}
export interface GltfAnimation {
	name?: string;
	channels: GltfChannel[];
	samplers: GltfSampler[];
}
export interface Gltf {
	nodes?: GltfNode[];
	accessors?: GltfAccessor[];
	bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
	buffers?: { byteLength: number; uri?: string }[];
	animations?: GltfAnimation[];
	extensions?: Record<string, unknown>;
	extensionsUsed?: string[];
	extras?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface Glb {
	json: Gltf;
	bin: Buffer;
}

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
// larger than any avatar or clip; a bigger file is refused before it is read
const MAX_FILE_BYTES = 512 * 1024 * 1024;
// an accessor with no data is all zeros; this many is more than any clip needs
const MAX_ZERO_VALUES = 1 << 24;

export function readGlb(path: string): Glb {
	if (statSync(path).size > MAX_FILE_BYTES) throw new Error(`${path} is larger than ${MAX_FILE_BYTES >> 20} MB`);
	const b = readFileSync(path);
	if (b.length < 20 || b.readUInt32LE(0) !== MAGIC) throw new Error(`${path} is not a binary glTF file`);
	let json: Gltf | null = null;
	let bin = Buffer.alloc(0);
	for (let at = 12; at + 8 <= b.length; ) {
		const len = b.readUInt32LE(at);
		const type = b.readUInt32LE(at + 4);
		if (at + 8 + len > b.length) throw new Error(`${path} is cut short`);
		const data = b.subarray(at + 8, at + 8 + len);
		if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8"));
		else if (type === CHUNK_BIN) bin = Buffer.from(data);
		at += 8 + len;
	}
	if (!json) throw new Error(`${path} has no glTF JSON`);
	return { json, bin };
}

export function writeGlb(glb: Glb): Buffer {
	const pad = (b: Buffer, fill: number) => {
		const extra = (4 - (b.length % 4)) % 4;
		return extra ? Buffer.concat([b, Buffer.alloc(extra, fill)]) : b;
	};
	const json = pad(Buffer.from(JSON.stringify(glb.json), "utf8"), 0x20);
	const bin = pad(glb.bin, 0);
	const head = Buffer.alloc(12);
	head.writeUInt32LE(MAGIC, 0);
	head.writeUInt32LE(2, 4);
	head.writeUInt32LE(12 + 8 + json.length + (bin.length ? 8 + bin.length : 0), 8);
	const chunk = (type: number, data: Buffer) => {
		const h = Buffer.alloc(8);
		h.writeUInt32LE(data.length, 0);
		h.writeUInt32LE(type, 4);
		return [h, data];
	};
	return Buffer.concat([head, ...chunk(CHUNK_JSON, json), ...(bin.length ? chunk(CHUNK_BIN, bin) : [])]);
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const SIZES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

// An accessor's values as floats, flattened. Normalized integer data (allowed
// for rotations) is scaled to [-1, 1] or [0, 1].
export function readAccessor(glb: Glb, index: number): Float32Array {
	const a = glb.json.accessors?.[index];
	if (!a) throw new Error(`accessor ${index} does not exist`);
	const comps = COMPONENTS[a.type];
	const size = SIZES[a.componentType];
	if (!comps || !size) throw new Error(`accessor ${index} has an unsupported type`);
	if (a.sparse) throw new Error(`accessor ${index} is sparse, which isn't supported`);
	if (!Number.isSafeInteger(a.count) || a.count < 0) throw new Error(`accessor ${index} has a bad count`);
	if (a.bufferView === undefined) {
		// all zeros, per the spec
		if (a.count * comps > MAX_ZERO_VALUES) throw new Error(`accessor ${index} is too large`);
		return new Float32Array(a.count * comps);
	}
	const view = glb.json.bufferViews?.[a.bufferView];
	if (!view || view.buffer !== 0) throw new Error(`accessor ${index} is not in the GLB's own buffer`);
	const stride = view.byteStride ?? comps * size;
	const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
	const whole = (x: unknown) => Number.isSafeInteger(x) && (x as number) >= 0;
	if (!whole(stride) || stride < comps * size || !whole(base) || !whole(view.byteLength))
		throw new Error(`accessor ${index} has a bad offset or stride`);
	// checked before anything is allocated, so a lying count can't exhaust memory
	const end = a.count === 0 ? base : base + (a.count - 1) * stride + comps * size;
	if (end > (view.byteOffset ?? 0) + view.byteLength || end > glb.bin.length)
		throw new Error(`accessor ${index} runs past its buffer`);
	const out = new Float32Array(a.count * comps);
	for (let i = 0; i < a.count; i++) {
		for (let c = 0; c < comps; c++) {
			const at = base + i * stride + c * size;
			let v: number;
			switch (a.componentType) {
				case FLOAT: v = glb.bin.readFloatLE(at); break;
				case 5120: v = glb.bin.readInt8(at); if (a.normalized) v = Math.max(v / 127, -1); break;
				case 5121: v = glb.bin.readUInt8(at); if (a.normalized) v /= 255; break;
				case 5122: v = glb.bin.readInt16LE(at); if (a.normalized) v = Math.max(v / 32767, -1); break;
				case 5123: v = glb.bin.readUInt16LE(at); if (a.normalized) v /= 65535; break;
				default: v = glb.bin.readUInt32LE(at);
			}
			out[i * comps + c] = v;
		}
	}
	return out;
}

// Appends float data as a new accessor in the GLB's own buffer; returns its index.
export function addAccessor(glb: Glb, data: Float32Array, type: "SCALAR" | "VEC3" | "VEC4", withBounds = false): number {
	const comps = COMPONENTS[type];
	const start = Math.ceil(glb.bin.length / 4) * 4;
	const bytes = Buffer.alloc(start - glb.bin.length + data.length * 4);
	for (let i = 0; i < data.length; i++) bytes.writeFloatLE(data[i], start - glb.bin.length + i * 4);
	glb.bin = Buffer.concat([glb.bin, bytes]);
	const json = glb.json;
	json.buffers ??= [];
	if (!json.buffers.length) json.buffers.push({ byteLength: 0 });
	json.buffers[0].byteLength = glb.bin.length;
	json.bufferViews ??= [];
	json.bufferViews.push({ buffer: 0, byteOffset: start, byteLength: data.length * 4 });
	const accessor: GltfAccessor = {
		bufferView: json.bufferViews.length - 1,
		componentType: FLOAT,
		count: data.length / comps,
		type,
	};
	if (withBounds) {
		const min = Array(comps).fill(Infinity);
		const max = Array(comps).fill(-Infinity);
		for (let i = 0; i < data.length; i++) {
			min[i % comps] = Math.min(min[i % comps], data[i]);
			max[i % comps] = Math.max(max[i % comps], data[i]);
		}
		accessor.min = min;
		accessor.max = max;
	}
	json.accessors ??= [];
	json.accessors.push(accessor);
	return json.accessors.length - 1;
}
