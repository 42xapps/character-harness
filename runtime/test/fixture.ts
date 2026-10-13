// A small VRM Animation for the tests: an upper-body humanoid in a T-pose and
// one second of motion on the arms, spine, head and hips.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addAccessor, writeGlb, type Glb, type GltfNode } from "../src/rig/glb.ts";
import type { HumanBone } from "../src/rig/humanoid.ts";
import { qaxis, qmul, type Quat, type Vec3 } from "../src/rig/math.ts";

const BONES: [HumanBone, HumanBone | null, Vec3][] = [
	["hips", null, [0, 0.95, 0]],
	["spine", "hips", [0, 1.05, 0]],
	["chest", "spine", [0, 1.18, 0]],
	["upperChest", "chest", [0, 1.3, 0]],
	["neck", "upperChest", [0, 1.42, 0]],
	["head", "neck", [0, 1.5, 0]],
	["leftShoulder", "upperChest", [0.03, 1.36, 0]],
	["leftUpperArm", "leftShoulder", [0.15, 1.36, 0]],
	["leftLowerArm", "leftUpperArm", [0.4, 1.36, 0]],
	["leftHand", "leftLowerArm", [0.63, 1.36, 0]],
	["rightShoulder", "upperChest", [-0.03, 1.36, 0]],
	["rightUpperArm", "rightShoulder", [-0.15, 1.36, 0]],
	["rightLowerArm", "rightUpperArm", [-0.4, 1.36, 0]],
	["rightHand", "rightLowerArm", [-0.63, 1.36, 0]],
];
export const FRAMES = 31;

// each animated bone's rotation at time t (seconds, 0..1)
const MOTION: Partial<Record<HumanBone, (t: number) => Quat>> = {
	spine: (t) => qaxis([0, 1, 0], 10 * Math.sin(t * 6.28)),
	head: (t) => qaxis([1, 0, 0], 15 * Math.sin(t * 6.28)),
	rightUpperArm: (t) => qmul(qaxis([1, 0, 0], -30 * t), qaxis([0, 0, 1], 70 - 120 * t)),
	rightLowerArm: (t) => qaxis([0, 1, 0], 90 * t),
	rightHand: (t) => qaxis([0, 0, 1], 20 * Math.sin(t * 12)),
	leftUpperArm: (t) => qaxis([0, 0, 1], -70 + 10 * t),
};

export function fixtureGlb(): Glb {
	const glb: Glb = { json: { asset: { version: "2.0" } }, bin: Buffer.alloc(0) };
	const nodes: GltfNode[] = [];
	const index = new Map<HumanBone, number>();
	for (const [bone, parent, at] of BONES) {
		const p = parent ? BONES.find((b) => b[0] === parent)![2] : ([0, 0, 0] as Vec3);
		index.set(bone, nodes.length);
		nodes.push({ name: bone, translation: [at[0] - p[0], at[1] - p[1], at[2] - p[2]] });
	}
	for (const [bone, parent] of BONES) if (parent) (nodes[index.get(parent)!].children ??= []).push(index.get(bone)!);
	glb.json.nodes = nodes;
	glb.json.extensionsUsed = ["VRMC_vrm_animation"];
	glb.json.extensions = {
		VRMC_vrm_animation: { specVersion: "1.0", humanoid: { humanBones: Object.fromEntries([...index].map(([b, n]) => [b, { node: n }])) } },
	};
	const times = new Float32Array(FRAMES).map((_, f) => f / (FRAMES - 1));
	const input = addAccessor(glb, times, "SCALAR", true);
	const channels = [];
	const samplers = [];
	for (const [bone, rotation] of Object.entries(MOTION) as [HumanBone, (t: number) => Quat][]) {
		const values = new Float32Array(FRAMES * 4);
		times.forEach((t, f) => values.set(rotation(t), f * 4));
		samplers.push({ input, output: addAccessor(glb, values, "VEC4"), interpolation: "LINEAR" });
		channels.push({ sampler: samplers.length - 1, target: { node: index.get(bone)!, path: "rotation" } });
	}
	const hips = new Float32Array(FRAMES * 3);
	times.forEach((t, f) => hips.set([0.02 * Math.sin(t * 6.28), 0.95, 0], f * 3));
	samplers.push({ input, output: addAccessor(glb, hips, "VEC3"), interpolation: "LINEAR" });
	channels.push({ sampler: samplers.length - 1, target: { node: index.get("hips")!, path: "translation" } });
	glb.json.animations = [{ name: "fixture", channels, samplers }];
	return glb;
}

// the fixture written to a temporary .vrma file
export function fixtureFile(): string {
	const file = path.join(mkdtempSync(path.join(tmpdir(), "harness-fixture-")), "fixture.vrma");
	writeFileSync(file, writeGlb(fixtureGlb()));
	return file;
}
