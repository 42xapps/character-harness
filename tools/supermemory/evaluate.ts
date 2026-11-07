// Retrieval evaluation only: this deliberately does not call/change the companion model.
// End-to-end answer/abstention scoring remains a separate release gate.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Supermemory } from "supermemory";
process.loadEnvFile(process.argv[2] ?? ".cache/supermemory-qualification/.env");
const client = new Supermemory({ baseUrl: `http://127.0.0.1:${process.env.SUPERMEMORY_PORT ?? "6779"}`, apiKey: process.env.SUPERMEMORY_API_KEY!, timeoutInSeconds: 10, maxRetries: 0 });
const cases = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8")) as { id: string; sessions: string[]; query: string; expected: string[]; forbidden: string[]; unanswerable?: boolean }[];
const results: unknown[] = [];
for (const fixture of cases) {
	const ns = `eval_${randomUUID().replaceAll("-", "")}`;
	try {
		for (let i = 0; i < fixture.sessions.length; i++) {
			const doc = await client.add(ns, { id: `session_${i}`, content: fixture.sessions[i], taskType: "memory", dreaming: "instant", date: new Date(Date.now() - (fixture.sessions.length - i) * 86400000).toISOString(), supportingContext: "The human is Avery, talking to a fictional companion. Learn real user facts, not fiction or assistant suggestions. Explicit corrections supersede older facts." });
			const deadline = Date.now() + 180000;
			let ready = false;
			while (Date.now() < deadline) {
				const status = (await client.documents.get(ns, doc.id)).system.status;
				if (status === "failed") throw new Error("Extraction failed");
				if (status === "done") { ready = true; break; }
				await new Promise((r) => setTimeout(r, 2000));
			}
			if (!ready) throw new Error("Extraction timeout");
		}
		let memories = await client.search(ns, { query: fixture.query, searchMode: "memories" });
		const deadline = Date.now() + 180000;
		while (!memories.results.length && Date.now() < deadline && !fixture.unanswerable) {
			await new Promise((r) => setTimeout(r, 3000));
			memories = await client.search(ns, { query: fixture.query, searchMode: "memories" });
		}
		const profile = await client.profile(ns);
		const hybrid = await client.search(ns, { query: fixture.query, searchMode: "hybrid", include: { related: true, documents: true, forgotten: false } });
		const texts: Record<string, string> = {
			none: "", profile: [...profile.profile.static, ...profile.profile.dynamic].map((m) => m.memory).join(" "),
			hybrid: hybrid.results.filter((m) => m.isLatest && !m.isInference).map((m) => m.memory ?? m.chunk).join(" "),
		};
		for (const [mode, content] of Object.entries(texts)) results.push({ fixture: fixture.id, mode,
			recall: fixture.expected.every((s) => content.toLowerCase().includes(s.toLowerCase())),
			contradiction: fixture.forbidden.some((s) => content.toLowerCase().includes(s.toLowerCase())),
			unanswerable: !!fixture.unanswerable, answerAbstention: "not measured", textBytes: Buffer.byteLength(content) });
		console.log(`${fixture.id}: evaluated`);
	} catch (e) { results.push({ fixture: fixture.id, error: e instanceof Error ? e.name : "Error" }); }
	finally {
		try {
			const deleted = await client.namespaces.delete(ns);
			if (deleted.status !== "deleted") results.push({ fixture: fixture.id, cleanupPendingNamespace: ns });
		} catch { results.push({ fixture: fixture.id, cleanupPendingNamespace: ns }); }
	}
}
writeFileSync("docs/reports/supermemory-retrieval-evaluation.json", JSON.stringify({ date: new Date().toISOString(), scope: "synthetic retrieval only; not a production qualification", results }, null, 2) + "\n");
