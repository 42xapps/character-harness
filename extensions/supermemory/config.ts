import path from "node:path";

export interface Config {
	enabled: boolean;
	qualified: boolean;
	log_events: boolean;
	source_rebuild_qualified: boolean;
	base_url: string;
	api_key_env: string;
	encryption_key_env: string;
	dir: string;
	recall_ms: number;
	prompt_tokens: number;
	max_pending: number;
	supporting_context: string;
	buckets: Record<string, string>;
}
const defaults: Config = {
	enabled: false, qualified: false, log_events: false, source_rebuild_qualified: false, base_url: "http://127.0.0.1:6779",
	api_key_env: "SUPERMEMORY_API_KEY", encryption_key_env: "SUPERMEMORY_JOURNAL_KEY",
	dir: ".cache/supermemory", recall_ms: 300, prompt_tokens: 1500, max_pending: 1000,
	supporting_context: "", buckets: {},
};
export function config(raw: unknown): Config {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("supermemory config must be a mapping");
	const c = { ...defaults, ...raw } as Config;
	for (const key of Object.keys(raw)) if (!(key in defaults)) throw new Error(`Unknown supermemory setting: ${key}`);
	if ([c.enabled, c.qualified, c.log_events, c.source_rebuild_qualified].some((v) => typeof v !== "boolean")) throw new Error("Memory qualification, logging and enablement flags must be booleans");
	let url: URL;
	try { url = new URL(c.base_url); } catch { throw new Error("Invalid memory base_url"); }
	if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
		(url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))))
		throw new Error("Memory endpoint requires HTTPS or loopback HTTP and no credentials/query/path");
	for (const key of [c.api_key_env, c.encryption_key_env]) if (typeof key !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error("Expected an environment variable name");
	if (typeof c.dir !== "string" || !c.dir.trim()) throw new Error("Expected a memory storage directory");
	if (!Number.isInteger(c.recall_ms) || c.recall_ms < 10 || c.recall_ms > 1000) throw new Error("recall_ms must be 10..1000");
	if (!Number.isInteger(c.prompt_tokens) || c.prompt_tokens < 100 || c.prompt_tokens > 4000) throw new Error("prompt_tokens must be 100..4000");
	if (!Number.isInteger(c.max_pending) || c.max_pending < 1 || c.max_pending > 10000) throw new Error("max_pending must be 1..10000");
	if (typeof c.supporting_context !== "string" || c.supporting_context.length > 1500 || (c.enabled && !c.supporting_context.trim())) throw new Error("supporting_context is required when enabled; maximum 1500 characters");
	if (!c.buckets || typeof c.buckets !== "object" || Array.isArray(c.buckets) || Object.keys(c.buckets).length > 20 ||
		Object.entries(c.buckets).some(([k, v]) => !/^[a-z][a-z0-9_-]{0,63}$/.test(k) || typeof v !== "string" || !v.trim() || v.length > 1000)) throw new Error("Invalid profile bucket definitions");
	return { ...c, dir: path.resolve(c.dir) };
}
export function credentials(c: Config) {
	const apiKey = process.env[c.api_key_env];
	const encryptionKey = process.env[c.encryption_key_env];
	if (!apiKey) throw new Error(`Set ${c.api_key_env} in .env`);
	if (!encryptionKey || !/^[A-Za-z0-9+/]{43}=$/.test(encryptionKey) || Buffer.from(encryptionKey, "base64").length !== 32)
		throw new Error(`Set ${c.encryption_key_env} to a base64 32-byte key in .env`);
	return { apiKey, encryptionKey };
}
