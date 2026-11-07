// Trusted local operator interface. Never expose this command as an unauthenticated API.
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import path from "node:path";
import { config, credentials } from "../../extensions/supermemory/config.ts";
import { Provider } from "../../extensions/supermemory/provider.ts";
import { Store } from "../../extensions/supermemory/store.ts";
import { MemoryService } from "../../extensions/supermemory/service.ts";
import { localPrincipal } from "../../runtime/src/principal.ts";
import { SupermemoryError } from "supermemory";

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const command = args[0];
if (!command || !["status", "inspect", "profile", "pause", "resume", "preview-forget", "forget", "correct", "delete-all", "remember", "drain", "quarantined", "reconcile"].includes(command)) {
	console.error("Usage: control.ts <status|inspect|profile|pause|resume|preview-forget|forget|correct|delete-all|remember|drain> --config <yaml> --env <.env> [--text-file <file>] [--preview-file <file>] [--allow-clear-all]");
	process.exit(1);
}
process.loadEnvFile(path.resolve(option("--env", ".env")!));
const c = config(parse(readFileSync(path.resolve(option("--config", "characters/foxglove/memory.yaml")!), "utf8")));
const p = localPrincipal(process.env);
if (!p) throw new Error("Configure explicit local identity in .env; hosted management requires an authenticated backend");
const { apiKey, encryptionKey } = credentials(c);
const service = new MemoryService(c, new Store(c.dir, encryptionKey), new Provider(c, apiKey), false);
const readText = () => readFileSync(path.resolve(option("--text-file") ?? "missing-text-file"), "utf8").trim();
try {
	let result: unknown;
	if (command === "status") result = service.status(p);
	if (command === "quarantined") result = service.quarantined(p);
	if (command === "reconcile") {
		if (!option("--event") || !["retain", "discard"].includes(option("--decision") ?? "")) throw new Error("Reconciliation requires --event <id> --decision retain|discard");
		service.reconcile(p, option("--event")!, option("--decision") === "retain"); result = { reconciled: true };
	}
	if (command === "inspect") result = await service.list(p, Number(option("--page", "1")));
	if (command === "profile") result = await service.getProfile(p);
	if (command === "pause" || command === "resume") { service.pause(p, command === "pause"); result = { paused: command === "pause" }; }
	if (command === "preview-forget") {
		result = await service.previewForget(p, readText());
		const file = option("--preview-file");
		if (file) writeFileSync(path.resolve(file), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
	}
	if (command === "forget" || command === "correct") {
		const preview = JSON.parse(readFileSync(path.resolve(option("--preview-file") ?? "missing-preview-file"), "utf8")) as { token: string };
		result = command === "correct" ? await service.correct(p, preview.token, readText(), args.includes("--allow-clear-all")) : await service.forget(p, preview.token, args.includes("--allow-clear-all"));
	}
	if (command === "delete-all") result = service.deleteRelationship(p);
	if (command === "remember") result = { event: service.remember(p, readText()), status: "durably queued; not yet learned" };
	if (command === "drain") {
		const until = Date.now() + 30000;
		do {
			await service.pump();
			const status = service.status(p);
			if (!status.erasures && !status.jobs.some((j) => j.state === "pending" || j.state === "accepted")) break;
			await new Promise((r) => setTimeout(r, 1000));
		} while (Date.now() < until);
		result = service.status(p);
	}
	console.log(JSON.stringify(result, null, 2));
} catch (e) {
	console.error(e instanceof SupermemoryError ? `Memory API unavailable (HTTP ${e.statusCode ?? "unknown"})` : e instanceof Error ? e.message : "Memory operation failed");
	process.exitCode = 1;
} finally { await service.close(); }
