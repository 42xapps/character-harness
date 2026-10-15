// The rewrites the player needs before it can load some VRMs (rig/normalize.ts):
// several skins merged into one, VRM 0.x MToon materials, VRM 0.x turned to
// face +Z. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { addAccessor, readAccessor, type Glb } from "../src/rig/glb.ts";
import { compose, minv, mmul, qaxis } from "../src/rig/math.ts";
import { convertV0Materials, mergeSkins, turnV0 } from "../src/rig/normalize.ts";

const translate = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const near = (a: ArrayLike<number>, b: ArrayLike<number>) =>
	assert.ok(Array.from(a).every((x, i) => Math.abs(x - b[i]) < 1e-5), `${Array.from(a)} vs ${Array.from(b)}`);

// root -> hips -> spine -> head, and two meshes skinned to different parts of it
function twoSkins(): Glb {
	const glb: Glb = { json: { asset: { version: "2.0" } }, bin: Buffer.alloc(0) };
	glb.json.nodes = [
		{ name: "root", children: [1] },
		{ name: "hips", translation: [0, 1, 0], children: [2] },
		{ name: "spine", translation: [0, 0.2, 0], children: [3] },
		{ name: "head", translation: [0, 0.4, 0] },
		{ name: "legs", mesh: 0, skin: 0 },
		{ name: "torso", mesh: 1, skin: 1 },
	] as never;
	const ibm = (...ys: number[]) => addAccessor(glb, new Float32Array(ys.flatMap((y) => minv(translate(0, y, 0)))), "MAT4");
	// skin 0: [spine, hips]; skin 1: [head, spine]
	glb.json.skins = [
		{ joints: [2, 1], inverseBindMatrices: ibm(1.2, 1) },
		{ joints: [3, 2], inverseBindMatrices: ibm(1.6, 1.2) },
	];
	const mesh = (joints: number[]) => ({
		primitives: [{ attributes: { POSITION: addAccessor(glb, new Float32Array([0, 0, 0]), "VEC3", true), JOINTS_0: addAccessor(glb, new Uint16Array(joints), "VEC4") } }],
	});
	glb.json.meshes = [mesh([1, 0, 0, 0]), mesh([0, 1, 0, 0])];
	return glb;
}

test("several skins become one, and every mesh still points at the same joints", () => {
	const glb = twoSkins();
	(glb.json.skins as { skeleton?: number }[])[0].skeleton = 1;
	assert.equal(mergeSkins(glb), 2);
	const skins = glb.json.skins as { joints: number[]; inverseBindMatrices: number; skeleton?: number }[];
	assert.equal(skins.length, 1);
	assert.equal(skins[0].skeleton, undefined);
	assert.deepEqual(skins[0].joints, [1, 2, 3]); // hips, spine, head: parents first
	const nodes = glb.json.nodes as { skin?: number; mesh?: number }[];
	assert.equal(nodes[4].skin, 0);
	assert.equal(nodes[5].skin, 0);
	const meshes = glb.json.meshes as { primitives: { attributes: Record<string, number> }[] }[];
	const joints = (m: number) => Array.from(readAccessor(glb, meshes[m].primitives[0].attributes.JOINTS_0)).map((i) => skins[0].joints[i]);
	assert.deepEqual(joints(0), [1, 2, 2, 2]); // was hips, spine
	assert.deepEqual(joints(1), [3, 2, 3, 3]); // was head, spine
	// each joint keeps its own bind
	const ibm = readAccessor(glb, skins[0].inverseBindMatrices);
	near(ibm.subarray(16, 32), minv(translate(0, 1.2, 0)));
});

test("a model with one skin keeps it, without a skeleton node", () => {
	const glb = twoSkins();
	glb.json.skins = [(glb.json.skins as unknown[])[0]];
	const before = JSON.stringify(glb.json);
	assert.equal(mergeSkins(glb), 1);
	assert.equal(JSON.stringify(glb.json), before);
	(glb.json.skins as { skeleton?: number }[])[0].skeleton = 1;
	mergeSkins(glb);
	assert.equal((glb.json.skins as { skeleton?: number }[])[0].skeleton, undefined);
});

test("a VRM 0.x MToon material gets its VRM 1.0 extension", () => {
	const glb: Glb = { json: { asset: { version: "2.0" } }, bin: Buffer.alloc(0) };
	glb.json.materials = [{ name: "skin" }, { name: "glass" }];
	glb.json.textures = [{}, {}, {}];
	glb.json.extensions = {
		VRM: {
			materialProperties: [
				{
					name: "skin",
					shader: "VRM/MToon",
					floatProperties: { _ShadeShift: -0.2, _ShadeToony: 0.8, _OutlineWidthMode: 1, _OutlineWidth: 0.25, _BlendMode: 3 },
					vectorProperties: { _ShadeColor: [0.5, 0.4, 0.3, 1] },
					textureProperties: { _ShadeTexture: 2 },
				},
				{ name: "glass", shader: "VRM/UnlitTransparent" },
			],
		},
	};
	assert.equal(convertV0Materials(glb), 1);
	const mats = glb.json.materials as { extensions?: { VRMC_materials_mtoon?: Record<string, unknown> } }[];
	const m = mats[0].extensions!.VRMC_materials_mtoon!;
	// three-vrm's VRM 0.x rules: toony = lerp(0.8, 1, 0.5 + 0.5 * -0.2) = 0.88; shift = 0.2 - 0.12
	near([m.shadingToonyFactor as number, m.shadingShiftFactor as number], [0.88, 0.08]);
	near(m.shadeColorFactor as number[], [0.5, 0.4, 0.3].map((c) => Math.pow(c, 2.2))); // gamma to linear
	assert.deepEqual(m.shadeMultiplyTexture, { index: 2 });
	assert.equal(m.outlineWidthMode, "worldCoordinates");
	near([m.outlineWidthFactor as number], [0.0025]);
	assert.equal(m.transparentWithZWrite, true);
	assert.equal(mats[1].extensions, undefined); // not MToon
	assert.ok(glb.json.extensionsUsed?.includes("VRMC_materials_mtoon"));
});

test("a VRM 0.x model is turned to face +Z, its skeleton and mesh together", () => {
	const glb = twoSkins();
	mergeSkins(glb);
	glb.json.extensions = { VRM: {} };
	const nodes = glb.json.nodes as { translation?: number[]; rotation?: number[] }[];
	nodes[2].translation = [0.1, 0.2, 0.3];
	nodes[2].rotation = qaxis([1, 0, 0], 30);
	const meshes = glb.json.meshes as { primitives: { attributes: Record<string, number> }[] }[];
	meshes[0].primitives[0].attributes.POSITION = addAccessor(glb, new Float32Array([1, 2, 3]), "VEC3", true);
	assert.equal(turnV0(glb), true);
	near(nodes[2].translation!, [-0.1, 0.2, -0.3]);
	near(readAccessor(glb, meshes[0].primitives[0].attributes.POSITION), [-1, 2, -3]);
	// x and z turn: a rotation about X becomes one about -X
	near(nodes[2].rotation!, qaxis([-1, 0, 0], 30));
	// the bind matrices turn with the nodes, so each joint still binds where it is
	const skin = (glb.json.skins as { joints: number[]; inverseBindMatrices: number }[])[0];
	const ibm = readAccessor(glb, skin.inverseBindMatrices);
	const world = (i: number): number[] => {
		const n = nodes[i] as { translation?: number[]; rotation?: number[] };
		const local = compose((n.translation ?? [0, 0, 0]) as never, (n.rotation ?? [0, 0, 0, 1]) as never, [1, 1, 1]);
		const p = nodes.findIndex((x) => ((x as { children?: number[] }).children ?? []).includes(i));
		return p < 0 ? local : mmul(world(p), local);
	};
	const turned = (m: number[]) => m.map((x, k) => x * [-1, 1, -1, 1][k % 4] * [-1, 1, -1, 1][Math.floor(k / 4)]);
	near(ibm.subarray(0, 16), turned(minv(translate(0, 1, 0)))); // hips
	near(world(1).slice(12, 15), [-0, 1, -0]);
	// spine sits off the axis: its turned bind matches where its turned node is
	near(minv(Array.from(ibm.subarray(16, 32))).slice(12, 15), [0, 1.2, 0].map((x, k) => (k === 1 ? x : -x)));
	near(world(2).slice(12, 15), [-0.1, 1.2, -0.3]);
	assert.equal(turnV0({ json: { extensions: { VRMC_vrm: {} } }, bin: Buffer.alloc(0) }), false);
});

test("a mesh two skins share gets a copy, each with its own skin's joints", () => {
	const glb = twoSkins();
	(glb.json.nodes as { mesh?: number }[])[5].mesh = 0; // torso now draws mesh 0 with skin 1
	mergeSkins(glb);
	const skins = glb.json.skins as { joints: number[] }[];
	const nodes = glb.json.nodes as { mesh?: number }[];
	const meshes = glb.json.meshes as { primitives: { attributes: Record<string, number> }[] }[];
	assert.notEqual(nodes[4].mesh, nodes[5].mesh);
	const joints = (m: number) => Array.from(readAccessor(glb, meshes[m].primitives[0].attributes.JOINTS_0)).map((i) => skins[0].joints[i]);
	assert.deepEqual(joints(nodes[4].mesh!), [1, 2, 2, 2]); // [1, 0] in skin 0: hips, spine
	assert.deepEqual(joints(nodes[5].mesh!), [2, 3, 3, 3]); // [1, 0] in skin 1: spine, head
});

test("a node tree with a loop or a node with two parents is refused", () => {
	const loop = twoSkins();
	(loop.json.nodes as { children?: number[] }[])[3].children = [2];
	assert.throws(() => mergeSkins(loop), /two parents|loops/);
	const shared = twoSkins();
	(shared.json.nodes as { children?: number[] }[])[0].children = [1, 1];
	assert.throws(() => mergeSkins(shared), /two parents/);
});

test("a VRM 0.x position that isn't a 3D vector is refused, not looped on", () => {
	const glb = twoSkins();
	glb.json.extensions = { VRM: {} };
	const meshes = glb.json.meshes as { primitives: { attributes: Record<string, number> }[] }[];
	glb.json.accessors![meshes[0].primitives[0].attributes.POSITION].type = "VEC2";
	assert.throws(() => turnV0(glb), /VEC2/);
});

test("a VRM 0.x texture or value that isn't valid falls back instead of passing through", () => {
	const glb: Glb = { json: { asset: { version: "2.0" } }, bin: Buffer.alloc(0) };
	glb.json.materials = [{ name: "a" }];
	glb.json.textures = [{}];
	glb.json.extensions = {
		VRM: { materialProperties: [{ name: "a", shader: "VRM/MToon", floatProperties: { _ShadeToony: "x" as never }, textureProperties: { _ShadeTexture: 5, _SphereAdd: -1 } }] },
	};
	convertV0Materials(glb);
	const m = (glb.json.materials as { extensions: { VRMC_materials_mtoon: Record<string, unknown> } }[])[0].extensions.VRMC_materials_mtoon;
	assert.equal(m.shadeMultiplyTexture, undefined);
	assert.equal(m.matcapTexture, undefined);
	assert.deepEqual(m.matcapFactor, [0, 0, 0]);
	assert.ok(Number.isFinite(m.shadingToonyFactor));
});

test("a skin with fewer bind matrices than joints, or a joint that isn't a node, is refused", () => {
	const short = twoSkins();
	(short.json.skins as { joints: number[] }[])[0].joints = [2, 1, 3];
	assert.throws(() => mergeSkins(short), /fewer bind matrices/);
	const missing = twoSkins();
	(missing.json.skins as { joints: number[] }[])[1].joints = [3, 99];
	assert.throws(() => mergeSkins(missing), /isn't a node/);
});

test("an animation output two channels share is turned once", () => {
	const glb = twoSkins();
	glb.json.extensions = { VRM: {} };
	const output = addAccessor(glb, new Float32Array([1, 2, 3]), "VEC3");
	glb.json.animations = [
		{
			samplers: [{ input: addAccessor(glb, new Float32Array([0]), "SCALAR"), output }],
			channels: [
				{ sampler: 0, target: { node: 1, path: "translation" } },
				{ sampler: 0, target: { node: 2, path: "translation" } },
			],
		},
	];
	turnV0(glb);
	near(readAccessor(glb, glb.json.animations[0].samplers[0].output), [-1, 2, -3]);
});

test("VRM 0.x materials with the same name each get their own properties", () => {
	const glb: Glb = { json: { asset: { version: "2.0" } }, bin: Buffer.alloc(0) };
	glb.json.materials = [{ name: "cloth" }, { name: "cloth" }];
	const v0 = (outline: number) => ({ name: "cloth", shader: "VRM/MToon", floatProperties: { _OutlineWidthMode: 1, _OutlineWidth: outline } });
	glb.json.extensions = { VRM: { materialProperties: [v0(1), v0(2)] } };
	convertV0Materials(glb);
	const width = (i: number) => (glb.json.materials as { extensions: { VRMC_materials_mtoon: { outlineWidthFactor: number } } }[])[i].extensions.VRMC_materials_mtoon.outlineWidthFactor;
	near([width(0), width(1)], [0.01, 0.02]);
});

test("a sampler that drives a translation and a scale keeps the scale as it was", () => {
	const glb = twoSkins();
	glb.json.extensions = { VRM: {} };
	glb.json.animations = [
		{
			samplers: [{ input: addAccessor(glb, new Float32Array([0]), "SCALAR"), output: addAccessor(glb, new Float32Array([1, 2, 3]), "VEC3") }],
			channels: [
				{ sampler: 0, target: { node: 1, path: "translation" } },
				{ sampler: 0, target: { node: 2, path: "scale" } },
			],
		},
	];
	turnV0(glb);
	const [anim] = glb.json.animations;
	const out = (c: number) => readAccessor(glb, anim.samplers[anim.channels[c].sampler].output);
	near(out(0), [-1, 2, -3]);
	near(out(1), [1, 2, 3]);
});
