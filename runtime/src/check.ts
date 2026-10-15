// Checks a character before it runs: its keys, its body, and that what its
// extensions will ask for (gestures, emotions, talking styles, camera moves)
// is something the player has for it. `npm run check -- characters/<id>`
// prints the whole report; `npm start` runs the same checks and stops on an
// error.
//
// The runtime checks what it knows: the manifest, the keys, the model. What an
// extension's config means is the extension's to check: a module handler may
// export `check({ config, body })`, which gets what the player has for this
// character and returns the problems it finds (docs/extensions.md).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Loaded } from "./extensions.ts";
import { DEFAULT_TIMEOUT_MS, requiredKeys, type Character } from "./manifest.ts";
import { readGlb, type Glb } from "./rig/glb.ts";
import { readHumanoid } from "./rig/humanoid.ts";
import { isObject } from "./rig/normalize.ts";
import { prepareModel, type Prepared } from "./rig/prepare.ts";

type ModelRig = Extract<Character["rig"], { kind: "model" }>;

// What the player has for a character: the words an extension may use. Null
// when it can't be told from here.
export interface Body {
	emotions: string[] | null;
	registers: string[] | null; // talking styles; "regular" is always there, the talking loop itself
	gestures: string[] | null;
	cameras: string[] | null;
}

export interface Problems {
	errors?: string[];
	warnings?: string[];
}

export interface Report {
	ok: string[]; // what passed, one line each
	errors: string[];
	warnings: string[];
	prepared?: Prepared; // the model the player shows, for a character with one
}

const PLAYER_ASSETS = path.resolve(import.meta.dirname, "../../player/assets");
// what every character gets from the player: the camera moves, and the emotion
// set a model character's face is built with (player/src/app/app_config.h,
// player_vrm.c); a cooked-in profile's gestures are the shared gesture set
const CAMERAS = "mutuals/camera_moves.hzt";
const MODEL_EMOTIONS = "mutuals/emotions.hzt";
const PROFILE_GESTURES = "mutuals/gestures.hzt";

// the face a model needs, as VRM 1.0 presets and their VRM 0.x names
const FACE: [string, string][] = [
	["happy", "joy"], ["angry", "angry"], ["sad", "sorrow"], ["relaxed", "fun"], ["surprised", "surprised"],
	["blink", "blink"], ["aa", "a"], ["ih", "i"], ["ou", "u"], ["ee", "e"], ["oh", "o"],
];

// The names of a player asset's entries (`  name "..."` lines), from the line
// after `section` when given. Null when the file isn't there.
function assetNames(file: string, section?: string): string[] | null {
	const abs = inAssets(file);
	if (!abs || !existsSync(abs)) return null;
	let text = readFileSync(abs, "utf8");
	if (section) {
		const at = text.search(new RegExp(`^${section} `, "m"));
		if (at < 0) return [];
		text = text.slice(at).replace(/^[^\n]*\n/, "");
		// up to the next top-level key
		const end = text.search(/^\S/m);
		if (end >= 0) text = text.slice(0, end);
	}
	return [...text.matchAll(/^ {2}name "([^"\n]*)"/gm)].map((m) => m[1]);
}

// a path inside the player's assets, or null for one that would leave them
function inAssets(file: string): string | null {
	const abs = path.resolve(PLAYER_ASSETS, file);
	const rel = path.relative(PLAYER_ASSETS, abs);
	return rel.startsWith("..") || path.isAbsolute(rel) ? null : abs;
}

// a cooked asset path in a profile (`states "foxglove/states.hza" ...`) as its source file
function profileAsset(profile: string, key: string): string | null {
	const m = new RegExp(`^${key} "([^"]+)\\.hza"`, "m").exec(profile);
	return m ? `${m[1]}.hzt` : null;
}

// a path as the user would type it from here, or whole if it's elsewhere
export function shortPath(p: string): string {
	const rel = path.relative(process.cwd(), p);
	return rel.startsWith("..") ? p : rel || ".";
}

const withRegular = (styles: string[]) => (styles.includes("regular") ? styles : [...styles, "regular"]);

// the player skips a name it can't write into its generated assets
const unsafe = (name: string) => /["\\\u0000-\u001f\u007f]/.test(name) || /^\.*$/.test(name);

export function bodyOf(c: Character, r: Report): Body {
	const cameras = assetNames(CAMERAS);
	if (c.rig.kind === "model") {
		for (const name of [...c.rig.gestures.keys(), ...c.rig.talk.keys()])
			if (unsafe(name)) r.warnings.push(`the player skips ${JSON.stringify(name)}: a name can't have quotes, backslashes or control characters, or be only dots`);
		const gestures = [...c.rig.gestures.keys()].filter((n) => !unsafe(n));
		const styles = [...c.rig.talk.keys()].filter((n) => !unsafe(n));
		return { emotions: assetNames(MODEL_EMOTIONS), registers: withRegular(styles), gestures, cameras };
	}
	const file = `characters/${c.rig.profile}.hzt`;
	if (!existsSync(path.join(PLAYER_ASSETS, file))) {
		// a release build may have profiles this checkout doesn't
		r.warnings.push(`rig.profile: no profile "${c.rig.profile}" in player/assets/${file}, so its body can't be checked here`);
		return { emotions: null, registers: null, gestures: null, cameras };
	}
	const profile = readFileSync(path.join(PLAYER_ASSETS, file), "utf8");
	const states = profileAsset(profile, "states");
	const emotions = profileAsset(profile, "emotions");
	return {
		emotions: emotions ? assetNames(emotions) : null,
		registers: withRegular((states && assetNames(states, "registers")) || []),
		gestures: assetNames(PROFILE_GESTURES),
		cameras,
	};
}

// The model a character shows: what the player will make of it, then
// prepared, as `npm start` does (cached, so a second run is quick).
function checkModel(c: Character & { rig: ModelRig }, r: Report) {
	const rig = c.rig;
	const name = path.basename(rig.model);
	let glb: Glb | undefined;
	try {
		glb = readGlb(rig.model);
	} catch (e) {
		r.errors.push(`rig.model: ${text(e)}`);
		return;
	}
	let version: string | null = null;
	let skins = 0;
	// a model is untrusted data: whatever it holds, a failure here is its error
	try {
		({ version, skins } = inspectModel(glb, name, rig, r));
	} catch (e) {
		r.errors.push(`rig.model: ${name} can't be read as a model: ${text(e)}`);
		return;
	}
	glb = undefined; // prepared below from the file, so this copy can go
	prepare(c, rig, name, version, skins, r);
}

function inspectModel(glb: Glb, name: string, rig: ModelRig, r: Report): { version: string | null; skins: number } {
	const ext = (isObject(glb.json.extensions) ? glb.json.extensions : {}) as Record<string, any>;
	const v1 = ext.VRMC_vrm;
	const version = v1 ? "VRM 1.0" : ext.VRM ? "VRM 0.x" : null;
	// .vrma clips are retargeted through the model's humanoid; clips inside the
	// model play on it as they are
	const retargets = [...rig.idle, ...[...rig.talk.values()].flat(), ...[...rig.gestures.values()].map((g) => g.source)].some((s) => "file" in s);
	if (!version) r.warnings.push(`${name} is not a VRM model (no VRMC_vrm or VRM extension): it has no face expressions or humanoid`);
	const skins = Array.isArray(glb.json.skins) ? glb.json.skins.length : 0;
	let human;
	let unreadable = false;
	try {
		human = readHumanoid(glb);
	} catch (e) {
		unreadable = true;
		r.errors.push(`rig.model: ${name}'s humanoid can't be read: ${text(e)}`);
	}
	if (!human && retargets && !unreadable) r.errors.push(`rig.model: ${name} has no humanoid bones, so its .vrma animations can't play on it`);
	if (human) {
		if (human.bones.head === undefined) r.warnings.push(`${name} has no head bone: the player can't aim its gaze or frame it`);
		if (human.bones.leftEye === undefined || human.bones.rightEye === undefined)
			r.warnings.push(`${name} has no eye bones: the player can't fit the camera to its height`);
	}
	if (version) {
		// what the player reads: a VRM 1.0 preset's morph target binds, or a VRM 0.x
		// group by its exact preset name
		const presets = v1 ? (v1.expressions?.preset ?? {}) : {};
		const groups = v1 ? [] : (ext.VRM.blendShapeMaster?.blendShapeGroups ?? []);
		const have = new Set<string>(
			v1
				? Object.keys(presets).filter((k) => Array.isArray(presets[k]?.morphTargetBinds) && presets[k].morphTargetBinds.length)
				: (Array.isArray(groups) ? groups : []).filter((g) => Array.isArray(g?.binds) && g.binds.length).map((g) => (typeof g.presetName === "string" ? g.presetName : "")),
		);
		const missing = FACE.filter(([one, zero]) => !have.has(v1 ? one : zero)).map(([one]) => one);
		if (missing.length) r.warnings.push(`${name} has no ${missing.join(", ")} expression${missing.length > 1 ? "s" : ""}: its face won't show ${missing.length > 1 ? "them" : "it"}`);
	}
	return { version, skins };
}

function prepare(c: Character, rig: ModelRig, name: string, version: string | null, skins: number, r: Report) {
	try {
		const t0 = Date.now();
		r.prepared = prepareModel(c.id, rig);
		const how = r.prepared.rebuilt ? `prepared in ${Date.now() - t0} ms` : "prepared (cached)";
		const more = [skins > 1 && `${skins} skins merged`].filter(Boolean);
		r.ok.push(`body: ${name}, ${version ?? "glTF"}${more.length ? `, ${more.join(", ")}` : ""}; ${how}`);
	} catch (e) {
		r.errors.push(`rig.model: could not prepare ${name}: ${text(e)}`);
	}
}

// Every check, on a character already loaded with its extensions. `env` is
// what .env and the shell give; with `keysRequired` a missing key is an error,
// else a warning (a check can run before the keys are in).
export async function checkCharacter(
	c: Character,
	extensions: Loaded[],
	env: Record<string, string | undefined>,
	keysRequired: boolean,
): Promise<Report> {
	const r: Report = { ok: [], errors: [], warnings: [] };
	r.ok.push(`manifest, prompt, ${extensions.length} extension${extensions.length === 1 ? "" : "s"}`);

	const keys = requiredKeys(c);
	const missing = keys.filter((k) => !env[k]);
	const where = shortPath(c.env_file);
	if (!missing.length) r.ok.push(`keys: ${keys.join(", ")}`);
	else
		(keysRequired ? r.errors : r.warnings).push(
			existsSync(c.env_file)
				? `${where} is missing ${missing.join(", ")}`
				: `${where} doesn't exist yet: copy .env.example to it and fill in ${missing.join(", ")}`,
		);

	if (c.rig.kind === "model") checkModel(c as Character & { rig: { kind: "model" } }, r);
	const body = bodyOf(c, r);
	if (c.rig.kind === "profile" && !r.warnings.some((w) => w.startsWith("rig.profile"))) r.ok.push(`body: profile ${c.rig.profile}, ${body.gestures?.length ?? 0} gestures`);

	for (const e of extensions) {
		if (!e.check) continue;
		// an extension is someone else's code: a check that throws, runs out of
		// time or returns anything but lists of messages is its error
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const found: unknown = await Promise.race([
				Promise.resolve().then(() => e.check!({ config: e.config, body: structuredClone(body) })),
				new Promise((_, reject) => {
					timer = setTimeout(() => reject(new Error(`it didn't finish in ${DEFAULT_TIMEOUT_MS} ms`)), DEFAULT_TIMEOUT_MS);
				}),
			]);
			const list = (v: unknown) => (v === undefined || v === null ? [] : Array.isArray(v) && v.every((m) => typeof m === "string") ? (v as string[]) : null);
			const plain = found === undefined || found === null || (typeof found === "object" && !Array.isArray(found));
			const errors = plain ? list((found as Problems | null)?.errors) : null;
			const warnings = plain ? list((found as Problems | null)?.warnings) : null;
			if (!errors || !warnings) {
				r.errors.push(`${e.name}: its check returned something other than { errors, warnings } lists of messages`);
				continue;
			}
			add(r.errors, e.name, errors);
			add(r.warnings, e.name, warnings);
			if (!errors.length && !warnings.length) r.ok.push(`${e.name}: config`);
		} catch (err) {
			r.errors.push(`${e.name}: its check failed: ${text(err)}`);
		} finally {
			clearTimeout(timer);
		}
	}
	return r;
}

// an extension's messages, a few hundred at most, each cut to a line's length
const MAX_MESSAGES = 200;
const MAX_MESSAGE = 500;
function add(to: string[], name: string, messages: string[]) {
	for (const m of messages.slice(0, MAX_MESSAGES)) to.push(`${name}: ${m.length > MAX_MESSAGE ? `${m.slice(0, MAX_MESSAGE)}…` : m}`);
	if (messages.length > MAX_MESSAGES) to.push(`${name}: and ${messages.length - MAX_MESSAGES} more`);
}

// an error's message, whatever was thrown
export function text(e: unknown): string {
	try {
		return e instanceof Error ? String(e.message) : String(e);
	} catch {
		return "(an error that can't be shown)";
	}
}

// What a character, its model or a provider names is printed as is, so
// control characters (terminal escapes, and newlines that could fake a line of
// the report) are shown as codes instead.
export function printable(s: string): string {
	return s.replace(/[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/g, (ch) => `\\x${ch.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

export function printReport(c: Character, r: Report, all: boolean): void {
	if (all) {
		console.log(printable(`${c.name} (${shortPath(c.dir)})`));
		for (const line of r.ok) console.log(printable(`  ✓ ${line}`));
	}
	for (const line of r.errors) console.log(printable(`  ✗ ${line}`));
	for (const line of r.warnings) console.log(printable(`  ⚠ ${line}`));
	if (all || r.errors.length || r.warnings.length) {
		const n = (k: number, what: string) => `${k} ${what}${k === 1 ? "" : "s"}`;
		console.log(`${n(r.errors.length, "error")}, ${n(r.warnings.length, "warning")}`);
	}
}
