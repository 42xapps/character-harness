import { Supermemory, SupermemoryError } from "supermemory";
import type { SearchResponseResultsItem } from "supermemory";
import type { Config } from "./config.ts";
import type { DocumentWrite, MemoryEntry, MemoryProvider } from "./types.ts";

// The official SDK owns HTTP/auth. Retries live in the durable outbox, not the SDK.
export class Provider implements MemoryProvider {
	private client: Supermemory;
	private c: Config;
	constructor(c: Config, apiKey: string, fetcher?: typeof fetch) {
		this.c = c;
		this.client = new Supermemory({ baseUrl: c.base_url, apiKey, maxRetries: 0, timeoutInSeconds: 10, fetch: limitedFetch(fetcher ?? fetch) });
	}
	async add(ns: string, doc: DocumentWrite) {
		const r = await this.client.add(ns, {
			id: doc.id, content: doc.content, date: doc.date, taskType: "memory", dreaming: "dynamic",
			supportingContext: this.c.supporting_context,
			metadata: { source: "companion_conversation", revision: doc.revision, playback_verified: false },
		});
		if (typeof r.id !== "string" || !r.id) throw new Error("Invalid ingestion response");
		return r.id;
	}
	async status(ns: string, id: string) {
		const r = await this.client.documents.get(ns, id);
		return { chunks: r.system.status === "done" ? "done" as const : r.system.status === "failed" ? "failed" as const : "pending" as const,
			dreaming: r.system.dreamingStatus === "done" ? "done" as const : r.system.dreamingStatus === "dreaming" ? "dreaming" as const : "unknown" as const };
	}
	async setup(ns: string) {
		await this.client.namespaces.update(ns, { supportingContext: this.c.supporting_context });
		if (Object.keys(this.c.buckets).length) await this.client.profiles.setBuckets(ns, { buckets: this.c.buckets });
	}
	async search(ns: string, query: string, signal: AbortSignal) {
		const r = await this.client.search(ns, { query, searchMode: "hybrid", limit: 12, threshold: 0.3,
			rerank: "none", rewriteQuery: false, include: { documents: true, related: true, forgotten: false } }, { abortSignal: signal });
		if (!Array.isArray(r.results)) throw new Error("Invalid recall response");
		return r.results.map(normalize).filter((v): v is MemoryEntry => v !== null);
	}
	async profile(ns: string, signal: AbortSignal) {
		const r = await this.client.profile(ns, { buckets: Object.keys(this.c.buckets) }, { abortSignal: signal });
		// Profile summaries have no per-fact truth/inference flags. Resolve real IDs
		// and omit aggregates until the engine can prove their provenance/lifecycle.
		const ids = [...new Set([...r.profile.static, ...r.profile.dynamic, ...Object.values(r.profile.buckets ?? {}).flat()].map((m) => m.id))]
			.filter((id) => typeof id === "string" && !id.startsWith("aggregated_")).slice(0, 20);
		const entries = await Promise.all(ids.map(async (id): Promise<MemoryEntry | null> => {
			const m = await this.client.memories.get(ns, id, {}, { abortSignal: signal });
			if (!m.isLatest || m.isForgotten || m.isInference || typeof m.memory !== "string") return null;
			return { id: m.id, text: m.memory, kind: "profile", sourceIds: [], updatedAt: m.system.updatedAt, inferred: false, latest: true };
		}));
		return entries.filter((v): v is MemoryEntry => v !== null);
	}
	async list(ns: string, page: number) { return this.client.list(ns, "memories", { page, limit: 50 }); }
	async preview(ns: string, query: string) {
		// Semantic selection calls the local LLM. Management has a separate bounded
		// deadline from the 300 ms conversational recall path.
		return (await this.client.memories.forgetMatching(ns, { query, dryRun: true }, { timeoutInSeconds: 120 })).matches.map((m) => m.id);
	}
	async sources(ns: string, ids: string[]) {
		const result: string[] = [];
		for (const id of ids) {
			const m = await this.client.memories.get(ns, id, { include: ["documents"] });
			const document = m.included?.document;
			if (!document?.id) return null;
			result.push(document.id);
		}
		return [...new Set(result)];
	}
	async forget(ns: string, ids: string[]) {
		if (!ids.length) return;
		const r = await this.client.memories.forget(ns, { ids });
		if (r.errors.length || r.count !== ids.length) throw new Error("Partial memory forget");
	}
	async deleteNamespace(ns: string) {
		try {
			const r = await this.client.namespaces.delete(ns);
			if (r.status !== "deleted") {
				// A queued erasure may already have finished. Only a namespace GET
				// returning 404 (caught below) confirms absence; HTTP acceptance alone does not.
				await this.client.namespaces.get(ns);
				throw new TypeError("Namespace erasure is queued, not completed");
			}
		}
		catch (e) { if (!(e instanceof SupermemoryError && e.statusCode === 404)) throw e; }
	}
}

function normalize(r: SearchResponseResultsItem): MemoryEntry | null {
	const text = r.memory ?? r.chunk;
	if (typeof r.id !== "string" || typeof text !== "string" || !text.trim() || r.isLatest !== true || r.isInference === true) return null;
	const related = r.included?.related;
	// Preserve bounded graph evidence for audit; related nodes have no latest/
	// forgotten/inference flags in this response contract, so never render them
	// as current personal facts without an additional lifecycle lookup.
	const evidence = related ? [...(related.parents ?? []), ...(related.children ?? []), ...(related.siblings ?? [])]
		.slice(0, 12).filter((m) => typeof m.id === "string" && typeof m.memory === "string")
		.map((m) => ({ id: m.id, text: m.memory.slice(0, 1000), relation: m.relation })) : [];
	return { id: r.id, text: text.slice(0, 12000), kind: r.memory ? "memory" : "chunk", inferred: false, latest: true, related: evidence,
		updatedAt: r.system?.updatedAt, sourceIds: r.included?.document?.id ? [r.included.document.id] : [] };
}

export function retryable(error: unknown): boolean {
	if (error instanceof SupermemoryError) return error.statusCode === 429 || (error.statusCode ?? 0) >= 500;
	return error instanceof TypeError || (error instanceof Error && /Timeout|Abort/.test(error.name));
}

function limitedFetch(fetcher: typeof fetch): typeof fetch {
	return async (input, init) => {
		// SDK authentication must never follow a redirect to another origin.
		const response = await fetcher(input, { ...init, redirect: "error" });
		if (!response.body) return response;
		const reader = response.body.getReader();
		const parts: Uint8Array[] = [];
		let bytes = 0;
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
				if (bytes > 1024 * 1024) throw new Error("Memory API response exceeds 1 MiB");
				parts.push(value);
			}
		} catch (e) { await reader.cancel().catch(() => {}); throw e; }
		return new Response(Buffer.concat(parts), { status: response.status, statusText: response.statusText, headers: response.headers });
	};
}
