// Local-only compatibility for Supermemory 0.0.9 and Ollama. No conversation logs.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";

type ModelRequest = { model?: unknown; messages?: { role?: string; content?: unknown }[]; response_format?: { type?: string }; [key: string]: unknown };

export function prepareMemoryRequest(input: unknown, model: string): ModelRequest {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected a model request");
	const body = structuredClone(input) as ModelRequest;
	if (body.model !== model || !Array.isArray(body.messages) || body.messages.length > 256) throw new Error("Unexpected model or message shape");
	// Bound memory inference effort without sending an unsupported value:
	// GPT-OSS requires low/medium/high; the qualified Gemma setup uses none.
	// This changes memory inference only, never the companion model.
	body.reasoning_effort = /(^|\/)gpt-oss(?::|$)/.test(model) ? "low" : "none";
	delete body.reasoning;
	const messages = body.messages;
	const text = messages.length === 1 && messages[0].role === "user" && typeof messages[0].content === "string" ? messages[0].content : "";
	const selection = text.startsWith("The user wants to forget memories about: ") && text.includes("\n\nCandidates:\n")
		? text.match(/\n\nBelow are (\d+) candidate memories, numbered 1 to (\d+)\./) : null;
	// This server version sends json_object without the schema it later validates.
	// Supply only its known selection contract, never infer/repair model answers.
	if (body.response_format?.type === "json_object" && selection && selection[1] === selection[2]) {
		const count = Number(selection[1]);
		if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error("Invalid forget candidate count");
		const schema = { type: "object", properties: { forget: { type: "array", items: { type: "integer", minimum: 1, maximum: count }, uniqueItems: true } }, required: ["forget"], additionalProperties: false };
		body.response_format = { type: "json_schema", json_schema: { name: "forget_selection", strict: true, schema } } as ModelRequest["response_format"];
		body.messages = [{ role: "system", content: `Return only a JSON object conforming exactly to this schema: ${JSON.stringify(schema)}. Use an empty forget array when no candidate matches.` }, ...messages];
	}
	return body;
}

async function main() {
	process.loadEnvFile(path.resolve(process.argv[2] ?? ".cache/supermemory-local/.env"));
	const model = process.env.OPENAI_MODEL;
	if (!model) throw new Error("Set OPENAI_MODEL in the memory service .env");
	const port = Number(process.env.SUPERMEMORY_OLLAMA_GATEWAY_PORT ?? 6780);
	if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid gateway port");
	const pending = new Set<AbortController>();
	const server = createServer(async (req, res) => {
		if (req.headers.origin) { res.writeHead(403).end(); return; }
		if (req.method === "GET" && req.url === "/health") {
			res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ready", model, active: pending.size })); return;
		}
		if (req.method !== "POST" || req.url !== "/v1/chat/completions") { res.writeHead(404).end(); return; }
		if (pending.size >= 4) { res.writeHead(429).end(); return; }
		const controller = new AbortController();
		pending.add(controller);
		const deadline = setTimeout(() => controller.abort(), 240000);
		res.on("close", () => { if (!res.writableEnded) controller.abort(); });
		let badRequest = true;
		try {
			const parts: Buffer[] = [];
			let bytes = 0;
			for await (const part of req) {
				bytes += part.length;
				if (bytes > 4 * 1024 * 1024) { res.writeHead(413).end(); return; }
				parts.push(part);
			}
			const body = prepareMemoryRequest(JSON.parse(Buffer.concat(parts).toString()), model);
			if (body.stream === true) throw new Error("Memory gateway requires non-streaming requests");
			badRequest = false;
			// Fixed loopback target; never forward provider keys, redirects or cookies.
			const response = await fetch("http://127.0.0.1:11434/v1/chat/completions", { method: "POST", redirect: "error",
				headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
			const reader = response.body?.getReader();
			const output: Uint8Array[] = [];
			bytes = 0;
			if (reader) try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					bytes += value.length;
					if (bytes > 4 * 1024 * 1024) throw new Error("Local model response too large");
					output.push(value);
				}
			} catch (e) { await reader.cancel().catch(() => {}); throw e; }
			res.writeHead(response.status, { "content-type": "application/json" }).end(Buffer.concat(output));
		} catch {
			if (!res.headersSent && !res.destroyed) res.writeHead(badRequest ? 400 : 502, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: badRequest ? "Invalid memory inference request" : "Local memory inference unavailable" } }));
		} finally { clearTimeout(deadline); pending.delete(controller); }
	});
	server.requestTimeout = 245000;
	server.headersTimeout = 10000;
	server.on("error", () => { console.error("Cannot start local memory gateway; check its port."); process.exitCode = 1; });
	server.listen(port, "127.0.0.1", () => console.log(`Local memory inference on loopback port ${port}; model ${model}`));
	for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
		for (const c of pending) c.abort();
		server.close();
		server.closeAllConnections();
	});
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
