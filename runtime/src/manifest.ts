// Reads a character's character.yaml and the extension.yaml of every extension
// it lists. docs/character-manifest.md and docs/extensions.md are the contract.
// Anything missing or misspelt fails here, at startup, with the key's full name,
// rather than as a confusing error halfway through a call.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { HOOKS } from "./state.ts";
import type { HookName } from "./state.ts";

export type ChatApi = "chat_completions" | "responses";

export interface ChatModel {
	api: ChatApi;
	base_url: string;
	api_key_env: string;
	model: string;
	params: { temperature?: number; max_tokens?: number; reasoning_effort?: string };
}

export interface Stt {
	provider: "elevenlabs";
	model: string;
	language?: string;
	keyterms: string[];
}

export interface Voice {
	provider: "elevenlabs";
	voice_id: string;
	model: string;
	params: Record<string, unknown>;
}

export interface HookOptions {
	blocking: boolean;
	timeout_ms: number;
}

export interface Extension {
	name: string;
	dir: string;
	handler: string; // a file in `dir`, or an http(s) URL
	hooks: Map<HookName, HookOptions>;
	requires_env: string[];
	config: unknown;
}

export interface Character {
	dir: string;
	id: string;
	name: string;
	prompt: string; // the file's text, read once at startup
	chat: ChatModel;
	stt: Stt;
	voice: Voice;
	extensions: Extension[];
	env_file: string; // absolute
	manifest: Record<string, unknown>; // as written, for `state.character`
}

export const DEFAULT_TIMEOUT_MS = 5000;

// The one key name the ElevenLabs speech-to-text and voice use.
export const ELEVENLABS_KEY = "ELEVENLABS_API_KEY";

type Obj = Record<string, unknown>;

class ManifestError extends Error {}

function isObj(v: unknown): v is Obj {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readYaml(file: string): Obj {
	if (!existsSync(file)) throw new ManifestError(`${file} does not exist`);
	const doc: unknown = parse(readFileSync(file, "utf8"));
	if (!isObj(doc)) throw new ManifestError(`${file} is not a YAML mapping`);
	return doc;
}

// One key, read from `obj`, named in errors by its full path in `file`.
function field(file: string, obj: Obj, at: string, key: string) {
	const name = at ? `${at}.${key}` : key;
	const v = obj[key];
	const fail = (what: string): never => {
		throw new ManifestError(`${file}: \`${name}\` ${what}`);
	};
	return {
		str(): string {
			if (typeof v !== "string" || !v.trim()) fail(v === undefined ? "is required" : "must be a non-empty string");
			return (v as string).trim();
		},
		optStr(): string | undefined {
			return v === undefined ? undefined : this.str();
		},
		optNum(): number | undefined {
			if (v === undefined) return undefined;
			if (typeof v !== "number" || !Number.isFinite(v)) fail("must be a number");
			return v as number;
		},
		optBool(): boolean | undefined {
			if (v === undefined) return undefined;
			if (typeof v !== "boolean") fail("must be true or false");
			return v as boolean;
		},
		obj(): Obj {
			if (!isObj(v)) fail(v === undefined ? "is required" : "must be a mapping");
			return v as Obj;
		},
		optObj(): Obj {
			if (v === undefined || v === null) return {};
			if (!isObj(v)) fail("must be a mapping");
			return v as Obj;
		},
		strList(): string[] {
			if (v === undefined || v === null) return [];
			if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !x.trim())) fail("must be a list of strings");
			return (v as string[]).map((x) => x.trim());
		},
		list(): unknown[] {
			if (v === undefined || v === null) return [];
			if (!Array.isArray(v)) fail("must be a list");
			return v as unknown[];
		},
		oneOf<T extends string>(allowed: readonly T[]): T {
			const s = this.str();
			if (!allowed.includes(s as T)) fail(`must be one of ${allowed.join(", ")}`);
			return s as T;
		},
	};
}

function readChat(file: string, models: Obj): ChatModel {
	const chat = field(file, models, "models", "chat").obj();
	const f = (k: string) => field(file, chat, "models.chat", k);
	const params = f("params").optObj();
	const p = (k: string) => field(file, params, "models.chat.params", k);
	const api = f("api").oneOf(["chat_completions", "responses"] as const);
	return {
		api,
		base_url: f("base_url").str().replace(/\/+$/, ""),
		api_key_env: f("api_key_env").str(),
		model: f("model").str(),
		params: {
			temperature: p("temperature").optNum(),
			max_tokens: p("max_tokens").optNum(),
			reasoning_effort: p("reasoning_effort").optStr(),
		},
	};
}

function readHooks(file: string, ext: Obj): Map<HookName, HookOptions> {
	const raw = ext.hooks;
	const hooks = new Map<HookName, HookOptions>();
	const check = (name: unknown): HookName => {
		if (typeof name !== "string" || !HOOKS.includes(name as HookName))
			throw new ManifestError(`${file}: \`hooks\` has unknown hook "${String(name)}"; hooks are ${HOOKS.join(", ")}`);
		return name as HookName;
	};
	if (Array.isArray(raw)) {
		for (const name of raw) hooks.set(check(name), { blocking: true, timeout_ms: DEFAULT_TIMEOUT_MS });
	} else if (isObj(raw)) {
		for (const [name, opts] of Object.entries(raw)) {
			const hook = check(name);
			const o = opts === null || opts === undefined ? {} : opts;
			if (!isObj(o)) throw new ManifestError(`${file}: \`hooks.${hook}\` must be a mapping`);
			const at = `hooks.${hook}`;
			const blocking = field(file, o, at, "blocking").optBool() ?? true;
			const timeout = field(file, o, at, "timeout_ms").optNum();
			if (timeout !== undefined && !blocking)
				throw new ManifestError(`${file}: \`${at}.timeout_ms\` only applies to blocking hooks`);
			if (timeout !== undefined && timeout <= 0)
				throw new ManifestError(`${file}: \`${at}.timeout_ms\` must be above 0`);
			hooks.set(hook, { blocking, timeout_ms: timeout ?? DEFAULT_TIMEOUT_MS });
		}
	} else {
		throw new ManifestError(`${file}: \`hooks\` is required, as a list of hook names or a map of hook name to options`);
	}
	if (!hooks.size) throw new ManifestError(`${file}: \`hooks\` names no hook`);
	return hooks;
}

function readExtension(characterFile: string, characterDir: string, entry: unknown, i: number): Extension {
	if (!isObj(entry)) throw new ManifestError(`${characterFile}: \`extensions[${i}]\` must be a mapping`);
	const at = `extensions[${i}]`;
	const dir = path.resolve(characterDir, field(characterFile, entry, at, "path").str());
	const file = path.join(dir, "extension.yaml");
	const ext = readYaml(file);
	const f = (k: string) => field(file, ext, "", k);
	const handler = f("handler").str();
	if (!/^https?:\/\//.test(handler) && !existsSync(path.join(dir, handler)))
		throw new ManifestError(`${file}: \`handler\` ${handler} does not exist in ${dir}`);
	// config can live in its own file next to the character; inline keys win
	const configFile = field(characterFile, entry, at, "config_file").optStr();
	const fromFile = configFile ? readYaml(path.resolve(characterDir, configFile)) : {};
	const inline = field(characterFile, entry, at, "config").optObj();
	return {
		name: f("name").str(),
		dir,
		handler,
		hooks: readHooks(file, ext),
		requires_env: f("requires_env").strList(),
		config: { ...fromFile, ...inline },
	};
}

export function loadCharacter(dir: string): Character {
	const file = path.join(dir, "character.yaml");
	const m = readYaml(file);
	const f = (k: string) => field(file, m, "", k);

	if (f("schema").optNum() !== 1) throw new ManifestError(`${file}: \`schema\` must be 1`);
	// Required by the manifest contract even where the runtime does not read
	// them: the app does, and a manifest missing them is not a whole character.
	for (const k of ["description", "author", "license", "emotions"]) f(k).str();
	const rig = f("rig").obj();
	field(file, rig, "rig", "profile").str();
	field(file, rig, "rig", "engine").str();

	const promptFile = path.resolve(dir, f("prompt").str());
	if (!existsSync(promptFile)) throw new ManifestError(`${file}: \`prompt\` ${promptFile} does not exist`);

	const stt = f("stt").obj();
	const s = (k: string) => field(file, stt, "stt", k);
	const voice = f("voice").obj();
	const v = (k: string) => field(file, voice, "voice", k);

	const extensions = f("extensions").list().map((e, i) => readExtension(file, dir, e, i));
	const names = new Set<string>();
	for (const e of extensions) {
		if (names.has(e.name)) throw new ManifestError(`${file}: two extensions are named "${e.name}"`);
		names.add(e.name);
	}

	return {
		dir,
		id: f("id").str(),
		name: f("name").str(),
		prompt: readFileSync(promptFile, "utf8").trim(),
		chat: readChat(file, f("models").obj()),
		stt: {
			provider: s("provider").oneOf(["elevenlabs"] as const),
			model: s("model").str(),
			language: s("language").optStr(),
			keyterms: s("keyterms").strList(),
		},
		voice: {
			provider: v("provider").oneOf(["elevenlabs"] as const),
			voice_id: v("voice_id").str(),
			model: v("model").str(),
			params: v("params").optObj(),
		},
		extensions,
		env_file: path.resolve(dir, f("env_file").str()),
		manifest: m,
	};
}

// Every key the character needs from .env: its chat model's, the ElevenLabs
// one, and each extension's.
export function requiredKeys(c: Character): string[] {
	return [...new Set([c.chat.api_key_env, ELEVENLABS_KEY, ...c.extensions.flatMap((e) => e.requires_env)])];
}

export { ManifestError };
