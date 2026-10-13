// Plays a VRM Animation (.vrma) on a VRM model's own skeleton.
//
// Every humanoid bone's motion is taken as a change from its rest pose in world
// space, and applied to the same bone of the model on top of the model's own
// rest pose. That is how VRM's normalized humanoid works (three-vrm does the
// same), but computed in world space a bone the model lacks (an upper chest, a
// shoulder) folds into its nearest parent instead of being lost. The hips also
// move, scaled by the ratio of the two hip heights.

import { readAccessor, type Glb, type GltfAnimation } from "./glb.ts";
import { HUMAN_BONES, worldRotation, type HumanBone, type Humanoid } from "./humanoid.ts";
import { decompose, IDENTITY_Q, minv, mpoint, qinv, qmul, qnorm, qslerp, type Quat, type Vec3 } from "./math.ts";

const FPS = 30;

// each bone's parent in the VRM humanoid, for bones the animation lacks
const PARENT: Partial<Record<HumanBone, HumanBone>> = {
	spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck",
	leftEye: "head", rightEye: "head", jaw: "head",
	leftUpperLeg: "hips", leftLowerLeg: "leftUpperLeg", leftFoot: "leftLowerLeg", leftToes: "leftFoot",
	rightUpperLeg: "hips", rightLowerLeg: "rightUpperLeg", rightFoot: "rightLowerLeg", rightToes: "rightFoot",
	leftShoulder: "upperChest", leftUpperArm: "leftShoulder", leftLowerArm: "leftUpperArm", leftHand: "leftLowerArm",
	rightShoulder: "upperChest", rightUpperArm: "rightShoulder", rightLowerArm: "rightUpperArm", rightHand: "rightLowerArm",
};
for (const side of ["left", "right"])
	for (const f of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
		const seg = f === "Thumb" ? ["Metacarpal", "Proximal", "Distal"] : ["Proximal", "Intermediate", "Distal"];
		PARENT[`${side}${f}${seg[0]}` as HumanBone] = `${side}Hand` as HumanBone;
		PARENT[`${side}${f}${seg[1]}` as HumanBone] = `${side}${f}${seg[0]}` as HumanBone;
		PARENT[`${side}${f}${seg[2]}` as HumanBone] = `${side}${f}${seg[1]}` as HumanBone;
	}

export interface Track {
	node: number; // a node of the model
	path: "rotation" | "translation";
	values: Float32Array; // one per frame: 4 floats for a rotation, 3 for a translation
}
export interface Clip {
	times: Float32Array;
	tracks: Track[];
}

interface Sampler {
	times: Float32Array;
	values: Float32Array;
	comps: number;
	interpolation: string;
}

function sample(s: Sampler, t: number): number[] {
	const n = s.times.length;
	const at = (i: number) => {
		// a cubic spline stores [in-tangent, value, out-tangent] per key
		const base = s.interpolation === "CUBICSPLINE" ? (i * 3 + 1) * s.comps : i * s.comps;
		return Array.from(s.values.subarray(base, base + s.comps));
	};
	if (t <= s.times[0]) return at(0);
	if (t >= s.times[n - 1]) return at(n - 1);
	let lo = 0;
	let hi = n - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (s.times[mid] <= t) lo = mid;
		else hi = mid;
	}
	if (s.interpolation === "STEP") return at(lo);
	// a cubic spline's tangents are dropped; resampling at 30 fps hides the difference
	const u = (t - s.times[lo]) / (s.times[hi] - s.times[lo] || 1);
	const a = at(lo);
	const b = at(hi);
	if (s.comps === 4) return qslerp(a as Quat, b as Quat, u);
	return a.map((v, i) => v + (b[i] - v) * u);
}

// The first animation of `anim` (a .vrma), on `model`'s skeleton.
export function retarget(anim: Glb, animHumanoid: Humanoid, model: Humanoid): Clip {
	const a = anim.json.animations?.[0] as GltfAnimation | undefined;
	if (!a) throw new Error("the animation file has no animation");
	const rotations = new Map<number, Sampler>();
	const translations = new Map<number, Sampler>();
	let duration = 0;
	for (const ch of a.channels) {
		const node = ch.target.node;
		const smp = a.samplers[ch.sampler];
		if (node === undefined || !smp || (ch.target.path !== "rotation" && ch.target.path !== "translation")) continue;
		const comps = ch.target.path === "rotation" ? 4 : 3;
		const s: Sampler = {
			times: readAccessor(anim, smp.input),
			values: readAccessor(anim, smp.output),
			comps,
			interpolation: smp.interpolation ?? "LINEAR",
		};
		duration = Math.max(duration, s.times[s.times.length - 1] ?? 0);
		(comps === 4 ? rotations : translations).set(node, s);
	}

	// a pose (one key) still needs two increasing times to be a valid clip
	const length = duration > 0 ? duration : 1 / FPS;
	const frames = Math.max(2, Math.round(length * FPS) + 1);
	const times = new Float32Array(frames);
	for (let f = 0; f < frames; f++) times[f] = (length * f) / (frames - 1);

	// the model's bones in parent-first order, with the animation's matching node
	const bones = HUMAN_BONES.filter((b) => model.bones[b] !== undefined);
	const boneOfNode = new Map<number, HumanBone>();
	for (const b of bones) boneOfNode.set(model.bones[b]!, b);
	const tracks = new Map<number, Float32Array>();
	for (const b of bones) tracks.set(model.bones[b]!, new Float32Array(frames * 4));
	const hipsNode = model.bones.hips!;
	const hipsTrack = new Float32Array(frames * 3);

	// VRM 0.x models face -Z where animations face +Z: turn every change 180 degrees about Y
	const flip = model.version === "0";
	const turn = (q: Quat): Quat => (flip ? [-q[0], q[1], -q[2], q[3]] : q);

	const srcRest = (n: number) => worldRotation(animHumanoid, n);
	const tgtRest = model.world.map((m) => decompose(m).r);
	const srcHips = animHumanoid.bones.hips!;
	const srcHipsRest: Vec3 = [animHumanoid.world[srcHips][12], animHumanoid.world[srcHips][13], animHumanoid.world[srcHips][14]];
	const tgtHipsRest: Vec3 = [model.world[hipsNode][12], model.world[hipsNode][13], model.world[hipsNode][14]];
	const hipsScale = srcHipsRest[1] > 1e-4 ? tgtHipsRest[1] / srcHipsRest[1] : 1;
	const hipsParent = model.parent[hipsNode];
	const hipsParentInv = hipsParent < 0 ? null : minv(model.world[hipsParent]);

	for (let f = 0; f < frames; f++) {
		const t = times[f];
		// the animation's world rotations at t
		const srcWorld = new Map<number, Quat>();
		const srcWorldOf = (n: number): Quat => {
			const hit = srcWorld.get(n);
			if (hit) return hit;
			const r = rotations.get(n);
			const local = r ? qnorm(sample(r, t) as Quat) : animHumanoid.local[n].r;
			const p = animHumanoid.parent[n];
			const w = p < 0 ? local : qmul(srcWorldOf(p), local);
			srcWorld.set(n, w);
			return w;
		};
		// each bone's change from rest, in world space
		const delta = new Map<HumanBone, Quat>();
		const deltaOf = (b: HumanBone): Quat => {
			const hit = delta.get(b);
			if (hit) return hit;
			const sn = animHumanoid.bones[b];
			let d: Quat;
			if (sn !== undefined) d = turn(qnorm(qmul(srcWorldOf(sn), qinv(srcRest(sn)))));
			else d = PARENT[b] ? deltaOf(PARENT[b]!) : IDENTITY_Q;
			delta.set(b, d);
			return d;
		};
		// the model's world rotations at t
		const tgtWorld = new Map<number, Quat>();
		const tgtWorldOf = (n: number): Quat => {
			const hit = tgtWorld.get(n);
			if (hit) return hit;
			const b = boneOfNode.get(n);
			let w: Quat;
			if (b) w = qmul(deltaOf(b), tgtRest[n]);
			else {
				const p = model.parent[n];
				w = p < 0 ? model.local[n].r : qmul(tgtWorldOf(p), model.local[n].r);
			}
			tgtWorld.set(n, w);
			return w;
		};
		for (const b of bones) {
			const n = model.bones[b]!;
			const p = model.parent[n];
			const local = qnorm(p < 0 ? tgtWorldOf(n) : qmul(qinv(tgtWorldOf(p)), tgtWorldOf(n)));
			tracks.get(n)!.set(local, f * 4);
		}
		// the hips: the animation's hip movement, scaled to the model
		const tr = translations.get(srcHips);
		let pos = tgtHipsRest;
		if (tr) {
			const local = sample(tr, t) as Vec3;
			const sp = animHumanoid.parent[srcHips];
			const world = sp < 0 ? local : mpoint(animHumanoid.world[sp], local);
			let d: Vec3 = [(world[0] - srcHipsRest[0]) * hipsScale, (world[1] - srcHipsRest[1]) * hipsScale, (world[2] - srcHipsRest[2]) * hipsScale];
			if (flip) d = [-d[0], d[1], -d[2]];
			pos = [tgtHipsRest[0] + d[0], tgtHipsRest[1] + d[1], tgtHipsRest[2] + d[2]];
		}
		hipsTrack.set(hipsParentInv ? mpoint(hipsParentInv, pos) : pos, f * 3);
	}

	const out: Track[] = [...tracks].map(([node, values]) => ({ node, path: "rotation" as const, values }));
	if (translations.has(srcHips)) out.push({ node: hipsNode, path: "translation", values: hipsTrack });
	return { times, tracks: out };
}
