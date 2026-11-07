// Starts an isolated local engine; never sources the installer's shared credentials.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

const envFile = path.resolve(process.argv[2] ?? ".cache/supermemory-local/.env");
mkdirSync(path.dirname(envFile), { recursive: true, mode: 0o700 });
if (!existsSync(envFile)) writeFileSync(envFile, [
	"OPENAI_API_KEY=ollama", "OPENAI_BASE_URL=http://127.0.0.1:6780/v1",
	"OPENAI_MODEL=kloey-memory-gemma4:12b", "OPENAI_FAST_MODEL=kloey-memory-gemma4:12b", "OPENAI_TEXT_MODEL=kloey-memory-gemma4:12b",
	"SUPERMEMORY_EMBEDDING_PROVIDER=local", "SUPERMEMORY_EMBEDDING_MODEL=Xenova/bge-base-en-v1.5",
	"SUPERMEMORY_EMBEDDING_DIMENSIONS=768", "SUPERMEMORY_INGEST_CONCURRENCY=1",
	"SUPERMEMORY_HOST=127.0.0.1", "SUPERMEMORY_PORT=6779", "SUPERMEMORY_DISABLE_TELEMETRY=1",
	"SUPERMEMORY_NO_UPDATE_CHECK=1", "",
].join("\n"), { mode: 0o600 });
chmodSync(envFile, 0o600);
const config = parseEnv(readFileSync(envFile, "utf8"));
const dataDir = path.join(path.dirname(envFile), "data");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const env: Record<string, string> = {};
for (const key of ["HOME", "PATH", "TMPDIR", "USER", "LANG"]) if (process.env[key]) env[key] = process.env[key]!;
Object.assign(env, config, { SUPERMEMORY_DATA_DIR: dataDir });
// Bypass the wrapper which sources ~/.supermemory/env.
const binary = process.env.SUPERMEMORY_BINARY ?? path.join(process.env.HOME!, ".supermemory/bin/supermemory-server");
const child = spawn(binary, [], { env, stdio: ["ignore", "pipe", "pipe"] });
if (child.pid) writeFileSync(path.join(path.dirname(envFile), "server.pid"), String(child.pid), { mode: 0o600 });
let buffer = "";
function line(text: string) {
	const key = text.match(/\bsm_[A-Za-z0-9_-]+/)?.[0];
	if (key && /api.?key/i.test(text)) {
		const content = readFileSync(envFile, "utf8").replace(/^SUPERMEMORY_API_KEY=.*\n?/m, "");
		writeFileSync(envFile, `${content.trimEnd()}\nSUPERMEMORY_API_KEY=${key}\n`, { mode: 0o600 });
	}
	process.stdout.write(text.replace(/\b(?:sm_|sk-)[A-Za-z0-9_-]+/g, "[redacted]") + "\n");
}
for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk: Buffer) => {
	buffer += chunk.toString();
	const lines = buffer.split("\n");
	buffer = lines.pop()!;
	for (const text of lines) line(text);
});
child.on("error", () => { console.error("Could not launch Supermemory; check SUPERMEMORY_BINARY."); process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { if (buffer) line(buffer); process.exitCode = code ?? 1; });
