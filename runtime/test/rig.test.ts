// The model preparation: GLB reading and writing, the humanoid, and retargeting.
// Run with `npm test`. Uses a small generated animation (fixture.ts), no network.

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { addAccessor, readAccessor, readGlb, writeGlb, type Glb } from "../src/rig/glb.ts";
import { readHumanoid, type HumanBone, type Humanoid } from "../src/rig/humanoid.ts";
import { compose, decompose, mmul, qaxis, qinv, qmul, type Mat4, type Quat } from "../src/rig/math.ts";
import { retarget, type Clip } from "../src/rig/retarget.ts";
import { FRAMES, fixtureFile } from "./fixture.ts";

const FIXTURE = fixtureFile();
const load = () => readGlb(FIXTURE);

// rotations are equal up to sign
function sameRotation(a: Quat, b: Quat, eps = 1e-4) {
	const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
	assert.ok(1 - d < eps, `rotations differ: ${a.map((x) => x.toFixed(4))} vs ${b.map((x) => x.toFixed(4))}`);
}

// world rotations of every node of `h` with the clip's frame `f` applied
function worldAt(h: Humanoid, clip: Clip | null, f: number): Quat[] {
	const local = h.local.map((l) => ({ ...l }));
	for (const t of clip?.tracks ?? []) if (t.path === "rotation") local[t.node].r = Array.from(t.values.subarray(f * 4, f * 4 + 4)) as Quat;
	const world: Mat4[] = [];
	const w = (i: number): Mat4 =>
		(world[i] ??= h.parent[i] < 0 ? compose(local[i].t, local[i].r, local[i].s) : mmul(w(h.parent[i]), compose(local[i].t, local[i].r, local[i].s)));
	return h.local.map((_, i) => decompose(w(i)).r);
}

// the animation's own rotation keys at `frames`, per node
function sourceClip(glb: Glb, frames: number[]): Map<number, Quat[]> {
	const a = glb.json.animations![0];
	const out = new Map<number, Quat[]>();
	for (const ch of a.channels) {
		if (ch.target.path !== "rotation") continue;
		const v = readAccessor(glb, a.samplers[ch.sampler].output);
		out.set(ch.target.node!, frames.map((f) => Array.from(v.subarray(f * 4, f * 4 + 4)) as Quat));
	}
	return out;
}

test("a GLB survives writing and reading back", () => {
	const glb: Glb = { json: { asset: { version: "2.0" } }, bin: Buffer.alloc(0) };
	const values = new Float32Array([0, 0.5, 1, 1.5]);
	const index = addAccessor(glb, values, "SCALAR", true);
	const back = readGlb(writeTemp(writeGlb(glb)));
	assert.deepEqual(Array.from(readAccessor(back, index)), Array.from(values));
	assert.deepEqual(back.json.accessors![index].min, [0]);
	assert.deepEqual(back.json.accessors![index].max, [1.5]);
});

test("a VRM Animation has a humanoid", () => {
	const h = readHumanoid(load())!;
	assert.equal(h.version, "1");
	for (const b of ["hips", "spine", "head", "leftUpperArm", "rightHand"] as HumanBone[]) assert.ok(h.bones[b] !== undefined, b);
});

test("retargeting onto the same skeleton keeps every rotation", () => {
	const glb = load();
	const h = readHumanoid(glb)!;
	const clip = retarget(glb, h, h);
	const frames = [0, 10, 20, clip.times.length - 1];
	const src = sourceClip(glb, frames);
	for (const t of clip.tracks) {
		if (t.path !== "rotation" || !src.has(t.node)) continue;
		frames.forEach((f, i) => sameRotation(Array.from(t.values.subarray(f * 4, f * 4 + 4)) as Quat, src.get(t.node)![i]));
	}
});

// the motion of a model's bones, as world-space changes from its rest pose
function deltas(h: Humanoid, clip: Clip | null, f: number, bones: HumanBone[]): Quat[] {
	const rest = worldAt(h, null, 0);
	const now = worldAt(h, clip, f);
	return bones.map((b) => qmul(now[h.bones[b]!], qinv(rest[h.bones[b]!])));
}

test("a model with a different rest pose moves the same way in world space", () => {
	const glb = load();
	const source = readHumanoid(glb)!;
	// the model: the same skeleton with its arm bones rotated at rest, as a
	// model in an A-pose with bones rolled differently would be
	const modelGlb = load();
	const nodes = modelGlb.json.nodes!;
	const arm = source.bones.rightUpperArm!;
	const fore = source.bones.rightLowerArm!;
	nodes[arm].rotation = qaxis([0, 0, 1], 50);
	nodes[fore].rotation = qmul(qaxis([1, 0, 0], 35), qaxis([0, 0, 1], -20));
	const model = readHumanoid(modelGlb)!;
	const clip = retarget(glb, source, model);
	// the source's own motion, as world rotations
	const srcClip: Clip = { times: clip.times, tracks: [] };
	for (const [node, qs] of sourceClip(glb, [...clip.times.keys()]))
		srcClip.tracks.push({ node, path: "rotation", values: new Float32Array(qs.flat()) });
	const restSrc = worldAt(source, null, 0);
	const restModel = worldAt(model, null, 0);
	for (const f of [0, 10, 20, FRAMES - 1]) {
		const ws = worldAt(source, srcClip, f);
		const wm = worldAt(model, clip, f);
		for (const b of ["rightUpperArm", "rightLowerArm", "rightHand", "head", "spine"] as HumanBone[]) {
			const n = source.bones[b]!;
			const dSrc = qmul(ws[n], qinv(restSrc[n]));
			const dModel = qmul(wm[n], qinv(restModel[n]));
			sameRotation(dModel, dSrc);
		}
	}
});

function writeTemp(b: Buffer): string {
	const file = path.join(mkdtempSync(path.join(tmpdir(), "harness-test-")), "t.glb");
	writeFileSync(file, b);
	return file;
}

test("a VRM 0.x model, which faces -Z, gets the motion turned to face it", () => {
	const glb = load();
	const source = readHumanoid(glb)!;
	const model: Humanoid = { ...readHumanoid(load())!, version: "0" };
	const clip = retarget(glb, source, model);
	const srcClip: Clip = { times: clip.times, tracks: [] };
	for (const [node, qs] of sourceClip(glb, [...clip.times.keys()]))
		srcClip.tracks.push({ node, path: "rotation", values: new Float32Array(qs.flat()) });
	const bones: HumanBone[] = ["rightUpperArm", "rightLowerArm", "spine", "head"];
	const f = 20;
	const src = deltas(source, srcClip, f, bones);
	const out = deltas(model, clip, f, bones);
	// turned 180 degrees about Y: x and z flip
	src.forEach((q, i) => sameRotation(out[i], [-q[0], q[1], -q[2], q[3]]));
});

test("a one-key animation (a pose) still makes a clip with increasing times", () => {
	const glb = load();
	// keep only the first key of every channel
	const a = glb.json.animations![0];
	const first = addAccessor(glb, new Float32Array([0]), "SCALAR", true);
	for (const s of a.samplers) {
		const comps = glb.json.accessors![s.output].type === "VEC4" ? 4 : 3;
		s.output = addAccessor(glb, readAccessor(glb, s.output).slice(0, comps), comps === 4 ? "VEC4" : "VEC3");
		s.input = first;
	}
	const h = readHumanoid(glb)!;
	const clip = retarget(glb, h, h);
	assert.ok(clip.times.length >= 2);
	for (let i = 1; i < clip.times.length; i++) assert.ok(clip.times[i] > clip.times[i - 1]);
});
