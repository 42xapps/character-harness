// Synthetic-only engine probe. Reports contain no credentials or real conversations.
import { Supermemory } from "supermemory";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

process.loadEnvFile(path.resolve(process.argv[2] ?? ".cache/supermemory-qualification/.env"));
const baseUrl = `http://127.0.0.1:${process.env.SUPERMEMORY_PORT ?? "6779"}`;
const client = new Supermemory({ baseUrl, apiKey: process.env.SUPERMEMORY_API_KEY!, maxRetries: 0, timeoutInSeconds: 10 });
const namespace = `qualification_${randomUUID().replaceAll("-", "")}`;
const report: Record<string, unknown> = {
	date: new Date().toISOString(), server: "0.0.9", sdk: "5.0.2", model: process.env.OPENAI_MODEL,
	embeddings: { model: process.env.SUPERMEMORY_EMBEDDING_MODEL, dimensions: process.env.SUPERMEMORY_EMBEDDING_DIMENSIONS },
	namespace, syntheticOnly: true, tests: [], qualified: false,
};
const tests = report.tests as { name: string; passed: boolean; elapsedMs: number; detail?: unknown }[];
async function probe(name: string, fn: () => Promise<unknown>) {
	const start = performance.now();
	try { const detail = await fn(); tests.push({ name, passed: true, elapsedMs: performance.now() - start, detail }); }
	catch (e) {
		const status = (e as { statusCode?: number }).statusCode;
		const code = e instanceof Error && /^(processing_failed|processing_timeout|empty_recall)$/.test(e.message) ? e.message : undefined;
		tests.push({ name, passed: false, elapsedMs: performance.now() - start, detail: { error: e instanceof Error ? e.name : "Error", status, code } });
	}
	console.log(`${name}: ${tests.at(-1)!.passed ? "pass" : "FAIL"}`);
}
let docId = "qualification_initial";
await probe("ingest_instant", async () => {
	const doc = await client.add(namespace, {
		id: docId, content: "User: My name is Avery. I work at Cedar Labs. My sister's name is Mira. I prefer jasmine tea.\nAssistant (generated, playback unverified): Thanks for telling me.",
		supportingContext: "Personal companion conversation. Remember only what the user states about their real life. Assistant text is generated, not proof of real events.",
		taskType: "memory", dreaming: "instant", date: new Date().toISOString(), metadata: { source: "synthetic_qualification" },
	});
	docId = doc.id;
	return { accepted: true };
});
await probe("namespace_settings", () => client.namespaces.update(namespace, { supportingContext: "Avery is the human user; assistant suggestions are not user facts." }).then(() => true));
await probe("namespace_get", () => client.namespaces.get(namespace).then((r) => { if (r.namespace !== namespace) throw new Error("namespace_contract"); return true; }));
await probe("profile_buckets", () => client.profiles.setBuckets(namespace, { buckets: { goals: "User-stated goals", relationships: "User-stated personal relationships" } }).then(() => true));
await probe("processing_done", async () => {
	const deadline = Date.now() + 180_000;
	while (Date.now() < deadline) {
		const doc = await client.documents.get(namespace, docId);
		if (doc.system.status === "done") return { status: "done" };
		if (doc.system.status === "failed") throw new Error("processing_failed");
		await new Promise((r) => setTimeout(r, 2000));
	}
	throw new Error("processing_timeout");
});
for (const searchMode of ["chunks", "memories", "hybrid"] as const) await probe(`search_${searchMode}`, async () => {
	let result = await client.search(namespace, { query: "What tea does Avery prefer?", searchMode, include: { documents: true, related: true, forgotten: false } });
	const deadline = Date.now() + (searchMode === "memories" ? 180000 : 0);
	while (!result.results.length && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 3000));
		result = await client.search(namespace, { query: "What tea does Avery prefer?", searchMode, include: { documents: true, related: true, forgotten: false } });
	}
	if (!result.results.length) throw new Error("empty_recall");
	return { count: result.results.length, serverMs: result.searchTime, text: result.results.map((r) => r.memory ?? r.chunk).join(" ").slice(0, 1000) };
});
await probe("profile", async () => {
	const result = await client.profile(namespace);
	return { static: result.profile.static.length, dynamic: result.profile.dynamic.length, buckets: Object.keys(result.profile.buckets ?? {}) };
});
await probe("list", () => client.list(namespace, "memories", { limit: 10 }).then((r) => ({ count: r.memories.length })));
await probe("semantic_forget_preview", () => client.memories.forgetMatching(namespace, { query: "jasmine tea", dryRun: true }).then((r) => ({ count: r.count })));
// The remaining quality tests must be run only after this basic contract gate passes.
await probe("delete_namespace", async () => {
	const r = await client.namespaces.delete(namespace);
	if (r.status !== "deleted") { report.cleanupPendingNamespace = namespace; throw new Error("deletion_queued"); }
	return { status: r.status };
});
report.qualified = false;
report.reason = tests.every((t) => t.passed) ? "Basic API gate passed. Temporal/correction, deletion-resurrection, resource/egress, and corpus evaluation gates still required." : "Basic API or extraction gate failed; live memory must remain disabled.";
mkdirSync("docs/reports", { recursive: true });
writeFileSync("docs/reports/supermemory-qualification.json", JSON.stringify(report, null, 2) + "\n");
console.log(report.reason);
process.exitCode = tests.every((t) => t.passed) ? 0 : 1;
