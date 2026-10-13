// Builds the model the player loads for a character with `rig.model`: the
// character's .vrm with every animation it names baked onto its skeleton, and
// a table of which clip is idle, which talking style, which gesture.
//
// The table goes in the file's root `extras.mutualsHarness`:
//   { version, idle: [clip], talk: { style: [clip] }, gestures: { name: { clip, hold } } }
// where a clip is an index into the file's animations. VRM Animation files are
// retargeted (retarget.ts) and appended; clips already in the model are used
// as they are.
//
// The result is cached under .cache/characters/<id>/ and only rebuilt when the
// model, an animation file, the table or this baking code changes, so the
// player's own import cache keeps working.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ClipSource, Rig } from "../manifest.ts";
import { addAccessor, readGlb, writeGlb, type Glb } from "./glb.ts";
import { readHumanoid, type Humanoid } from "./humanoid.ts";
import { retarget } from "./retarget.ts";

// bump when the prepared file's layout changes
const VERSION = 1;
const CACHE = path.resolve(import.meta.dirname, "../../../.cache/characters");

export interface Prepared {
	file: string; // the model the player loads
	rebuilt: boolean;
	clips: number; // clips baked, when rebuilt
}

type ModelRig = Extract<Rig, { kind: "model" }>;

function sources(rig: ModelRig): ClipSource[] {
	return [...rig.idle, ...[...rig.talk.values()].flat(), ...[...rig.gestures.values()].map((g) => g.source)];
}

// what the prepared file depends on: the files' sizes and times, the table,
// and the code that bakes it
function fingerprint(rig: ModelRig): string {
	const h = createHash("sha256");
	h.update(`v${VERSION}\n`);
	for (const f of readdirSync(import.meta.dirname).filter((f) => f.endsWith(".ts")).sort())
		h.update(readFileSync(path.join(import.meta.dirname, f)));
	const stamp = (f: string) => {
		const st = statSync(f);
		h.update(`${f} ${st.size} ${st.mtimeMs}\n`);
	};
	stamp(rig.model);
	for (const s of sources(rig)) if ("file" in s) stamp(s.file);
	h.update(JSON.stringify({ idle: rig.idle, talk: [...rig.talk], gestures: [...rig.gestures] }));
	return h.digest("hex");
}

function bake(rig: ModelRig): { glb: Glb; clips: number } {
	const glb = readGlb(rig.model);
	const model = readHumanoid(glb);
	// the model's own clips, before any are appended
	const own = [...(glb.json.animations ?? [])];
	const named = (s: ClipSource, at: string): number => {
		if ("clip" in s) {
			const i = own.findIndex((a) => a.name === s.clip);
			if (i < 0) {
				const names = own.map((a) => a.name).filter(Boolean);
				throw new Error(
					`${at}: the model has no animation named "${s.clip}"` +
						(names.length ? ` (it has ${names.join(", ")})` : " (it has none)"),
				);
			}
			return i;
		}
		if (!model) throw new Error(`${rig.model} has no VRM humanoid, so ${path.basename(s.file)} can't be retargeted onto it`);
		return appendRetargeted(glb, model, s.file, at);
	};
	// one baked clip per file, however many roles use it
	const done = new Map<string, number>();
	const clip = (s: ClipSource, at: string): number => {
		const key = "file" in s ? `file:${s.file}` : `clip:${s.clip}`;
		if (!done.has(key)) done.set(key, named(s, at));
		return done.get(key)!;
	};
	const table = {
		version: VERSION,
		idle: rig.idle.map((s, i) => clip(s, `idle[${i}]`)),
		talk: Object.fromEntries([...rig.talk].map(([style, list]) => [style, list.map((s, i) => clip(s, `talk.${style}[${i}]`))])),
		gestures: Object.fromEntries([...rig.gestures].map(([name, g]) => [name, { clip: clip(g.source, `gestures.${name}`), hold: g.hold }])),
	};
	glb.json.extras = { ...(glb.json.extras ?? {}), mutualsHarness: table };
	return { glb, clips: done.size };
}

function appendRetargeted(glb: Glb, model: Humanoid, file: string, role: string): number {
	const anim = readGlb(file);
	const human = readHumanoid(anim);
	if (!human) throw new Error(`${file} is not a VRM Animation (no VRMC_vrm_animation humanoid)`);
	const clip = retarget(anim, human, model);
	const input = addAccessor(glb, clip.times, "SCALAR", true);
	const channels = [];
	const samplers = [];
	for (const t of clip.tracks) {
		const output = addAccessor(glb, t.values, t.path === "rotation" ? "VEC4" : "VEC3");
		samplers.push({ input, output, interpolation: "LINEAR" });
		channels.push({ sampler: samplers.length - 1, target: { node: t.node, path: t.path } });
	}
	glb.json.animations ??= [];
	glb.json.animations.push({ name: `${path.basename(file, path.extname(file))} (${role})`, channels, samplers });
	return glb.json.animations.length - 1;
}

export function prepareModel(id: string, rig: ModelRig): Prepared {
	const dir = path.join(CACHE, id);
	const file = path.join(dir, `${id}${path.extname(rig.model).toLowerCase() || ".vrm"}`);
	const stampFile = path.join(dir, "inputs.sha256");
	const stamp = fingerprint(rig);
	if (existsSync(file) && existsSync(stampFile) && readFileSync(stampFile, "utf8") === stamp)
		return { file, rebuilt: false, clips: 0 };
	const { glb, clips } = bake(rig);
	mkdirSync(dir, { recursive: true });
	writeFileSync(file, writeGlb(glb));
	writeFileSync(stampFile, stamp);
	return { file, rebuilt: true, clips };
}
