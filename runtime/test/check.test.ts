// The checks `npm run check` and `npm start` run on a character (check.ts),
// and the director's and emotion-tags' own. Run with `npm test`.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { check as directorCheck } from "../../extensions/director/index.ts";
import { check as tagsCheck } from "../../extensions/emotion-tags/index.ts";
import { bodyOf, checkCharacter, printable, type Body, type Report } from "../src/check.ts";
import { loadExtensions } from "../src/extensions.ts";
import { loadCharacter, requiredKeys } from "../src/manifest.ts";
import { writeGlb, type Glb } from "../src/rig/glb.ts";

const FOXGLOVE = path.resolve(import.meta.dirname, "../../characters/foxglove");
const report = (): Report => ({ ok: [], errors: [], warnings: [] });
const temp: string[] = [];
after(() => temp.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tempDir = () => {
	const d = mkdtempSync(path.join(tmpdir(), "harness-check-"));
	temp.push(d);
	return d;
};

// a character with an empty model file, which the checks refuse before preparing it
function modelCharacter(animations = "talk: { regular: Talk, shout: Shout }\n    gestures: { wave: Wave }"): string {
	const dir = tempDir();
	writeFileSync(
		path.join(dir, "character.yaml"),
		`schema: 1
id: check-test
name: Test
description: A character for the tests.
author: tests
license: none
prompt: system.md
models:
  chat: { api: chat_completions, base_url: "https://example.invalid/v1", api_key_env: TEST_KEY, model: m }
stt: { provider: elevenlabs, model: scribe_v2_realtime }
voice: { provider: elevenlabs, voice_id: v, model: eleven_v4_turbo }
rig:
  engine: ">=0.5.8"
  model: model.vrm
  animations:
    ${animations}
extensions: []
env_file: .env
`,
	);
	writeFileSync(path.join(dir, "system.md"), "You are a test.");
	writeFileSync(path.join(dir, "model.vrm"), "");
	return dir;
}

test("FoxGlove's body is read from her profile in the player", () => {
	const r = report();
	const body = bodyOf(loadCharacter(FOXGLOVE), r);
	assert.deepEqual(r.errors, []);
	assert.ok(body.gestures?.includes("wave") && body.gestures.includes("cheer"));
	assert.ok(body.emotions?.includes("sparkle eyes"));
	assert.ok(body.cameras?.includes("push-in"));
	assert.deepEqual(body.registers, ["regular"]);
});

test("FoxGlove passes every check", async () => {
	const c = loadCharacter(FOXGLOVE);
	const r = await checkCharacter(c, await loadExtensions(c.extensions), { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings, []);
});

test("a missing key is a warning for a check and an error to start", async () => {
	const c = loadCharacter(FOXGLOVE);
	const exts = await loadExtensions(c.extensions);
	const check = await checkCharacter(c, exts, { OPENAI_API_KEY: "x" }, false);
	assert.deepEqual(check.errors, []);
	assert.match(check.warnings.join("\n"), /ELEVENLABS_API_KEY/);
	const start = await checkCharacter(c, exts, { OPENAI_API_KEY: "x" }, true);
	assert.match(start.errors.join("\n"), /ELEVENLABS_API_KEY/);
});

test("a model character's gestures and talking styles come from its rig", () => {
	const c = loadCharacter(modelCharacter());
	const body = bodyOf(c, report());
	assert.deepEqual(body.gestures, ["wave"]);
	assert.deepEqual(body.registers, ["regular", "shout"]);
});

test("a model that isn't a model file is an error, not a crash", async () => {
	const c = loadCharacter(modelCharacter());
	const r = await checkCharacter(c, [], { TEST_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.match(r.errors.join("\n"), /rig\.model/);
	assert.equal(r.prepared, undefined);
});

const body: Body = { emotions: ["happy", "warm"], registers: ["regular", "shout"], gestures: ["wave", "nod"], cameras: ["hold"] };
const director = {
	model: { base_url: "https://example.invalid/v1", api_key_env: "TEST_KEY", model: "m" },
	prompt: "Stage it.",
	emotions: { happy: "bright", warm: "soft" },
	registers: ["regular", "shout"],
	gestures: ["wave", "nod"],
	cameras: ["hold"],
	tags: { excited: "happy" },
};

test("the director accepts words the character has", () => {
	assert.deepEqual(directorCheck({ config: director, body }), { errors: [], warnings: [] });
});

test("the director warns about a word the character doesn't have, and one it never picks", () => {
	const r = directorCheck({ config: { ...director, gestures: ["wave", "shrug"], emotions: { happy: "", ecstatic: "" } }, body });
	assert.deepEqual(r.errors, []);
	assert.match(r.warnings!.join("\n"), /gesture "shrug"/);
	assert.match(r.warnings!.join("\n"), /emotion "ecstatic"/);
	assert.match(r.warnings!.join("\n"), /never picks gesture "nod"/);
});

test("the director refuses a config without its model or prompt", () => {
	const r = directorCheck({ config: { ...director, model: undefined, prompt: "" }, body });
	assert.match(r.errors!.join("\n"), /model\.base_url/);
	assert.match(r.errors!.join("\n"), /prompt/);
});

test("emotion-tags warns about a tag mapped to an emotion the player doesn't have, and refuses tags that aren't a map", () => {
	assert.equal(tagsCheck({ config: { tags: { excited: "happy" } }, body }), undefined);
	assert.match(tagsCheck({ config: { tags: { excited: "ecstatic" } }, body })!.warnings!.join(), /ecstatic/);
	assert.ok(tagsCheck({ config: { tags: ["happy"] }, body })!.errors!.length);
});

test("an extension's check picks how serious each problem is; the runtime only shows it", async () => {
	const c = loadCharacter(FOXGLOVE);
	const ext = (name: string, found: object) => ({ ...c.extensions[0], name, call: () => undefined, check: () => found });
	const r = await checkCharacter(c, [ext("a", { warnings: ["just so you know"] }), ext("b", { errors: ["can't work"] })], { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.deepEqual(r.warnings, ["a: just so you know"]);
	assert.deepEqual(r.errors, ["b: can't work"]);
});

test("an extension's check that returns something else is its error, not a crash", async () => {
	const c = loadCharacter(FOXGLOVE);
	const odd = { ...c.extensions[0], name: "odd", call: () => undefined, check: () => ({ errors: "oops" }) as never };
	const r = await checkCharacter(c, [odd], { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.match(r.errors.join(), /odd: its check returned/);
});

// a model file: glTF JSON with `extensions`, and a humanoid when given
function modelFile(dir: string, extensions: Record<string, unknown>): void {
	const glb: Glb = { json: { asset: { version: "2.0" }, nodes: [{ name: "root" }], extensions }, bin: Buffer.alloc(0) };
	writeFileSync(path.join(dir, "model.vrm"), writeGlb(glb));
}
const keys = { TEST_KEY: "x", ELEVENLABS_API_KEY: "x" };
const done = (c: { id: string }) => rmSync(path.resolve(import.meta.dirname, "../../.cache/characters", c.id), { recursive: true, force: true });

test("a plain glTF model with no .vrma clips is a warning, not an error", async () => {
	const dir = modelCharacter("{}");
	modelFile(dir, {});
	const c = loadCharacter(dir);
	const r = await checkCharacter(c, [], keys, true);
	done(c);
	assert.deepEqual(r.errors, []);
	assert.match(r.warnings.join("\n"), /not a VRM model/);
	assert.ok(r.prepared);
});

test("a model with .vrma clips needs a humanoid", async () => {
	const dir = modelCharacter(`idle: idle.vrma`);
	writeFileSync(path.join(dir, "idle.vrma"), "");
	modelFile(dir, {});
	const c = loadCharacter(dir);
	const r = await checkCharacter(c, [], keys, true);
	done(c);
	assert.match(r.errors.join("\n"), /no humanoid bones/);
});

test("a VRM 0.x expression counts only by the exact preset name the player reads", async () => {
	const dir = modelCharacter("{}");
	const bind = { binds: [{ mesh: 0, index: 0, weight: 100 }] };
	modelFile(dir, { VRM: { humanoid: { humanBones: [] }, blendShapeMaster: { blendShapeGroups: [{ presetName: "Joy", ...bind }, { presetName: "angry", ...bind }] } } });
	const c = loadCharacter(dir);
	const r = await checkCharacter(c, [], keys, true);
	done(c);
	const faces = r.warnings.find((w) => w.includes("expression")) ?? "";
	assert.match(faces, /happy/);
	assert.doesNotMatch(faces, /angry/);
});

test("the director only notes tags and intense emotions outside its own emotions", () => {
	const r = directorCheck({ config: { ...director, intense: ["furious"], tags: { mad: "furious" } }, body });
	assert.deepEqual(r.errors, []);
	assert.match(r.warnings!.join("\n"), /intense/);
	assert.match(r.warnings!.join("\n"), /tags/);
});

test("a profile name that isn't a plain name is refused", () => {
	const dir = tempDir();
	writeFileSync(path.join(dir, "character.yaml"), readFileSync(path.join(FOXGLOVE, "character.yaml"), "utf8").replace("profile: foxglove", "profile: ../../x"));
	writeFileSync(path.join(dir, "system.md"), "You are a test.");
	assert.throws(() => loadCharacter(dir), /rig\.profile/);
});

test("a check that returns a list, a string or a number is its error", async () => {
	const c = loadCharacter(FOXGLOVE);
	for (const out of [["x"], "oops", 42]) {
		const odd = { ...c.extensions[0], name: "odd", call: () => undefined, check: () => out as never };
		const r = await checkCharacter(c, [odd], { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
		assert.match(r.errors.join(), /odd: its check returned/, JSON.stringify(out));
	}
});

test("a check that throws something unprintable, or floods messages, is reported, not a crash", async () => {
	const c = loadCharacter(FOXGLOVE);
	const ext = (check: () => unknown) => ({ ...c.extensions[0], name: "odd", call: () => undefined, check: check as never });
	const thrown = await checkCharacter(c, [ext(() => { throw Object.create(null); })], { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.match(thrown.errors.join(), /odd: its check failed/);
	const flood = await checkCharacter(c, [ext(() => ({ warnings: Array(500_000).fill("w") }))], { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.ok(flood.warnings.length <= 201);
});

test("a key left empty in YAML is the same as left out", () => {
	assert.deepEqual(directorCheck({ config: { ...director, registers: null as never, cameras: null as never }, body }).errors, []);
	assert.equal(tagsCheck({ config: { tags: null }, body }), undefined);
});

test("a profile this checkout doesn't have is a warning, and its words aren't judged", async () => {
	const dir = tempDir();
	writeFileSync(path.join(dir, "world.yaml"), readFileSync(path.join(FOXGLOVE, "world.yaml")));
	writeFileSync(path.join(dir, "reactions.yaml"), readFileSync(path.join(FOXGLOVE, "reactions.yaml")));
	writeFileSync(path.join(dir, "character.yaml"), readFileSync(path.join(FOXGLOVE, "character.yaml"), "utf8").replace("profile: foxglove", "profile: elsewhere").replace(/path: \.\.\/\.\.\/extensions/g, `path: ${path.resolve(FOXGLOVE, "../../extensions")}`).replace("config_file: director.yaml", `config_file: ${path.join(FOXGLOVE, "director.yaml")}`).replace("config_file: director.yaml", `config_file: ${path.join(FOXGLOVE, "director.yaml")}`));
	writeFileSync(path.join(dir, "system.md"), "You are a test.");
	const c = loadCharacter(dir);
	const r = await checkCharacter(c, await loadExtensions(c.extensions), { OPENAI_API_KEY: "x", ELEVENLABS_API_KEY: "x" }, true);
	assert.deepEqual(r.errors, []);
	assert.deepEqual(r.warnings.length, 1);
	assert.match(r.warnings[0], /rig\.profile/);
});

test("control characters in what's printed are shown as codes", () => {
	assert.equal(printable("wave\u001b[2J\u0007"), "wave\\x1b[2J\\x07");
	assert.equal(printable("Fox\n  ✓ keys: forged"), "Fox\\x0a  ✓ keys: forged");
});

test("a VRM 0.x preset name that isn't a string doesn't crash the check", async () => {
	const dir = modelCharacter("{}");
	modelFile(dir, { VRM: { humanoid: { humanBones: [] }, blendShapeMaster: { blendShapeGroups: [{ presetName: { toString: 1 }, binds: [{}] }] } } });
	const c = loadCharacter(dir);
	const r = await checkCharacter(c, [], keys, true);
	done(c);
	assert.deepEqual(r.errors, []);
});

// a character with one extension whose extension.yaml asks for `requires`
function withExtension(requires: string, config: string): string {
	const dir = tempDir();
	const ext = path.join(dir, "ext");
	mkdirSync(ext);
	writeFileSync(path.join(ext, "extension.yaml"), `name: ext\nhandler: index.ts\nhooks: [on_sentence]\nrequires_env: ${requires}\n`);
	writeFileSync(path.join(ext, "index.ts"), "export default () => {};\n");
	const manifest = readFileSync(path.join(FOXGLOVE, "character.yaml"), "utf8").replace(/extensions:[\s\S]*?\nenv_file/, `extensions:\n  - path: ext\n    config: ${config}\nenv_file`);
	writeFileSync(path.join(dir, "character.yaml"), manifest);
	writeFileSync(path.join(dir, "system.md"), "You are a test.");
	return dir;
}

test("an extension can ask for the key its config names", () => {
	const c = loadCharacter(withExtension("[OTHER_KEY, { config: model.api_key_env }]", "{ model: { api_key_env: ANTHROPIC_API_KEY } }"));
	assert.deepEqual(c.extensions[0].requires_env, ["OTHER_KEY", "ANTHROPIC_API_KEY"]);
	assert.ok(requiredKeys(c).includes("ANTHROPIC_API_KEY"));
});

test("a key named by a config that doesn't have it, or an odd requires_env entry, is refused", () => {
	assert.throws(() => loadCharacter(withExtension("[{ config: model.api_key_env }]", "{ model: {} }")), /model\.api_key_env/);
	assert.throws(() => loadCharacter(withExtension("[{ config: __proto__.x }]", "{}")), /__proto__\.x/);
	assert.throws(() => loadCharacter(withExtension("[42]", "{}")), /requires_env\[0\]/);
	assert.throws(() => loadCharacter(withExtension("[{ config: model.api_key_env }]", "{ model: { api_key_env: 42 } }")), /must be a key's name/);
	assert.throws(() => loadCharacter(withExtension("[{ config: model.api_key_env }]", '{ model: { api_key_env: "__proto__" } }')), /must be a key's name/);
});
