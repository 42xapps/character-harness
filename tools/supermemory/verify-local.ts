// Synthetic live-engine and extension lifecycle checks. Not a hosted release certification.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseEnv } from "node:util";
import { parse } from "yaml";
import { Supermemory, SupermemoryError } from "supermemory";
import { config } from "../../extensions/supermemory/config.ts";
import { Provider } from "../../extensions/supermemory/provider.ts";
import { Store } from "../../extensions/supermemory/store.ts";
import { MemoryService } from "../../extensions/supermemory/service.ts";
import { renderMemory } from "../../extensions/supermemory/prompt.ts";

process.loadEnvFile(process.argv[2] ?? ".cache/supermemory-tuned/.env");
const baseUrl = `http://127.0.0.1:${process.env.SUPERMEMORY_PORT ?? 6779}`;
const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY!, baseUrl, timeoutInSeconds: 120, maxRetries: 0 });
const namespace = `verification_${randomUUID().replaceAll("-", "")}`;
const other = namespace + "_other";
const raw = parse(readFileSync("characters/foxglove/memory.yaml", "utf8"));
const tests: { name: string; passed: boolean; elapsedMs: number; detail?: unknown }[] = [];
async function check(name: string, fn: () => Promise<unknown>) {
	if (process.argv.includes("--lifecycle-only") && name !== "durable_extension_recall_across_reopened_sessions_and_deletion") return;
	if (process.argv.includes("--core-only") && name === "durable_extension_recall_across_reopened_sessions_and_deletion") return;
	const start = performance.now();
	try { const detail = await fn(); tests.push({ name, passed: true, elapsedMs: performance.now() - start, detail }); }
	catch (error) { tests.push({ name, passed: false, elapsedMs: performance.now() - start, detail: { error: error instanceof Error ? error.name : "Error", message: error instanceof Error && error.message.length < 150 ? error.message : undefined } }); }
	console.log(`${name}: ${tests.at(-1)!.passed ? "pass" : "FAIL"}`);
}
async function until(fn: () => Promise<boolean>, ms = 240000) {
	const deadline = Date.now() + ms;
	do { if (await fn()) return; await new Promise((r) => setTimeout(r, 2000)); } while (Date.now() < deadline);
	throw new Error("Synthetic learning deadline exceeded");
}
const search = (ns: string, query: string, searchMode: "hybrid" | "memories" = "memories") => client.search(ns, { query, searchMode, threshold: 0.2, limit: 30, rewriteQuery: false, rerank: "none", include: { documents: true, related: true, forgotten: false } });
let initial = "";
let correction = "";
let teaIds: string[] = [];
const initialContent = "User: My name is Avery. I work at Cedar Labs. My sister's name is Mira. I prefer jasmine tea. I actually live in Dublin. If I moved to Berlin I would learn German.\nAssistant (generated, playback unverified): You could join a pottery class.";
await check("namespace_settings_and_buckets", async () => {
	// Namespace settings operate on existing namespaces; ingestion creates one.
	const doc = await client.add(namespace, { id: "source_one", content: initialContent, taskType: "memory", dreaming: "instant", date: new Date(Date.now() - 86400000).toISOString(), supportingContext: raw.supporting_context });
	initial = doc.id;
	await client.namespaces.update(namespace, { supportingContext: raw.supporting_context });
	await client.profiles.setBuckets(namespace, { buckets: raw.buckets });
	return { buckets: Object.keys(raw.buckets).length };
});
await check("five_explicit_facts_and_source_processing", async () => {
	assert.ok(initial);
	await until(async () => {
		const state = await client.documents.get(namespace, initial);
		const list = await client.list(namespace, "memories", { limit: 50 });
		const text = list.memories.map((m) => m.memory).join(" ").toLowerCase();
		return state.system.status === "done" && ["avery", "cedar", "mira", "jasmine", "dublin"].every((v) => text.includes(v));
	});
	// Let the final tool step settle before subsequent destructive checks.
	await new Promise((r) => setTimeout(r, 5000));
	return { factsCovered: 5, documentStatus: (await client.documents.get(namespace, initial)).system };
});
await check("relevant_grounded_memory_and_hybrid_recall", async () => {
	for (const mode of ["memories", "hybrid"] as const) {
		const r = await search(namespace, "What tea does Avery prefer?", mode);
		assert.ok(r.results.some((m) => m.memory?.toLowerCase().includes("jasmine") && m.isLatest && !m.isInference && m.included?.document?.id));
		assert.ok(r.searchTime < 300);
	}
	return { recallDeadlineMs: 300 };
});
await check("profiles_contain_learned_preferences", async () => {
	const p = await client.profile(namespace, { buckets: Object.keys(raw.buckets) });
	assert.ok([...p.profile.static, ...p.profile.dynamic].some((m) => m.memory.toLowerCase().includes("jasmine")));
	return { static: p.profile.static.length, dynamic: p.profile.dynamic.length };
});
await check("hypothetical_and_assistant_suggestion_are_not_biography", async () => {
	const r = await client.list(namespace, "memories", { limit: 50 });
	const text = r.memories.map((m) => m.memory).join(" ").toLowerCase();
	assert.ok(!/\b(lives?|resides?) in berlin\b/.test(text));
	assert.ok(!/\b(joined|attends?|enrolled in) (a )?pottery/.test(text));
	return true;
});
await check("namespace_isolation", async () => {
	assert.equal((await search(other, "Avery jasmine tea Dublin", "hybrid")).results.length, 0);
	const p = await client.profile(other);
	assert.equal(p.profile.static.length + p.profile.dynamic.length, 0);
	return true;
});
await check("employment_correction_supersedes_previous_fact", async () => {
	const d = await client.add(namespace, { id: "source_two", taskType: "memory", dreaming: "instant", date: new Date().toISOString(), supportingContext: raw.supporting_context,
		content: "User: I left Cedar Labs yesterday. I now work at Willow Research. My current employer is Willow Research; I no longer work at Cedar Labs." });
	correction = d.id;
	await until(async () => {
		const d = await client.documents.get(namespace, correction);
		const r = await search(namespace, "Where does Avery currently work?");
		const current = r.results.filter((m) => m.isLatest && !m.isInference).map((m) => m.memory ?? "");
		return d.system.status === "done" && current.some((s) => /willow/i.test(s)) && !current.some((s) => /\bworks? (at|for) cedar/i.test(s) && !/\b(no longer|not|previously|formerly|used to)\b/i.test(s));
	});
	await new Promise((r) => setTimeout(r, 5000));
	return true;
});
await check("semantic_forget_preview_selects_only_target", async () => {
	const r = await client.memories.forgetMatching(namespace, { query: "jasmine tea preference", dryRun: true });
	assert.ok(r.count > 0);
	teaIds = r.matches.map((m) => m.id);
	for (const id of teaIds) assert.match((await client.memories.get(namespace, id)).memory, /jasmine/i);
	return { count: teaIds.length };
});
await check("exact_forget_removes_target_from_memory_search", async () => {
	assert.ok(teaIds.length > 0);
	const r = await client.memories.forget(namespace, { ids: teaIds });
	assert.equal(r.errors.length, 0);
	assert.equal(r.count, teaIds.length);
	for (const id of teaIds) assert.equal((await client.memories.get(namespace, id)).isForgotten, true);
	assert.ok(!(await search(namespace, "What tea does Avery prefer?")).results.some((m) => teaIds.includes(m.id)));
	return true;
});
await check("namespace_erasure_removes_memories_profiles_and_sources", async () => {
	assert.equal((await client.namespaces.delete(namespace)).status, "deleted");
	await new Promise((r) => setTimeout(r, 8000));
	for (const mode of ["memories", "hybrid"] as const) assert.equal((await search(namespace, "Avery Cedar Willow Mira jasmine Dublin", mode)).results.length, 0);
	const p = await client.profile(namespace);
	assert.equal(p.profile.static.length + p.profile.dynamic.length, 0);
	return { afterMs: 8000 };
});
await check("durable_extension_recall_across_reopened_sessions_and_deletion", async () => {
	mkdirSync(".cache", { recursive: true });
	const dir = mkdtempSync(".cache/supermemory-live-journal-");
	const journalKey = parseEnv(readFileSync(".env", "utf8")).SUPERMEMORY_JOURNAL_KEY;
	assert.ok(journalKey);
	const c = config({ ...raw, enabled: true, qualified: true, dir, base_url: baseUrl });
	const provider = new Provider(c, process.env.SUPERMEMORY_API_KEY!);
	const principal = { user_id: `test_${randomUUID()}`, companion_id: "synthetic_companion" };
	let service = new MemoryService(c, new Store(c.dir, journalKey), provider, false);
	let ns = service.status(principal).relationship.namespace;
	try {
		service.remember(principal, "My favourite tea is chrysanthemum tea. I drink it while reading in the evening.");
		await until(async () => {
			await service.pump();
			return (await service.recall(principal, "What tea do I prefer?")).entries.some((e) => /chrysanthemum/i.test(e.text));
		}, 90000);
		await service.close();
		service = new MemoryService(c, new Store(c.dir, journalKey), provider, false);
		assert.equal(service.status(principal).relationship.namespace, ns);
		const recall = await service.recall(principal, "What tea do I prefer?");
		assert.ok(recall.entries.some((e) => /chrysanthemum/i.test(e.text)));
		assert.match(renderMemory(recall.entries, c.prompt_tokens), /chrysanthemum/i);
		console.log("persisted_recall_after_reopen: pass");
		await until(async () => {
			await service.pump();
			const p = await client.profile(ns);
			return [...p.profile.static, ...p.profile.dynamic].some((e) => /chrysanthemum/i.test(e.memory));
		}, 1200000);
		service.deleteRelationship(principal);
		assert.equal((await service.recall(principal, "chrysanthemum tea")).availability, "suppressed");
		await until(async () => { await service.pump(); return service.status(principal).erasures === 0; }, 30000);
		assert.equal((await search(ns, "chrysanthemum tea", "hybrid")).results.length, 0);
		return { reopened: true, dynamicLearning: true, immediateSuppression: true, erasure: true };
	} finally { await service.close(); await client.namespaces.delete(ns).catch(() => {}); }
});
for (const ns of [namespace, other]) await client.namespaces.delete(ns).catch(() => {});
const report = { date: new Date().toISOString(), scope: "synthetic local engine and extension integration", server: "0.0.9", sdk: "5.0.2", model: process.env.OPENAI_MODEL,
	baseUrl, tests, qualified: tests.every((t) => t.passed), productionQualified: false,
	remainingProductionGates: ["authenticated multi-user deployment", "full quality/abstention corpus", "sustained load and failure/restore drills", "egress and capacity/license review"] };
const reportFile = process.argv[3] ?? "docs/reports/supermemory-local-verification.json";
mkdirSync(path.dirname(reportFile), { recursive: true });
writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
console.log(`Local integration qualification: ${report.qualified ? "PASS" : "FAIL"}`);
process.exitCode = report.qualified ? 0 : 1;
