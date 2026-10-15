// Rewrites the parts of a VRM the player can't load as they are, before the
// animations are baked on:
//
// - several skins (common in VRMs exported from Unity): the player binds a
//   model to one skeleton, so the skins are merged into one and each mesh's
//   joint indices are renumbered into it.
// - a skin's `skeleton` node: optional in glTF, and a model whose skeleton
//   names its hips floats above the ground while it is animated, so it is
//   dropped.
// - VRM 0.x models face -Z where VRM 1.0 faces +Z: the whole model is turned
//   180 degrees about Y, so it faces the camera like any other.
// - VRM 0.x MToon materials, kept in the VRM extension's materialProperties:
//   the player reads MToon from VRM 1.0's VRMC_materials_mtoon, so each one is
//   converted to that, with the shading, outline and rim values worked out
//   as @pixiv/three-vrm does for VRM 0.x.

import { addAccessor as append, readAccessor, type Glb } from "./glb.ts";

// What normalizing may add to a model's binary data: the rewrites copy data,
// and a small file can describe a lot of it (accessors with no data read as
// zeros), so the growth is capped.
const MIN_GROWTH = 64 * 1024 * 1024; // or twice the model's own binary data, if more
// A mesh drawn by several skins is copied: this many, this large as JSON, at most.
const MAX_MESH_COPIES = 4096;
const MAX_COPIED = 8 * 1024 * 1024;
const grown = new WeakMap<Glb, { added: number; limit: number }>();
function addAccessor(glb: Glb, data: Float32Array | Uint16Array, type: "SCALAR" | "VEC3" | "VEC4" | "MAT4", withBounds = false): number {
	let g = grown.get(glb);
	if (!g) grown.set(glb, (g = { added: 0, limit: Math.max(MIN_GROWTH, 2 * glb.bin.length) }));
	g.added += data.byteLength;
	if (g.added > g.limit) throw new Error("the model would grow too large while it is prepared; is it valid?");
	return append(glb, data, type, withBounds);
}
export const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isIndex = (x: unknown, length: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < length;

interface Primitive {
	attributes: Record<string, number>;
	[key: string]: unknown;
}
interface Mesh {
	primitives: Primitive[];
	[key: string]: unknown;
}
interface Skin {
	joints: number[];
	inverseBindMatrices?: number;
	skeleton?: number;
	[key: string]: unknown;
}

// Merges every skin into one: the union of their joints, parents first, each
// with the inverse bind matrix its first skin gives it, and no `skeleton`.
// Returns how many skins there were.
export function mergeSkins(glb: Glb): number {
	const json = glb.json;
	const skins = (json.skins ?? []) as Skin[];
	if (skins.length < 2) {
		for (const skin of skins) delete skin.skeleton;
		return skins.length;
	}
	const meshes = (json.meshes ?? []) as Mesh[];
	const nodes = (json.nodes ?? []) as Record<string, unknown>[];

	// every joint's inverse bind matrix, from the first skin that has it
	const bind = new Map<number, number[]>();
	let differ = 0;
	const read = new Map<number, Float32Array>(); // bind matrices several skins share are read once
	for (const skin of skins) {
		if (!Array.isArray(skin.joints) || !skin.joints.every((j) => isIndex(j, nodes.length)))
			throw new Error("a skin names a joint that isn't a node");
		const i = skin.inverseBindMatrices;
		const m = i === undefined ? null : (read.get(i) ?? read.set(i, readAccessor(glb, i)).get(i)!);
		if (m && m.length < skin.joints.length * 16) throw new Error("a skin has fewer bind matrices than joints");
		skin.joints.forEach((j, k) => {
			const mine = m ? Array.from(m.subarray(k * 16, k * 16 + 16)) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
			const had = bind.get(j);
			if (!had) bind.set(j, mine);
			else if (had.some((x, i) => Math.abs(x - mine[i]) > 1e-4)) differ++;
		});
	}
	if (differ)
		console.warn(`${differ} joints are bound differently by different skins; the meshes on the later skins may deform`);
	// in the order of the node tree, parents first, so the skeleton's root is
	// joint 0; a node with two parents or a loop makes the file invalid
	const joints: number[] = [];
	const seen = new Set<number>();
	const order: number[] = [];
	const parented = new Set<number>();
	for (const n of nodes)
		for (const c of (Array.isArray(n.children) ? n.children : []) as number[]) {
			if (!isIndex(c, nodes.length)) throw new Error(`a node names child ${c}, which doesn't exist`);
			if (parented.has(c)) throw new Error(`node ${c} has two parents`);
			parented.add(c);
		}
	nodes.forEach((_, i) => {
		if (parented.has(i)) return;
		const stack = [i];
		while (stack.length) {
			const n = stack.pop()!;
			if (seen.has(n)) throw new Error(`the node tree loops at node ${n}`);
			seen.add(n);
			order.push(n);
			const kids = (Array.isArray(nodes[n]?.children) ? nodes[n].children : []) as number[];
			for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
		}
	});
	for (const n of order) if (bind.has(n)) joints.push(n);
	if (joints.length !== bind.size) throw new Error("a skin names a joint that isn't in the node tree");
	if (joints.length > 65535) throw new Error(`the merged skin would have ${joints.length} joints; the most is 65535`);
	const at = new Map(joints.map((j, k) => [j, k]));
	const ibm = joints.flatMap((j) => bind.get(j)!);

	// each mesh is renumbered for the skin it's drawn with, from its joints as
	// they were; a mesh drawn with two different skins gets a copy for the second
	const original = meshes.map((m) => structuredClone(m));
	let copies = 0;
	let copied = 0; // the copies' size, as JSON
	const sizes = new Map<number, number>();
	const done = new Map<string, number>();
	const meshesDone = new Set<number>();
	// a JOINTS accessor several primitives share is renumbered once per skin
	const renumbered = new Map<string, number>();
	nodes.forEach((node) => {
		if (typeof node.skin !== "number") return;
		if (!skins[node.skin]) throw new Error(`a node names skin ${node.skin}, which doesn't exist`);
		if (typeof node.mesh === "number") {
			if (!meshes[node.mesh]) throw new Error(`a node names mesh ${node.mesh}, which doesn't exist`);
			const skin = skins[node.skin];
			const key = `${node.mesh}:${node.skin}`;
			if (!done.has(key)) {
				const first = !meshesDone.has(node.mesh);
				meshesDone.add(node.mesh);
				if (!first) {
					if (!sizes.has(node.mesh)) sizes.set(node.mesh, JSON.stringify(original[node.mesh]).length);
					copied += sizes.get(node.mesh)!;
					if (++copies > MAX_MESH_COPIES || copied > MAX_COPIED) throw new Error("too many meshes are drawn by several skins");
				}
				const mesh: Mesh = first ? meshes[node.mesh] : structuredClone(original[node.mesh]);
				mesh.primitives.forEach((p, pi) => {
					for (const name of Object.keys(p.attributes).filter((a) => a.startsWith("JOINTS_"))) {
						const source = original[node.mesh as number].primitives[pi].attributes[name];
						const id = `${source}:${node.skin}`;
						if (!renumbered.has(id)) {
							const local = readAccessor(glb, source);
							// some exporters pad unused slots with any index; with no weight it doesn't matter
							const w = original[node.mesh as number].primitives[pi].attributes[name.replace("JOINTS_", "WEIGHTS_")];
							const weights = w === undefined ? null : readAccessor(glb, w);
							const merged = new Uint16Array(local.length);
							for (let i = 0; i < local.length; i++) {
								const j = skin.joints[local[i]];
								if (j === undefined && weights && weights[i] === 0) continue;
								if (j === undefined) throw new Error(`a mesh names joint ${local[i]}, which its skin doesn't have`);
								merged[i] = at.get(j)!;
							}
							renumbered.set(id, addAccessor(glb, merged, "VEC4"));
						}
						p.attributes[name] = renumbered.get(id)!;
					}
				});
				if (!first) meshes.push(mesh);
				done.set(key, first ? (node.mesh as number) : meshes.length - 1);
			}
			node.mesh = done.get(key);
		}
		node.skin = 0;
	});
	// a copy keeps its mesh's morph target names; expressions find morphs by
	// name, so they still bind to the mesh they named

	const merged: Skin = { joints, inverseBindMatrices: addAccessor(glb, new Float32Array(ibm), "MAT4") };
	json.skins = [merged];
	return skins.length;
}

interface V0Material {
	name?: string;
	shader?: string;
	floatProperties?: Record<string, number>;
	vectorProperties?: Record<string, number[]>;
	textureProperties?: Record<string, number>;
	keywordMap?: Record<string, boolean>;
	renderQueue?: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// VRM 0.x orders transparent materials by renderQueue; VRM 1.0 by an offset
// (-9..0, or 0..9 with z-write). As three-vrm does, the distinct queues of each
// kind are ranked and the ranks become the offsets: counting down to 0 for
// plain transparency, up from 0 with z-write.
function renderQueueOffsets(v0: V0Material[]): Map<V0Material, number> {
	const out = new Map<V0Material, number>();
	for (const zwrite of [false, true]) {
		const mats = v0.filter((m) => m?.shader === "VRM/MToon" && (m.floatProperties?._BlendMode ?? 0) === (zwrite ? 3 : 2));
		const queue = (m: V0Material) => (Number.isFinite(m.renderQueue) ? (m.renderQueue as number) : 3000);
		const queues = [...new Set(mats.map(queue))].sort((a, b) => a - b);
		const rankOf = new Map(queues.map((q, i) => [q, i]));
		for (const m of mats) {
			const rank = rankOf.get(queue(m))!;
			out.set(m, zwrite ? Math.min(rank, 9) : Math.max(-9, Math.min(0, rank - queues.length + 1)));
		}
	}
	return out;
}

// The VRMC_materials_mtoon of one VRM 0.x MToon material.
function mtoonFromV0(m: V0Material, queueOffset: number, textureCount: number): Record<string, unknown> {
	// only finite numbers and textures that exist are taken; anything else falls back
	const f = new Proxy(m.floatProperties ?? {}, { get: (o, k) => (Number.isFinite((o as Record<string | symbol, unknown>)[k]) ? (o as Record<string | symbol, number>)[k] : undefined) });
	const v = m.vectorProperties ?? {};
	const t = m.textureProperties ?? {};
	// VRM 0.x stores these colours in gamma space, VRM 1.0 in linear
	const rgb = (key: string, fallback: number[]) => {
		const c = Array.isArray(v[key]) && v[key].slice(0, 3).every(Number.isFinite) && v[key].length >= 3 ? v[key] : fallback;
		return c.slice(0, 3).map((x) => Math.pow(Math.max(0, x), 2.2));
	};
	const tex = (key: string) => (isIndex(t[key], textureCount) ? { index: t[key] } : undefined);
	const shadeShift = f._ShadeShift ?? 0;
	const shadeToony = f._ShadeToony ?? 0.9;
	const shadingToonyFactor = lerp(shadeToony, 1, 0.5 + 0.5 * shadeShift);
	const outlineMode = f._OutlineWidthMode ?? 0;
	const out: Record<string, unknown> = {
		specVersion: "1.0",
		transparentWithZWrite: (f._BlendMode ?? 0) === 3,
		renderQueueOffsetNumber: queueOffset,
		shadeColorFactor: rgb("_ShadeColor", [0.97, 0.81, 0.86]),
		shadingShiftFactor: -shadeShift - (1 - shadingToonyFactor),
		shadingToonyFactor,
		giEqualizationFactor: 1 - (f._IndirectLightIntensity ?? 0.1),
		matcapFactor: tex("_SphereAdd") ? [1, 1, 1] : [0, 0, 0],
		parametricRimColorFactor: rgb("_RimColor", [0, 0, 0]),
		rimLightingMixFactor: f._RimLightingMix ?? 0,
		parametricRimFresnelPowerFactor: f._RimFresnelPower ?? 1,
		parametricRimLiftFactor: f._RimLift ?? 0,
		outlineWidthMode: outlineMode === 1 ? "worldCoordinates" : outlineMode === 2 ? "screenCoordinates" : "none",
		outlineWidthFactor: (f._OutlineWidth ?? 0) * 0.01,
		outlineColorFactor: rgb("_OutlineColor", [0, 0, 0]),
		outlineLightingMixFactor: (f._OutlineColorMode ?? 0) === 1 ? (f._OutlineLightingMix ?? 1) : 0,
	};
	const textures: Record<string, unknown> = {
		shadeMultiplyTexture: tex("_ShadeTexture"),
		matcapTexture: tex("_SphereAdd"),
		rimMultiplyTexture: tex("_RimTexture"),
		outlineWidthMultiplyTexture: tex("_OutlineWidthTexture"),
	};
	for (const [k, x] of Object.entries(textures)) if (x) out[k] = x;
	return out;
}

// Gives every VRM 0.x MToon material its VRM 1.0 MToon extension. Returns how
// many were converted.
export function convertV0Materials(glb: Glb): number {
	const json = glb.json;
	const v0 = (json.extensions?.VRM as { materialProperties?: V0Material[] } | undefined)?.materialProperties;
	const materials = (json.materials ?? []) as { name?: string; extensions?: Record<string, unknown> }[];
	if (!Array.isArray(v0) || !v0.length || !Array.isArray(materials) || !materials.length) return 0;
	let n = 0;
	const offsets = renderQueueOffsets(v0);
	const byName = new Map<string, V0Material>();
	for (const p of v0) if (typeof p?.name === "string" && !byName.has(p.name)) byName.set(p.name, p);
	const sameOrder = v0.length === materials.length;
	const textures = Array.isArray(json.textures) ? json.textures.length : 0;
	materials.forEach((mat, i) => {
		if (mat.extensions?.VRMC_materials_mtoon) return;
		// matched by position, as three-vrm does, or by name if the lists differ
		const props = sameOrder ? v0[i] : ((typeof mat.name === "string" ? byName.get(mat.name) : undefined) ?? v0[i]);
		if (props?.shader !== "VRM/MToon") return;
		mat.extensions = { ...(isObject(mat.extensions) ? mat.extensions : {}), VRMC_materials_mtoon: mtoonFromV0(props, offsets.get(props) ?? 0, textures) };
		n++;
	});
	if (n) json.extensionsUsed = [...new Set([...(Array.isArray(json.extensionsUsed) ? json.extensionsUsed : []), "VRMC_materials_mtoon"])];
	return n;
}

// Turns a VRM 0.x model to face +Z, as VRM 1.0 does: everything is turned 180
// degrees about Y (x and z change sign) in place, the nodes, the bind matrices,
// the vertices and morph targets, and the model's own animations, so the
// skeleton the player builds from the bind pose turns too. Returns whether it
// was turned.
// Positions inside the VRM extension itself (first-person offset, spring bone
// colliders) are not turned: the player reads only its humanoid and
// expressions. A model with sparse accessors is left as it is, facing -Z, and
// its motion is flipped instead.
export function turnV0(glb: Glb): boolean {
	const json = glb.json;
	if (!json.extensions?.VRM || json.extensions.VRMC_vrm) return false;
	if ((json.accessors ?? []).some((a) => a.sparse)) return false;
	// a rotation conjugated by the turn, and a 4x4 matrix (column-major)
	const q = (r: number[]) => [-r[0], r[1], -r[2], r[3]];
	const sign = [-1, 1, -1, 1];
	const m = (x: ArrayLike<number>) => Array.from({ length: 16 }, (_, k) => x[k] * sign[k % 4] * sign[Math.floor(k / 4)]);
	for (const n of json.nodes ?? []) {
		if (Array.isArray(n.matrix)) n.matrix = m(n.matrix);
		if (Array.isArray(n.translation)) n.translation = [-n.translation[0], n.translation[1], -n.translation[2]];
		if (Array.isArray(n.rotation)) n.rotation = q(n.rotation);
	}
	// every accessor is rewritten once, however many places use it, and one
	// already rewritten (a sampler two channels share) is left alone
	const done = new Map<number, number>();
	const made = new Set<number>();
	const rewrite = (i: number, f: (v: Float32Array, comps: number) => void, bounds = false): number => {
		if (done.has(i)) return done.get(i)!;
		if (made.has(i)) return i;
		const a = json.accessors![i];
		const comps = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type as "VEC3"] ?? 0;
		if (comps < 3) throw new Error(`accessor ${i} is ${a.type}, where a vector or matrix was expected`);
		const v = readAccessor(glb, i);
		f(v, comps);
		const out = addAccessor(glb, v, a.type as "VEC3", bounds);
		done.set(i, out);
		made.add(out);
		return out;
	};
	const xz = (v: Float32Array, comps: number) => {
		for (let k = 0; k < v.length; k += comps) {
			v[k] = -v[k];
			v[k + 2] = -v[k + 2];
		}
	};
	for (const mesh of (json.meshes ?? []) as Mesh[])
		for (const p of mesh.primitives) {
			for (const name of ["POSITION", "NORMAL", "TANGENT"])
				if (p.attributes[name] !== undefined) p.attributes[name] = rewrite(p.attributes[name], xz, name === "POSITION");
			for (const t of (p.targets ?? []) as Record<string, number>[])
				for (const name of ["POSITION", "NORMAL", "TANGENT"]) if (t[name] !== undefined) t[name] = rewrite(t[name], xz, name === "POSITION");
		}
	for (const skin of (json.skins ?? []) as Skin[])
		if (skin.inverseBindMatrices !== undefined)
			skin.inverseBindMatrices = rewrite(skin.inverseBindMatrices, (v) => {
				for (let k = 0; k < v.length; k += 16) v.set(m(v.subarray(k, k + 16)), k);
			});
	for (const anim of json.animations ?? [])
		for (const ch of anim.channels) {
			if (ch.target.path !== "translation" && ch.target.path !== "rotation") continue;
			// a sampler that also drives another kind of channel (a scale, say)
			// keeps its values for that one; this channel gets its own sampler
			if (anim.channels.some((c) => c.sampler === ch.sampler && c.target.path !== ch.target.path)) {
				anim.samplers.push({ ...anim.samplers[ch.sampler] });
				ch.sampler = anim.samplers.length - 1;
			}
			const s = anim.samplers[ch.sampler];
			if (ch.target.path === "translation") s.output = rewrite(s.output, xz);
			else if (ch.target.path === "rotation")
				s.output = rewrite(s.output, (v) => {
					for (let k = 0; k < v.length; k += 4) {
						v[k] = -v[k];
						v[k + 2] = -v[k + 2];
					}
				});
		}
	return true;
}
