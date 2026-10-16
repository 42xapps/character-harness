// A VRM's spring bones, read from either VRM version into the list the player
// turns into cloth (rig/springs.ts). Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { addAccessor, readAccessor, type Glb } from "../src/rig/glb.ts";
import { readHumanoid } from "../src/rig/humanoid.ts";
import { minv, mmul } from "../src/rig/math.ts";
import { MAX_SPRINGS, addSpringJoints, readSprings } from "../src/rig/springs.ts";

const near = (a: ArrayLike<number>, b: ArrayLike<number>) =>
	assert.ok(Array.from(a).every((x, i) => Math.abs(x - b[i]) < 1e-5), `${Array.from(a)} vs ${Array.from(b)}`);

// hips -> head -> hair1 -> hair2 -> hair2_end, with a skin of hips and head
function model(extensions: Record<string, unknown>): Glb {
	const glb: Glb = { json: { asset: { version: "2.0" }, extensions }, bin: Buffer.alloc(0) };
	glb.json.nodes = [
		{ name: "hips", translation: [0, 1, 0], children: [1] },
		{ name: "head", translation: [0, 0.5, 0], children: [2] },
		{ name: "hair1", translation: [0, 0.1, -0.1], children: [3] },
		{ name: "hair2", translation: [0, -0.2, 0], children: [4] },
		{ name: "hair2_end", translation: [0, -0.2, 0] },
	];
	glb.json.skins = [{ joints: [0, 1, 2, 3] }];
	return glb;
}

const humanoidV1 = { humanoid: { humanBones: { hips: { node: 0 }, head: { node: 1 } } } };

test("VRM 1.0 springs become one chain each, with their colliders", () => {
	const glb = model({
		VRMC_vrm: humanoidV1,
		VRMC_springBone: {
			colliders: [
				{ node: 1, shape: { sphere: { offset: [0, 0.1, 0], radius: 0.1 } } },
				{ node: 0, shape: { capsule: { offset: [-0.1, 0, 0], radius: 0.05, tail: [0.1, 0, 0] } } },
			],
			colliderGroups: [{ colliders: [0, 1] }],
			springs: [
				{
					joints: [
						{ node: 2, stiffness: 1.5, gravityPower: 0.2, gravityDir: [0, -1, 0], dragForce: 0.4, hitRadius: 0.02 },
						{ node: 3 },
						{ node: 4 },
					],
					colliderGroups: [0],
				},
			],
		},
	});
	const [s, ...rest] = readSprings(glb, false);
	assert.equal(rest.length, 0);
	assert.deepEqual(s.bones, [2, 3, 4]);
	assert.deepEqual(s.roots, [2]);
	assert.deepEqual([s.stiffness, s.gravity, s.drag, s.radius], [1.5, 0.2, 0.4, 0.02]);
	assert.deepEqual(s.colliders, [
		{ node: 1, radius: 0.1, offset: [0, 0.1, 0] },
		{ node: 0, radius: 0.05, offset: [-0.1, 0, 0], tail: [0.1, 0, 0] },
	]);
});

test("VRM 0.x groups take every bone below their roots, turned with the model", () => {
	const ext = {
		VRM: {
			secondaryAnimation: {
				// "stiffiness" is VRM 0.x's own spelling
				boneGroups: [{ bones: [2], stiffiness: 2, gravityPower: 0, gravityDir: { x: 0, y: -1, z: 0.5 }, dragForce: 0.7, hitRadius: 0.03, colliderGroups: [0] }],
				colliderGroups: [{ node: 1, colliders: [{ offset: { x: 0.1, y: 0.2, z: 0.3 }, radius: 0.08 }] }],
			},
		},
	};
	const unturned = readSprings(model(ext), false)[0];
	assert.deepEqual(unturned.bones, [2, 3, 4]);
	assert.deepEqual(unturned.roots, [2]);
	assert.equal(unturned.stiffness, 2);
	// VRM 0.x's z points the other way
	assert.deepEqual(unturned.colliders[0].offset, [0.1, 0.2, -0.3]);
	// the model turned 180 degrees about Y, so x and z change sign once more
	const turned = readSprings(model(ext), true)[0];
	assert.deepEqual(turned.colliders[0].offset, [-0.1, 0.2, 0.3]);
	assert.deepEqual(unturned.gravity_dir, [0, -1, 0.5]);
	assert.deepEqual(turned.gravity_dir, [-0, -1, -0.5]);
});

test("bad spring data is skipped or clamped, not trusted", () => {
	const glb = model({
		VRMC_springBone: {
			colliders: [{ node: 99, shape: { sphere: { offset: [0, 0, 0], radius: 1 } } }, "nope"],
			colliderGroups: [{ colliders: [0, 1, 5] }],
			springs: [
				{ joints: [{ node: 2, stiffness: 1e9, dragForce: -3, hitRadius: Number.NaN }, { node: 3 }], colliderGroups: [0, 7] },
				{ joints: [{ node: 2 }] }, // one joint: nothing to swing
				{ joints: [{ node: -1 }, { node: 99 }] },
				"nope",
			],
		},
	});
	const springs = readSprings(glb, false);
	assert.equal(springs.length, 1);
	assert.deepEqual([springs[0].stiffness, springs[0].drag, springs[0].radius], [4, 0, 0]);
	assert.deepEqual(springs[0].colliders, []);
});

test("a VRM 0.x group with a loop in its nodes takes each node once", () => {
	const glb = model({ VRM: { secondaryAnimation: { boneGroups: [{ bones: [2, 2] }], colliderGroups: [] } } });
	(glb.json.nodes![4] as { children?: number[] }).children = [2];
	assert.deepEqual(readSprings(glb, false)[0].bones, [2, 3, 4]);
});

test("past MAX_SPRINGS chains the rest are left out, and a bone swings in one chain only", () => {
	const glb = model({});
	// 60 two-node chains hanging from the head
	for (let i = 0; i < 60; i++) {
		const at = glb.json.nodes!.length;
		glb.json.nodes!.push({ name: `s${i}`, children: [at + 1] }, { name: `s${i}_end` });
		(glb.json.nodes![1] as { children: number[] }).children.push(at);
	}
	glb.json.extensions = { VRMC_springBone: { springs: Array.from({ length: 60 }, (_, i) => ({ joints: [{ node: 5 + 2 * i }, { node: 6 + 2 * i }] })) } };
	const out = readSprings(glb, false);
	assert.equal(out.length, MAX_SPRINGS);
	assert.ok(out.every((s) => s.bones.length === 2));
	// the same bones twice: the second chain has nothing left
	const twice = readSprings(model({ VRMC_springBone: { springs: [{ joints: [{ node: 2 }, { node: 3 }] }, { joints: [{ node: 2 }, { node: 3 }] }] } }), false);
	assert.equal(twice.length, 1);
});

test("a huge file can't make reading the springs slow or large", () => {
	const glb = model({});
	(glb.json.nodes![2] as { children: number[] }).children = Array(3_000_000).fill(3);
	glb.json.extensions = {
		VRM: {
			secondaryAnimation: {
				boneGroups: Array.from({ length: 5000 }, () => ({ bones: [2], colliderGroups: Array(200).fill(0) })),
				colliderGroups: [{ node: 1, colliders: Array.from({ length: 2000 }, () => ({ offset: { x: 0, y: 0, z: 0 }, radius: 0.1 })) }],
			},
		},
	};
	const t0 = Date.now();
	const out = readSprings(glb, false);
	assert.ok(Date.now() - t0 < 2000, `took ${Date.now() - t0} ms`);
	assert.equal(out.length, 1);
	assert.ok(out[0].colliders.length <= 64);
});

test("nodes a spring uses join the skin, after the joints already there", () => {
	const glb = model({ VRMC_vrm: humanoidV1, VRMC_springBone: { springs: [{ joints: [{ node: 2 }, { node: 3 }, { node: 4 }] }] } });
	const human = readHumanoid(glb)!;
	assert.equal(addSpringJoints(glb, readSprings(glb, false), human), 1);
	const skin = (glb.json.skins as { joints: number[]; inverseBindMatrices: number }[])[0];
	assert.deepEqual(skin.joints, [0, 1, 2, 3, 4]);
	const ibm = readAccessor(glb, skin.inverseBindMatrices);
	assert.equal(ibm.length, 5 * 16);
	// no binds in the file means identities, so the new joint follows its parent's
	near(ibm.subarray(4 * 16), mmul(minv(human.world[4]), human.world[3]));
	// a second call adds nothing
	assert.equal(addSpringJoints(glb, readSprings(glb, false), human), 0);
});

test("a new joint is bound from its nearest joint above, and the bind list matches the joints", () => {
	const glb = model({ VRMC_vrm: humanoidV1, VRMC_springBone: { springs: [{ joints: [{ node: 2 }, { node: 3 }, { node: 4 }] }] } });
	const human = readHumanoid(glb)!;
	// the skin's binds for hips, head, hair1, hair2 (hair2 bound 0.1 lower than it stands), plus a stray extra
	const shifted = [...minv(human.world[3])];
	shifted[13] += 0.1;
	const binds = [...minv(human.world[0]), ...minv(human.world[1]), ...minv(human.world[2]), ...shifted, ...minv(human.world[0])];
	(glb.json.skins as { inverseBindMatrices?: number }[])[0].inverseBindMatrices = addAccessor(glb, new Float32Array(binds), "MAT4");
	addSpringJoints(glb, readSprings(glb, false), human);
	const skin = (glb.json.skins as { joints: number[]; inverseBindMatrices: number }[])[0];
	const ibm = readAccessor(glb, skin.inverseBindMatrices);
	// one per joint: the stray one is gone
	assert.equal(ibm.length, 5 * 16);
	// hair2_end follows hair2's bind, not its own rest
	near(ibm.subarray(4 * 16), mmul(mmul(minv(human.world[4]), human.world[3]), shifted));
});

test("a sparse accessor is read whole, and float ones are written out in full", async () => {
	const { densifySparse } = await import("../src/rig/normalize.ts");
	// a VRM 0.x model, the kind that gets turned and so needs its accessors whole
	const glb: Glb = { json: { asset: { version: "2.0" }, extensions: { VRM: {} } }, bin: Buffer.alloc(0) };
	// a morph target of 4 points, all zero but points 1 and 3
	const values = addAccessor(glb, new Float32Array([1, 2, 3, 4, 5, 6]), "VEC3");
	const indices = addAccessor(glb, new Uint16Array([1, 3]), "SCALAR");
	const accessors = glb.json.accessors!;
	const sparse = accessors.length;
	accessors.push({
		componentType: 5126,
		count: 4,
		type: "VEC3",
		sparse: {
			count: 2,
			indices: { bufferView: accessors[indices].bufferView, componentType: 5123 },
			values: { bufferView: accessors[values].bufferView },
		},
	});
	const whole = [0, 0, 0, 1, 2, 3, 0, 0, 0, 4, 5, 6];
	near(readAccessor(glb, sparse), whole);
	assert.equal(densifySparse(glb), 1);
	assert.equal(accessors[sparse].sparse, undefined);
	near(readAccessor(glb, sparse), whole);
	assert.deepEqual([accessors[sparse].min, accessors[sparse].max], [[0, 0, 0], [4, 5, 6]]);
	// a sparse part that is null is no sparse part at all
	accessors.push({ ...accessors[sparse], sparse: null as never });
	near(readAccessor(glb, accessors.length - 1), whole);
	accessors.pop();
	// an index past the accessor's count is refused
	accessors.push({ ...accessors[sparse], sparse: { count: 1, indices: { bufferView: accessors[indices].bufferView, byteOffset: 2, componentType: 5123 }, values: { bufferView: accessors[values].bufferView } }, count: 2 });
	assert.throws(() => readAccessor(glb, accessors.length - 1), /past its count/);
});

test("a VRM 1.0 model keeps its sparse accessors: it isn't turned, so it doesn't need them whole", async () => {
	const { densifySparse } = await import("../src/rig/normalize.ts");
	const glb: Glb = { json: { asset: { version: "2.0" }, extensions: { VRMC_vrm: {} }, accessors: [{ componentType: 5126, count: 1, type: "VEC3", sparse: {} }] }, bin: Buffer.alloc(0) };
	assert.equal(densifySparse(glb), 0);
});

test("a spring node scaled to nothing stays out of the skin", () => {
	const glb = model({ VRMC_vrm: humanoidV1, VRMC_springBone: { springs: [{ joints: [{ node: 2 }, { node: 3 }, { node: 4 }] }] } });
	(glb.json.nodes![4] as { scale?: number[] }).scale = [0, 0, 0];
	const human = readHumanoid(glb)!;
	assert.equal(addSpringJoints(glb, readSprings(glb, false), human), 0);
	assert.deepEqual((glb.json.skins as { joints: number[] }[])[0].joints, [0, 1, 2, 3]);
});
