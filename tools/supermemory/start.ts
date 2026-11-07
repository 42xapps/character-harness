// Keep the dedicated local memory services running after the iPhone launcher exits.
import { spawn } from "node:child_process";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

const envFile = path.resolve(process.argv[2] ?? ".cache/supermemory-tuned/.env");
if (!existsSync(envFile)) throw new Error("Create the qualified memory service .env first; see extensions/supermemory/README.md");
const readConfig = () => parseEnv(readFileSync(envFile, "utf8"));
const c = readConfig();
const port = Number(c.SUPERMEMORY_PORT ?? 6779);
const gatewayPort = Number(c.SUPERMEMORY_OLLAMA_GATEWAY_PORT ?? 6780);
for (const value of [port, gatewayPort]) if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error("Invalid memory service port");
if (port === gatewayPort || c.OPENAI_BASE_URL !== `http://127.0.0.1:${gatewayPort}/v1` || !c.OPENAI_MODEL) throw new Error("Expected the qualified loopback memory gateway configuration");
const dir = path.dirname(envFile);
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(envFile, 0o600);
const env: Record<string, string> = {};
for (const key of ["HOME", "PATH", "TMPDIR", "USER", "LANG"]) if (process.env[key]) env[key] = process.env[key]!;
async function fetchLocal(url: string, apiKey?: string) {
	try { return await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "error", headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {} }); }
	catch (error) {
		if ((error as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED") return undefined;
		throw new Error("Could not verify the local memory listener; inspect its private logs");
	}
}
async function object(response: Response): Promise<Record<string, unknown>> {
	const value = await response.json();
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unexpected local service response");
	return value as Record<string, unknown>;
}
function start(script: string, logName: string) {
	const file = path.join(dir, logName);
	const log = openSync(file, "a", 0o600);
	chmodSync(file, 0o600);
	try {
		const child = spawn(process.execPath, [path.resolve(script), envFile], { cwd: path.resolve("."), detached: true, env, stdio: ["ignore", log, log] });
		child.unref();
		return child.pid;
	} finally { closeSync(log); }
}
async function ready(check: () => Promise<boolean>) {
	const deadline = Date.now() + 45000;
	do { if (await check()) return; await new Promise((r) => setTimeout(r, 500)); } while (Date.now() < deadline);
	throw new Error("Local memory service did not become ready; inspect its private logs");
}
const gatewayUrl = `http://127.0.0.1:${gatewayPort}/health`;
const gateway = await fetchLocal(gatewayUrl);
if (gateway && (!gateway.ok || (await object(gateway)).model !== c.OPENAI_MODEL)) throw new Error("Another listener owns the gateway port; left untouched");
const gatewayPid = gateway ? undefined : start("tools/supermemory/ollama.ts", "ollama.log");
await ready(async () => { const r = await fetchLocal(gatewayUrl); return !!r?.ok && (await object(r)).model === c.OPENAI_MODEL; });
const engineUrl = `http://127.0.0.1:${port}/ns/harness_readiness_probe`;
const engine = await fetchLocal(engineUrl, readConfig().SUPERMEMORY_API_KEY);
if (engine && (engine.status !== 404 || (await object(engine)).error !== "Namespace not found")) throw new Error("Memory engine authentication/identity did not match; left untouched");
const enginePid = engine ? undefined : start("tools/supermemory/local.ts", "server.log");
await ready(async () => {
	const key = readConfig().SUPERMEMORY_API_KEY;
	if (!key) return false;
	const r = await fetchLocal(engineUrl, key);
	return r?.status === 404 && (await object(r)).error === "Namespace not found";
});
writeFileSync(path.join(dir, "services.json"), JSON.stringify({ date: new Date().toISOString(), port, gatewayPort, model: c.OPENAI_MODEL, gatewayPid, engineLauncherPid: enginePid }, null, 2) + "\n", { mode: 0o600 });
console.log(`Local memory is ready on loopback port ${port}; Ollama gateway ${gatewayPort}. Services stay running.`);
