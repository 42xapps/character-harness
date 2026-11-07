import { randomUUID, timingSafeEqual } from "node:crypto";
import { validatePrincipal } from "../../runtime/src/principal.ts";
import { validTimezone } from "../../runtime/src/context.ts";
import type { Config } from "./config.ts";
import { retryable } from "./provider.ts";
import type { MemoryStorage, Relationship } from "./store.ts";
import type { ConversationEvent, ForgetPreview, MemoryEntry, MemoryProvider, Outcome, Principal, Recall } from "./types.ts";

interface Cached { generation: number; version: number; expires: number; entries: MemoryEntry[] }
export class MemoryService {
	readonly store: MemoryStorage;
	private c: Config;
	private provider: MemoryProvider;
	private cache = new Map<string, Cached>();
	private profiles = new Set<string>();
	private worker?: Promise<void>;
	private timer?: ReturnType<typeof setInterval>;
	private closed = false;
	private recalls = 0;
	private counters: Record<string, number> = {};
	constructor(c: Config, store: MemoryStorage, provider: MemoryProvider, start = true) {
		this.c = c; this.store = store; this.provider = provider;
		if (start) {
			this.timer = setInterval(() => { void this.pump().catch(() => this.count("worker_storage_failure")); }, 1000);
			this.timer.unref();
		}
	}
	private count(name: string, fields: Record<string, number> = {}) {
		this.counters[name] = (this.counters[name] ?? 0) + 1;
		if (this.c.log_events) console.info("[supermemory]", JSON.stringify({ event: name, count: this.counters[name], ...fields }));
	}
	private relationship(p: Principal) { return this.store.relationship(validatePrincipal(p)); }
	private active(r: Relationship) { return !this.closed && this.c.enabled && this.c.qualified && this.store.valid(r); }
	private clean(text: string): string {
		let result = text;
		for (const [name, value] of Object.entries(process.env)) if (/KEY|TOKEN|SECRET|PASSWORD/.test(name) && value && value.length >= 8) result = result.split(value).join("[redacted]");
		return result.replace(/\b(?:sk-|sm_)[A-Za-z0-9_-]{8,}/g, "[redacted]")
			.replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
			.replace(/\b(password|api[_ -]?key|access[_ -]?token)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
			.replace(/\b(?:wss?|https?):\/\/\S*\/session\/[^\s"<>]+/g, "[session redacted]");
	}
	enqueueConversation(p: Principal, event: ConversationEvent): boolean {
		const r = this.relationship(p);
		if (!this.active(r) || !event.text.trim()) return false;
		if (!/^[a-zA-Z0-9_-]{1,100}$/.test(event.id) || !/^[a-zA-Z0-9_-]{1,100}$/.test(event.sessionId) || !Number.isFinite(Date.parse(event.date)) || !["chat", "voice", "screen", "manual"].includes(event.channel)) throw new Error("Invalid memory event");
		// Do not silently truncate a user statement and change its meaning.
		if (Buffer.byteLength(JSON.stringify(event)) > 4000) { this.count("input_too_large"); return false; }
		const retained: ConversationEvent = { id: event.id, sessionId: event.sessionId, text: this.clean(event.text), date: event.date, channel: event.channel,
			...(validTimezone(event.timezone) ? { timezone: event.timezone } : {}) };
		const accepted = this.store.enqueue(r, retained, this.c.max_pending);
		if (accepted) this.count("input_retained");
		return accepted;
	}
	finalize(p: Principal, eventId: string, outcome: Outcome, generation: number) {
		const r = this.relationship(p);
		if (!this.active(r) || r.generation !== generation) return;
		const reply = outcome.reply && Buffer.byteLength(JSON.stringify(outcome.reply)) <= 1000 ? this.clean(outcome.reply) : undefined;
		this.store.finalize(r, eventId, { ...outcome, reply });
		this.store.flush(r);
	}
	endSession(p: Principal, session: string) {
		const r = this.relationship(p);
		if (this.active(r)) this.store.flush(r, session, true);
	}
	async getProfile(p: Principal): Promise<Recall> {
		const r = this.relationship(p);
		if (!this.active(r)) return { entries: [], availability: r.suppressed ? "suppressed" : "disabled" };
		const hit = this.cached(r);
		if (hit) return { entries: hit, availability: hit.length ? "cached" : "empty" };
		if (this.profiles.has(r.key) || this.profiles.size >= 4) return { entries: [], availability: "unavailable" };
		this.profiles.add(r.key);
		try {
			const signal = AbortSignal.timeout(3000);
			const entries = await bounded(this.provider.profile(r.namespace, signal), signal);
			const current = this.store.current(r.key);
			if (!this.active(current) || current.generation !== r.generation || current.version !== r.version) return { entries: [], availability: "suppressed" };
			if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!);
			const safe = entries.filter((e) => e.latest && !e.inferred).slice(0, 20);
			this.cache.set(r.key, { generation: r.generation, version: r.version, expires: Date.now() + 30000, entries: safe });
			this.count("profile_ready", { entries: safe.length });
			return { entries: safe, availability: safe.length ? "ready" : "empty" };
		} catch { this.count("profile_unavailable"); return { entries: [], availability: "unavailable" }; }
		finally { this.profiles.delete(r.key); }
	}
	private cached(r: Relationship): MemoryEntry[] | undefined {
		const hit = this.cache.get(r.key);
		return hit && hit.generation === r.generation && hit.version === r.version && hit.expires > Date.now() ? hit.entries : undefined;
	}
	async recall(p: Principal, query: string): Promise<Recall> {
		const r = this.relationship(p);
		if (!this.active(r)) return { entries: [], availability: r.suppressed ? "suppressed" : "disabled" };
		const profile = this.cached(r) ?? [];
		void this.getProfile(p);
		if (/^\s*(hi|hey|hello|good (morning|evening)|thanks|thank you)[!.\s]*$/i.test(query)) return { entries: profile, availability: profile.length ? "cached" : "empty" };
		if (this.recalls >= 8) return { entries: profile, availability: profile.length ? "cached" : "unavailable" };
		this.recalls++;
		const started = performance.now();
		try {
			const signal = AbortSignal.timeout(this.c.recall_ms);
			const entries = await bounded(this.provider.search(r.namespace, this.clean(query).slice(0, 4000), signal), signal);
			const current = this.store.current(r.key);
			if (!this.active(current) || current.generation !== r.generation || current.version !== r.version) return { entries: [], availability: "suppressed" };
			const seen = new Set<string>();
			const combined = [...entries, ...profile].filter((e) => {
				const key = e.text.trim().toLowerCase();
				if (!e.latest || e.inferred || seen.has(key)) return false;
				seen.add(key); return true;
			});
			this.count("recall_ready", { entries: combined.length, elapsed_ms: Math.round(performance.now() - started) });
			return { entries: combined, availability: combined.length ? "ready" : "empty" };
		} catch {
			this.count("recall_fallback");
			const current = this.store.current(r.key);
			const valid = this.active(current) && current.generation === r.generation && current.version === r.version;
			return { entries: valid ? profile : [], availability: valid && profile.length ? "cached" : "unavailable" };
		} finally {
			this.recalls--;
			this.counters.recall_ms_total = (this.counters.recall_ms_total ?? 0) + performance.now() - started;
		}
	}
	list(p: Principal, page = 1): Promise<unknown> {
		if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error("Invalid page");
		const r = this.relationship(p);
		if (r.suppressed) throw new Error("Memory is suppressed while erasure completes");
		return this.provider.list(r.namespace, page);
	}
	pause(p: Principal, paused: boolean) { const r = this.relationship(p); this.store.pause(r.key, paused); this.cache.delete(r.key); }
	async previewForget(p: Principal, query: string): Promise<ForgetPreview> {
		if (!query.trim() || query.length > 1000) throw new Error("Expected a bounded forget query");
		const r = this.relationship(p);
		if (r.suppressed) throw new Error("Another deletion is in progress");
		const ids = await this.provider.preview(r.namespace, query);
		if (ids.length > 500) throw new Error("Too many matches; narrow the query");
		const sources = ids.length ? await this.provider.sources(r.namespace, ids) : [];
		const clearsAll = ids.length > 0 && (!this.c.source_rebuild_qualified || !sources || !this.store.hasSources(r, sources));
		const payload = JSON.stringify({ key: r.key, generation: r.generation, version: r.version, ids, sources: sources ?? [], clearsAll, expires: Date.now() + 300000 });
		return { ids, sourceIds: sources ?? [], clearsAll, token: Buffer.from(payload).toString("base64url") + "." + this.store.sign(payload) };
	}
	async forget(p: Principal, token: string, allowClearAll = false) {
		const r = this.relationship(p);
		const [encoded, signature] = token.split(".");
		const payload = Buffer.from(encoded ?? "", "base64url").toString();
		const expected = this.store.sign(payload);
		if (typeof signature !== "string" || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid forget preview");
		const preview = JSON.parse(payload) as { key: string; generation: number; version: number; ids: string[]; sources: string[]; clearsAll: boolean; expires: number };
		if (preview.key !== r.key || preview.generation !== r.generation || preview.version !== r.version || preview.expires < Date.now()) throw new Error("Memory changed or preview expired; preview again");
		if (!preview.ids.length) return { suppressed: false, erasureComplete: true, generation: r.generation };
		if (preview.clearsAll && !allowClearAll) throw new Error("Selective erasure is unqualified or provenance is incomplete: forgetting requires clearing this relationship; explicitly allow this or cancel");
		const next = this.store.rotate(r, preview.clearsAll ? null : preview.sources);
		this.cache.delete(r.key);
		// Exact forget is best effort after the durable suppression barrier. The
		// retired namespace is deleted by the serialized worker regardless of failures.
		try { await this.provider.forget(r.namespace, preview.ids); } catch { this.count("exact_forget_incomplete"); }
		return { suppressed: true, erasureComplete: false, generation: next.generation };
	}
	deleteRelationship(p: Principal) {
		const r = this.relationship(p);
		this.store.rotate(r, null);
		this.cache.delete(r.key);
		return { suppressed: true, erasureComplete: false };
	}
	async correct(p: Principal, token: string, text: string, allowClearAll = false) {
		if (!text.trim() || Buffer.byteLength(JSON.stringify(text)) > 3500) throw new Error("Correction is empty or too large for one source event");
		const result = await this.forget(p, token, allowClearAll);
		const r = this.relationship(p);
		if (r.generation !== result.generation) throw new Error("A later deletion superseded this correction; it was not retained");
		if (!result.suppressed) { this.remember(p, text); return { erasureComplete: true, correction: "queued" }; }
		this.store.recordCorrection(r, this.clean(text));
		return { erasureComplete: false, correction: "durable; awaiting erasure" };
	}
	remember(p: Principal, text: string) {
		const id = randomUUID();
		const r = this.relationship(p);
		if (!this.enqueueConversation(p, { id, sessionId: `manual_${id}`, text, date: new Date().toISOString(), channel: "manual" })) throw new Error("Memory is disabled, paused, suppressed, or input is too large");
		this.finalize(p, id, { status: "silent", eligible: true }, r.generation);
		this.store.flush(this.store.current(r.key), undefined, true);
		return id;
	}
	pump(): Promise<void> {
		if (this.worker) return this.worker;
		if (this.closed) return Promise.resolve();
		this.worker = this.work().finally(() => { this.worker = undefined; });
		return this.worker;
	}
	private async work() {
		if (!this.store.lease(Date.now())) return;
		const erasure = this.store.nextErasure(Date.now());
		if (erasure) {
			try { await this.provider.deleteNamespace(erasure.namespace); this.store.erased(erasure.namespace, erasure.relationship); this.count("erasure_complete"); }
			catch { this.store.erasureFailed(erasure.namespace, erasure.attempts); this.count("erasure_pending"); }
			return;
		}
		if (!this.c.enabled || !this.c.qualified) return;
		for (const r of this.store.allRelationships()) this.store.flush(r);
		const job = this.store.nextJob(Date.now()) ?? this.store.nextLearningJob(Date.now());
		if (!job) return;
		try {
			if (job.state === "pending") {
				const id = await this.provider.add(job.namespace, this.store.jobDocument(job));
				if (!this.store.valid(this.store.current(job.relationship)) || this.store.current(job.relationship).generation !== job.generation) return;
				this.store.accepted(job, id);
				await this.provider.setup(job.namespace);
				this.count("ingestion_accepted");
			} else {
				const status = await this.provider.status(job.namespace, job.provider_id!);
				if (this.store.current(job.relationship).generation !== job.generation) return;
				if (status.chunks === "failed") this.store.retry(job, false);
				else if (status.chunks === "done") {
					this.store.complete(job, status.dreaming);
					this.cache.delete(job.relationship);
					if (job.state !== "done") this.count("chunks_ready");
					if (status.dreaming === "done") this.count("dreaming_complete");
				}
				else {
					// Queued/processing is not failure. Job age includes time spent in
					// our outbox; the provider exposes no processing-time SLA.
					this.store.pollLater(job);
					if (Date.now() - job.created > 600000) this.count("ingestion_waiting");
				}
			}
		} catch (e) { this.store.retry(job, retryable(e)); this.count("ingestion_failure"); }
	}
	status(p: Principal) { const r = this.relationship(p); return { relationship: r, ...this.store.stats(r.key), counters: { ...this.counters } }; }
	quarantined(p: Principal) {
		const r = this.relationship(p);
		return this.store.quarantined(r);
	}
	reconcile(p: Principal, eventId: string, retain: boolean) {
		const r = this.relationship(p);
		if (!this.active(r)) throw new Error("Memory must be enabled and unsuppressed to reconcile");
		this.store.reconcile(r, eventId, retain);
	}
	async close() {
		if (this.closed) return;
		this.closed = true;
		clearInterval(this.timer);
		if (this.worker) await this.worker;
		// Outstanding recall/profile requests are bounded and observe closed=true.
		while (this.profiles.size || this.recalls) await new Promise((resolve) => setTimeout(resolve, 5));
		this.cache.clear();
		this.store.close();
	}
}

async function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	if (signal.aborted) throw signal.reason;
	let abort: () => void;
	const timedOut = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener("abort", abort, { once: true }); });
	try { return await Promise.race([promise, timedOut]); } finally { signal.removeEventListener("abort", abort!); }
}
