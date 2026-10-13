// Loads each extension's handler and runs a hook through the character's
// extensions, in the order the character lists them. docs/extensions.md is
// the contract:
//
//   in:  { event, state, config }      out: { state }, or nothing for "no change"
//
// A module handler is a file whose default export is that function, sync or
// async. An HTTP handler gets the same object as a JSON POST and answers the
// same way. Keys come from .env, which the runtime loads into process.env.

import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Extension } from "./manifest.ts";
import type { HookName, State } from "./state.ts";

export interface HookInput {
	event: HookName;
	state: State;
	config: unknown;
}
type HookOutput = { state?: State } | null | undefined | void;
type Handler = (input: HookInput) => HookOutput | Promise<HookOutput>;

export interface Loaded extends Extension {
	call: Handler;
}

class TimedOut extends Error {}

function httpHandler(url: string): Handler {
	return async (input) => {
		const resp = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const text = await resp.text();
		return text.trim() ? (JSON.parse(text) as HookOutput) : undefined;
	};
}

export async function loadExtensions(exts: Extension[]): Promise<Loaded[]> {
	const out: Loaded[] = [];
	for (const e of exts) {
		if (/^https?:\/\//.test(e.handler)) {
			out.push({ ...e, call: httpHandler(e.handler) });
			continue;
		}
		const file = path.join(e.dir, e.handler);
		const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
		if (typeof mod.default !== "function")
			throw new Error(`${file}: the extension's handler must export a default function`);
		out.push({ ...e, call: mod.default as Handler });
	}
	return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	return Promise.race([
		p,
		new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TimedOut()), ms); }),
	]).finally(() => clearTimeout(timer));
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Runs `hook` through every extension that declared it and returns the state
// the last blocking one handed on. A blocking extension that throws or runs out
// of time is logged and skipped, its changes dropped. A non-blocking one gets a
// copy and is not waited on; what it returns is dropped.
//
// `step`, when given, sees each blocking extension's output as soon as it
// returns and hands on what the next one sees.
export async function runHook(
	exts: Loaded[],
	hook: HookName,
	state: State,
	log: (line: string) => void,
	step?: (s: State) => State,
): Promise<State> {
	for (const e of exts) {
		const opts = e.hooks.get(hook);
		if (!opts) continue;
		// every extension gets its own copy, so one still running after its
		// timeout cannot change what the next one sees. Copying throws on state
		// an earlier extension filled with something that can't be copied.
		const input = () => ({ event: hook, state: structuredClone(state), config: e.config }) satisfies HookInput;
		if (!opts.blocking) {
			Promise.resolve()
				.then(() => e.call(input()))
				.catch((err) => log(`[ext] ${e.name} ${hook} (non-blocking) failed: ${errorText(err)}`));
			continue;
		}
		try {
			const out = await withTimeout(Promise.resolve().then(() => e.call(input())), opts.timeout_ms);
			if (out && typeof out === "object" && out.state && typeof out.state === "object") {
				// what the next extension and the session get must be copyable
				structuredClone(out.state);
				state = out.state;
			}
			if (step) state = step(state);
		} catch (err) {
			log(
				err instanceof TimedOut
					? `[ext] ${e.name} ${hook} timed out after ${opts.timeout_ms}ms; its changes were dropped`
					: `[ext] ${e.name} ${hook} failed: ${errorText(err)}; its changes were dropped`,
			);
		}
	}
	return state;
}

// True when at least one extension runs on `hook`.
export function hasHook(exts: Loaded[], hook: HookName): boolean {
	return exts.some((e) => e.hooks.has(hook));
}
