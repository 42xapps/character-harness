// The humanoid skeleton of a VRM model or a VRM Animation: which node is each
// standard bone, and every node's rest transform in local and world space.

import type { Glb } from "./glb.ts";
import { compose, decompose, IDENTITY_Q, mmul, type Mat4, type Quat, type Vec3 } from "./math.ts";

// VRM 1.0 humanoid bones, parents before children
export const HUMAN_BONES = [
	"hips", "spine", "chest", "upperChest", "neck", "head", "leftEye", "rightEye", "jaw",
	"leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes",
	"rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes",
	"leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
	"rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
	"leftThumbMetacarpal", "leftThumbProximal", "leftThumbDistal",
	"leftIndexProximal", "leftIndexIntermediate", "leftIndexDistal",
	"leftMiddleProximal", "leftMiddleIntermediate", "leftMiddleDistal",
	"leftRingProximal", "leftRingIntermediate", "leftRingDistal",
	"leftLittleProximal", "leftLittleIntermediate", "leftLittleDistal",
	"rightThumbMetacarpal", "rightThumbProximal", "rightThumbDistal",
	"rightIndexProximal", "rightIndexIntermediate", "rightIndexDistal",
	"rightMiddleProximal", "rightMiddleIntermediate", "rightMiddleDistal",
	"rightRingProximal", "rightRingIntermediate", "rightRingDistal",
	"rightLittleProximal", "rightLittleIntermediate", "rightLittleDistal",
] as const;
export type HumanBone = (typeof HUMAN_BONES)[number];

// VRM 0.x names the thumb bones differently
const VRM0_RENAMES: Record<string, HumanBone> = {
	leftThumbProximal: "leftThumbMetacarpal",
	leftThumbIntermediate: "leftThumbProximal",
	rightThumbProximal: "rightThumbMetacarpal",
	rightThumbIntermediate: "rightThumbProximal",
};

export interface Rest {
	t: Vec3;
	r: Quat;
	s: Vec3;
}

export interface Humanoid {
	// "1" for VRM 1.0 and VRM Animation, "0" for VRM 0.x (which faces -Z),
	// unless the runtime turned it to face +Z (rig/normalize.ts)
	version: "0" | "1";
	bones: Partial<Record<HumanBone, number>>;
	parent: number[]; // per node, -1 for a root
	local: Rest[]; // per node
	world: Mat4[]; // per node, rest pose
}

function nodeRest(n: { translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }): Rest {
	if (n.matrix) return decompose(n.matrix);
	return {
		t: (n.translation as Vec3) ?? [0, 0, 0],
		r: (n.rotation as Quat) ?? IDENTITY_Q,
		s: (n.scale as Vec3) ?? [1, 1, 1],
	};
}

// the bone map of a model (VRMC_vrm or VRM 0.x) or an animation (VRMC_vrm_animation)
function boneMap(glb: Glb): { version: "0" | "1"; bones: Partial<Record<HumanBone, number>> } | null {
	const ext = glb.json.extensions ?? {};
	const v1 = (ext.VRMC_vrm ?? ext.VRMC_vrm_animation) as { humanoid?: { humanBones?: Record<string, { node: number }> } } | undefined;
	if (v1?.humanoid?.humanBones) {
		const bones: Partial<Record<HumanBone, number>> = {};
		for (const [name, b] of Object.entries(v1.humanoid.humanBones))
			if ((HUMAN_BONES as readonly string[]).includes(name) && typeof b?.node === "number") bones[name as HumanBone] = b.node;
		return { version: "1", bones };
	}
	const v0 = ext.VRM as { humanoid?: { humanBones?: { bone: string; node: number }[] } } | undefined;
	if (v0?.humanoid?.humanBones) {
		const bones: Partial<Record<HumanBone, number>> = {};
		for (const b of v0.humanoid.humanBones) {
			const name = VRM0_RENAMES[b.bone] ?? b.bone;
			if ((HUMAN_BONES as readonly string[]).includes(name) && typeof b.node === "number") bones[name as HumanBone] = b.node;
		}
		return { version: "0", bones };
	}
	return null;
}

// The humanoid of a .vrm or .vrma; null when the file has no humanoid.
export function readHumanoid(glb: Glb): Humanoid | null {
	const map = boneMap(glb);
	if (!map || map.bones.hips === undefined) return null;
	const nodes = glb.json.nodes ?? [];
	const parent = nodes.map(() => -1);
	nodes.forEach((n, i) => n.children?.forEach((c) => (parent[c] = i)));
	const local = nodes.map(nodeRest);
	const world: Mat4[] = [];
	const resolve = (i: number): Mat4 => {
		if (world[i]) return world[i];
		const m = compose(local[i].t, local[i].r, local[i].s);
		world[i] = parent[i] < 0 ? m : mmul(resolve(parent[i]), m);
		return world[i];
	};
	nodes.forEach((_, i) => resolve(i));
	return { version: map.version, bones: map.bones, parent, local, world };
}

// rotation part of a world matrix
export function worldRotation(h: Humanoid, node: number): Quat {
	return node < 0 ? IDENTITY_Q : decompose(h.world[node]).r;
}
