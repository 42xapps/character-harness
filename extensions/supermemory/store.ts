// SQLite is the application journal/outbox, not a second memory extraction engine.
import { DatabaseSync } from "node:sqlite";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFileSync, chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConversationEvent, DocumentWrite, Outcome, Principal } from "./types.ts";

export interface Relationship { key: string; namespace: string; generation: number; paused: number; suppressed: number; version: number }
export interface Job { id: number; relationship: string; generation: number; namespace: string; document: string; revision: number; attempts: number; state: string; provider_id: string | null; created: number }
export interface Erasure { namespace: string; relationship: string; attempts: number }
export type LearningState = "done" | "dreaming" | "unknown" | "stalled";
export interface StorageStats { jobs: { state: string; count: number }[]; learning: { state: string; count: number }[]; inputs: { state: string; count: number }[]; erasures: number; oldestPendingMs: number | null }
export interface QuarantinedInput { id: string; session: string; created: number }
interface EventRow { id: string; session: string; body: string; outcome: string | null; created: number; segment: string | null }
interface Segment { id: string; relationship: string; generation: number; session: string; revision: number; provider_id: string | null }
interface Barrier { key: string; generation: number; namespace: string; retired: string[] }
export const relationshipKey = (p: Principal) => createHash("sha256").update(JSON.stringify([p.user_id, p.companion_id])).digest("hex");

export interface MemoryStorage {
	relationship(p: Principal): Relationship;
	current(key: string): Relationship;
	enqueue(r: Relationship, e: ConversationEvent, maxPending: number): boolean;
	finalize(r: Relationship, id: string, outcome: Outcome): void;
	flush(r: Relationship, session?: string, force?: boolean): void;
	nextJob(now: number): Job | undefined;
	jobDocument(job: Job): DocumentWrite;
	accepted(job: Job, providerId: string): void;
	complete(job: Job, learning?: LearningState): void;
	nextLearningJob(now: number): Job | undefined;
	retry(job: Job, retry: boolean): void;
	valid(r: Relationship): boolean;
	lease(now: number): boolean;
	pollLater(job: Job): void;
	pause(key: string, paused: boolean): void;
	sign(value: string): string;
	rotate(r: Relationship, removeSources: string[] | null): Relationship;
	hasSources(r: Relationship, ids: string[]): boolean;
	nextErasure(now: number): Erasure | undefined;
	erased(ns: string, key: string): void;
	erasureFailed(ns: string, attempts: number): void;
	stats(key?: string): StorageStats;
	allRelationships(): Relationship[];
	recordCorrection(r: Relationship, text: string): void;
	quarantined(r: Relationship): QuarantinedInput[];
	reconcile(r: Relationship, eventId: string, retain: boolean): void;
	close(): void;
}

export class Store implements MemoryStorage {
	db: DatabaseSync;
	readonly file: string;
	private key: Buffer;
	private ledger: string;
	private owner = randomUUID();
	private closed = false;
	constructor(dir: string, key: string) {
		this.key = Buffer.from(key, "base64");
		if (this.key.length !== 32) throw new Error("Journal encryption key must be 32 bytes");
		mkdirSync(dir, { recursive: true, mode: 0o700 });
		chmodSync(dir, 0o700);
		this.file = path.join(dir, "journal.sqlite");
		this.ledger = path.join(dir, "deletions.jsonl");
		if (existsSync(this.file) && !existsSync(this.ledger)) throw new Error("Missing deletion ledger; memory must remain disabled");
		if (!existsSync(this.ledger)) appendFileSync(this.ledger, "", { mode: 0o600 });
		this.db = new DatabaseSync(this.file);
		const version = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
		if (version.user_version > 2) { this.db.close(); throw new Error("Journal is newer than this runtime"); }
		chmodSync(this.file, 0o600);
		this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA busy_timeout=100; PRAGMA max_page_count=65536;
		CREATE TABLE IF NOT EXISTS relationships (key TEXT PRIMARY KEY, namespace TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, suppressed INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0);
		CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, relationship TEXT NOT NULL, generation INTEGER NOT NULL, session TEXT NOT NULL, body TEXT NOT NULL, outcome TEXT, state TEXT NOT NULL, created INTEGER NOT NULL, segment TEXT, owner TEXT NOT NULL, pid INTEGER NOT NULL);
		CREATE INDEX IF NOT EXISTS events_ready ON events(relationship,generation,session,state,seq);
		CREATE TABLE IF NOT EXISTS segments (id TEXT PRIMARY KEY, relationship TEXT NOT NULL, generation INTEGER NOT NULL, session TEXT NOT NULL, revision INTEGER NOT NULL, provider_id TEXT);
		CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY, relationship TEXT NOT NULL, generation INTEGER NOT NULL, namespace TEXT NOT NULL, document TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', learning TEXT NOT NULL DEFAULT 'unknown', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, provider_id TEXT, created INTEGER NOT NULL, UNIQUE(document,revision));
		CREATE TABLE IF NOT EXISTS erasures (namespace TEXT PRIMARY KEY, relationship TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0);
		CREATE TABLE IF NOT EXISTS leases (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
		PRAGMA user_version=2;`);
		if (!(this.db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).some((c) => c.name === "learning")) this.db.exec("ALTER TABLE jobs ADD COLUMN learning TEXT NOT NULL DEFAULT 'unknown'");
		for (const f of [this.file + "-wal", this.file + "-shm"]) if (existsSync(f)) chmodSync(f, 0o600);
		try {
			const sentinel = this.db.prepare("SELECT value FROM metadata WHERE id=1").get() as { value: string } | undefined;
			if (sentinel) { if (this.open(sentinel.value) !== "supermemory-journal-v1") throw new Error("Invalid journal key"); }
			else this.db.prepare("INSERT INTO metadata VALUES(1,?)").run(this.seal("supermemory-journal-v1"));
			this.recoverBarriers();
		} catch (e) { this.db.close(); throw e; }
		// A new CLI process must never quarantine another live runtime's input.
		const owners = this.db.prepare("SELECT DISTINCT pid FROM events WHERE state='pending'").all() as { pid: number }[];
		for (const { pid } of owners) {
			try { process.kill(pid, 0); } catch (e) {
				if ((e as NodeJS.ErrnoException).code === "ESRCH") this.db.prepare("UPDATE events SET state='quarantined' WHERE state='pending' AND pid=?").run(pid);
			}
		}
	}
	seal(value: unknown): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv);
		return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString("base64");
	}
	open<T>(value: string): T {
		const b = Buffer.from(value, "base64");
		const cipher = createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
		cipher.setAuthTag(b.subarray(-16));
		return JSON.parse(Buffer.concat([cipher.update(b.subarray(12, -16)), cipher.final()]).toString());
	}
	sign(value: string): string { return createHmac("sha256", this.key).update(value).digest("hex"); }
	private tx<T>(fn: () => T): T {
		this.db.exec("BEGIN IMMEDIATE");
		try { const r = fn(); this.db.exec("COMMIT"); return r; } catch (e) { this.db.exec("ROLLBACK"); throw e; }
	}
	relationship(p: Principal): Relationship {
		const key = relationshipKey(p);
		this.db.prepare("INSERT OR IGNORE INTO relationships(key,namespace) VALUES(?,?)").run(key, `companion_${randomUUID().replaceAll("-", "")}`);
		return this.current(key);
	}
	current(key: string): Relationship {
		const r = this.db.prepare("SELECT * FROM relationships WHERE key=?").get(key) as unknown as Relationship | undefined;
		if (!r) throw new Error("Unknown memory relationship");
		return r;
	}
	valid(r: Relationship): boolean {
		const current = this.current(r.key);
		return current.generation === r.generation && !current.paused && !current.suppressed;
	}
	enqueue(r: Relationship, event: ConversationEvent, maxPending: number): boolean {
		return this.tx(() => {
			if (!this.valid(r)) return false;
			const n = this.db.prepare("SELECT (SELECT COUNT(*) FROM events WHERE segment IS NULL AND state IN ('pending','final')) + (SELECT COUNT(*) FROM jobs WHERE state IN ('pending','accepted')) AS n").get() as { n: number };
			if (n.n >= maxPending) throw new Error("Memory backlog full; input was not persisted");
			const old = this.db.prepare("SELECT relationship,generation,body FROM events WHERE id=?").get(event.id) as { relationship: string; generation: number; body: string } | undefined;
			if (old && (old.relationship !== r.key || old.generation !== r.generation || JSON.stringify(this.open(old.body)) !== JSON.stringify(event))) throw new Error("Memory event identity collision");
			this.db.prepare("INSERT OR IGNORE INTO events(id,relationship,generation,session,body,state,created,owner,pid) VALUES(?,?,?,?,?,'pending',?,?,?)")
				.run(event.id, r.key, r.generation, event.sessionId, this.seal(event), Date.now(), this.owner, process.pid);
			return true;
		});
	}
	finalize(r: Relationship, id: string, outcome: Outcome) {
		this.tx(() => {
			if (!this.valid(r)) return;
			if (!outcome.eligible) this.db.prepare("DELETE FROM events WHERE id=? AND relationship=? AND generation=? AND state='pending'").run(id, r.key, r.generation);
			else this.db.prepare("UPDATE events SET outcome=?,state='final' WHERE id=? AND relationship=? AND generation=? AND state='pending'")
				.run(this.seal(outcome), id, r.key, r.generation);
		});
	}
	recordCorrection(r: Relationship, text: string) {
		this.tx(() => {
			if (this.current(r.key).generation !== r.generation) throw new Error("Correction superseded by a later deletion");
			const id = randomUUID();
			const event: ConversationEvent = { id, sessionId: `correction_${id}`, text, date: new Date().toISOString(), channel: "manual" };
			this.db.prepare("INSERT INTO events(id,relationship,generation,session,body,outcome,state,created,owner,pid) VALUES(?,?,?,?,?,?,'final',?,?,?)")
				.run(id, r.key, r.generation, event.sessionId, this.seal(event), this.seal({ status: "silent", eligible: true }), Date.now(), this.owner, process.pid);
		});
	}
	private render(rows: EventRow[]): string {
		return rows.map((r) => {
			const event = this.open<ConversationEvent>(r.body);
			const outcome = this.open<Outcome>(r.outcome!);
			return JSON.stringify({ date: event.date, timezone: event.timezone, channel: event.channel, user: event.text,
				assistant_generated: outcome.reply ?? "", outcome: outcome.status, playback_verified: false });
		}).join("\n");
	}
	flush(r: Relationship, session?: string, force = false) {
		this.tx(() => {
			if (!this.valid(r)) return;
			const sessions = session ? [{ session }] : this.db.prepare("SELECT DISTINCT session FROM events WHERE relationship=? AND generation=? AND state='final' AND segment IS NULL").all(r.key, r.generation) as { session: string }[];
			for (const s of sessions) {
				const fresh = this.db.prepare("SELECT * FROM events WHERE relationship=? AND generation=? AND session=? AND state='final' AND segment IS NULL ORDER BY seq").all(r.key, r.generation, s.session) as unknown as EventRow[];
				if (!fresh.length || (!force && fresh.length < 4 && Date.now() - fresh[0].created < 30000)) continue;
				let seg = this.db.prepare("SELECT * FROM segments WHERE relationship=? AND generation=? AND session=? ORDER BY rowid DESC LIMIT 1").get(r.key, r.generation, s.session) as unknown as Segment | undefined;
				for (const row of fresh) {
					let rows = seg ? this.db.prepare("SELECT * FROM events WHERE segment=? ORDER BY seq").all(seg.id) as unknown as EventRow[] : [];
					// Conservative UTF-8 byte budget: <= 6000 tokens even for unusual text.
					if (!seg || rows.length >= 16 || Buffer.byteLength(this.render([...rows, row])) > 6000) {
						seg = { id: `segment_${randomUUID()}`, relationship: r.key, generation: r.generation, session: s.session, revision: 0, provider_id: null };
						this.db.prepare("INSERT INTO segments(id,relationship,generation,session,revision) VALUES(?,?,?,?,0)").run(seg.id, r.key, r.generation, s.session);
						rows = [];
					}
					this.db.prepare("UPDATE events SET segment=? WHERE id=?").run(seg.id, row.id);
					seg.revision++;
					this.db.prepare("UPDATE segments SET revision=? WHERE id=?").run(seg.revision, seg.id);
				}
				const segments = this.db.prepare("SELECT * FROM segments WHERE relationship=? AND generation=? AND session=?").all(r.key, r.generation, s.session) as unknown as Segment[];
				for (const doc of segments) {
					const rows = this.db.prepare("SELECT * FROM events WHERE segment=? ORDER BY seq").all(doc.id) as unknown as EventRow[];
					const snapshot: DocumentWrite = { id: doc.id, revision: doc.revision, content: this.render(rows), date: this.open<ConversationEvent>(rows[0].body).date };
					this.db.prepare("INSERT OR IGNORE INTO jobs(relationship,generation,namespace,document,revision,payload,created) VALUES(?,?,?,?,?,?,?)").run(r.key, r.generation, r.namespace, doc.id, doc.revision, this.seal(snapshot), Date.now());
				}
			}
		});
	}
	lease(now: number): boolean {
		return this.tx(() => {
			const lease = this.db.prepare("SELECT owner,expires FROM leases WHERE id=1").get() as { owner: string; expires: number } | undefined;
			if (lease && lease.owner !== this.owner && lease.expires > now) return false;
			this.db.prepare("INSERT INTO leases VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires").run(this.owner, now + 60000);
			return true;
		});
	}
	nextJob(now: number): Job | undefined {
		return this.db.prepare(`SELECT j.* FROM jobs j JOIN relationships r ON r.key=j.relationship
		WHERE j.state IN ('pending','accepted') AND j.next_at<=? AND j.generation=r.generation AND r.paused=0 AND r.suppressed=0
		AND (j.state='accepted' OR NOT EXISTS(SELECT 1 FROM jobs earlier WHERE earlier.relationship=j.relationship AND earlier.id<j.id AND earlier.state='pending'))
		ORDER BY CASE j.state WHEN 'pending' THEN 0 ELSE 1 END,j.next_at,j.id LIMIT 1`).get(now) as unknown as Job | undefined;
	}
	jobDocument(job: Job): DocumentWrite {
		const row = this.db.prepare("SELECT payload FROM jobs WHERE id=?").get(job.id) as { payload: string } | undefined;
		if (!row) throw new Error("Missing source snapshot");
		return this.open<DocumentWrite>(row.payload);
	}
	accepted(job: Job, providerId: string) {
		this.tx(() => {
			if (this.current(job.relationship).generation !== job.generation) return;
			this.db.prepare("UPDATE jobs SET state='accepted',provider_id=?,next_at=? WHERE id=? AND relationship=? AND generation=?").run(providerId, Date.now() + 1000, job.id, job.relationship, job.generation);
			this.db.prepare("UPDATE segments SET provider_id=? WHERE id=?").run(providerId, job.document);
			this.db.prepare("UPDATE relationships SET version=version+1 WHERE key=?").run(job.relationship);
		});
	}
	complete(job: Job, learning: LearningState = "unknown") { this.db.prepare("UPDATE jobs SET state='done',learning=?,next_at=? WHERE id=? AND relationship=? AND generation=?").run(learning, Date.now() + 5000, job.id, job.relationship, job.generation); }
	nextLearningJob(now: number): Job | undefined {
		return this.db.prepare(`SELECT j.* FROM jobs j JOIN relationships r ON r.key=j.relationship WHERE j.state='done' AND j.learning='dreaming' AND j.next_at<=?
		AND j.generation=r.generation AND r.paused=0 AND r.suppressed=0 AND j.id=(SELECT MAX(id) FROM jobs WHERE document=j.document) ORDER BY j.next_at LIMIT 1`).get(now) as unknown as Job | undefined;
	}
	retry(job: Job, retry: boolean) {
		const attempts = job.attempts + 1;
		this.db.prepare("UPDATE jobs SET state=?,attempts=?,next_at=? WHERE id=? AND relationship=? AND generation=?").run(retry && attempts < 8 ? job.state : "dead", attempts,
			Date.now() + Math.min(300000, 1000 * 2 ** attempts) * (0.75 + Math.random() * 0.5), job.id, job.relationship, job.generation);
	}
	pause(key: string, paused: boolean) {
		this.tx(() => {
			const r = this.current(key);
			if (!paused && r.suppressed) throw new Error("Memory deletion is incomplete; resume is blocked");
			this.db.prepare("UPDATE relationships SET paused=?,version=version+1 WHERE key=?").run(paused ? 1 : 0, key);
			if (paused) this.db.prepare("DELETE FROM events WHERE relationship=? AND state='pending'").run(key);
		});
	}
	private appendBarrier(b: Barrier) {
		const payload = JSON.stringify(b);
		appendFileSync(this.ledger, JSON.stringify({ payload, mac: this.sign(payload) }) + "\n", { mode: 0o600 });
		const fd = openSync(this.ledger, "r");
		try { fsyncSync(fd); } finally { closeSync(fd); }
	}
	private recoverBarriers() {
		if (!existsSync(this.ledger)) return;
		for (const line of readFileSync(this.ledger, "utf8").split("\n").filter(Boolean)) {
			const { payload, mac } = JSON.parse(line) as { payload: string; mac: string };
			const expected = Buffer.from(this.sign(payload));
			if (typeof mac !== "string" || Buffer.byteLength(mac) !== expected.length || !timingSafeEqual(Buffer.from(mac), expected)) throw new Error("Invalid deletion ledger; memory is disabled");
			const b = JSON.parse(payload) as Barrier;
			const r = this.db.prepare("SELECT generation FROM relationships WHERE key=?").get(b.key) as { generation: number } | undefined;
			if (!r || r.generation < b.generation) this.tx(() => {
				this.db.prepare("INSERT INTO relationships(key,namespace,generation,paused,suppressed) VALUES(?,?,?,1,1) ON CONFLICT(key) DO UPDATE SET namespace=excluded.namespace,generation=excluded.generation,paused=1,suppressed=1,version=version+1").run(b.key, b.namespace, b.generation);
				for (const table of ["events", "segments", "jobs"]) this.db.prepare(`DELETE FROM ${table} WHERE relationship=?`).run(b.key);
				for (const ns of b.retired) this.db.prepare("INSERT OR IGNORE INTO erasures(namespace,relationship) VALUES(?,?)").run(ns, b.key);
			});
		}
	}
	rotate(r: Relationship, removeSources: string[] | null): Relationship {
		return this.tx(() => {
			const current = this.current(r.key);
			if (current.generation !== r.generation || current.version !== r.version) throw new Error("Memory changed; preview again");
			const b: Barrier = { key: r.key, generation: r.generation + 1, namespace: `companion_${randomUUID().replaceAll("-", "")}`, retired: [r.namespace] };
			// Fsync before SQLite commit: crash recovery always errs toward erasure.
			this.appendBarrier(b);
			this.db.prepare("UPDATE relationships SET namespace=?,generation=?,suppressed=1,version=version+1 WHERE key=?").run(b.namespace, b.generation, r.key);
			if (removeSources === null) this.db.prepare("DELETE FROM events WHERE relationship=?").run(r.key);
			else for (const source of removeSources) this.db.prepare("DELETE FROM events WHERE segment IN (SELECT id FROM segments WHERE relationship=? AND (id=? OR provider_id=?))").run(r.key, source, source);
			// Pending inputs cannot cross the deletion barrier.
			this.db.prepare("DELETE FROM events WHERE relationship=? AND state!='final'").run(r.key);
			this.db.prepare("UPDATE events SET generation=?,segment=NULL WHERE relationship=?").run(b.generation, r.key);
			for (const table of ["segments", "jobs"]) this.db.prepare(`DELETE FROM ${table} WHERE relationship=?`).run(r.key);
			this.db.prepare("INSERT OR IGNORE INTO erasures(namespace,relationship) VALUES(?,?)").run(r.namespace, r.key);
			return this.current(r.key);
		});
	}
	hasSources(r: Relationship, ids: string[]): boolean {
		return ids.length > 0 && ids.every((id) => !!this.db.prepare("SELECT 1 FROM segments WHERE relationship=? AND (id=? OR provider_id=?)").get(r.key, id, id));
	}
	nextErasure(now: number) { return this.db.prepare("SELECT namespace,relationship,attempts FROM erasures WHERE next_at<=? ORDER BY rowid LIMIT 1").get(now) as Erasure | undefined; }
	erased(ns: string, key: string) {
		this.tx(() => {
			this.db.prepare("DELETE FROM erasures WHERE namespace=?").run(ns);
			if (!this.db.prepare("SELECT 1 FROM erasures WHERE relationship=?").get(key)) {
				this.db.prepare("UPDATE relationships SET suppressed=0,version=version+1 WHERE key=?").run(key);
				this.flushAfterErasure = key;
			}
		});
		if (this.flushAfterErasure === key) { this.flushAfterErasure = undefined; this.flush(this.current(key), undefined, true); }
	}
	private flushAfterErasure?: string;
	erasureFailed(ns: string, attempts: number) { this.db.prepare("UPDATE erasures SET attempts=attempts+1,next_at=? WHERE namespace=?").run(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 9)), ns); }
	stats(key?: string): StorageStats {
		const params = key ? [key] : [];
		const clause = key ? "WHERE relationship=?" : "";
		const oldest = (this.db.prepare(`SELECT MIN(created) AS t FROM jobs ${clause} ${key ? "AND" : "WHERE"} state IN ('pending','accepted')`).get(...params) as { t: number | null }).t;
		return { jobs: this.db.prepare(`SELECT state,COUNT(*) AS count FROM jobs ${clause} GROUP BY state`).all(...params) as { state: string; count: number }[],
			learning: this.db.prepare(`SELECT learning AS state,COUNT(*) AS count FROM jobs ${clause} GROUP BY learning`).all(...params) as { state: string; count: number }[],
			inputs: this.db.prepare(`SELECT state,COUNT(*) AS count FROM events ${clause} GROUP BY state`).all(...params) as { state: string; count: number }[],
			erasures: (this.db.prepare(`SELECT COUNT(*) AS n FROM erasures ${clause}`).get(...params) as { n: number }).n,
			oldestPendingMs: oldest === null ? null : Date.now() - oldest };
	}
	allRelationships() { return this.db.prepare("SELECT * FROM relationships").all() as unknown as Relationship[]; }
	pollLater(job: Job) {
		const age = Date.now() - job.created;
		const delay = age > 300000 ? 30000 : age > 60000 ? 10000 : 2000;
		this.db.prepare("UPDATE jobs SET next_at=? WHERE id=? AND relationship=? AND generation=?").run(Date.now() + delay, job.id, job.relationship, job.generation);
	}
	quarantined(r: Relationship) {
		return this.db.prepare("SELECT id,session,created FROM events WHERE relationship=? AND generation=? AND state='quarantined' ORDER BY seq LIMIT 100").all(r.key, r.generation) as unknown as QuarantinedInput[];
	}
	reconcile(r: Relationship, eventId: string, retain: boolean) {
		this.tx(() => {
			if (!this.valid(r)) throw new Error("Relationship changed before reconciliation");
			if (retain) this.db.prepare("UPDATE events SET state='final',outcome=? WHERE id=? AND relationship=? AND generation=? AND state='quarantined'")
				.run(this.seal({ status: "interrupted", eligible: true }), eventId, r.key, r.generation);
			else this.db.prepare("DELETE FROM events WHERE id=? AND relationship=? AND generation=? AND state='quarantined'").run(eventId, r.key, r.generation);
		});
		this.flush(r, undefined, true);
	}
	close() {
		if (this.closed) return;
		this.closed = true;
		this.db.prepare("UPDATE events SET state='quarantined' WHERE state='pending' AND owner=?").run(this.owner);
		this.db.prepare("DELETE FROM leases WHERE owner=?").run(this.owner);
		this.db.close();
	}
}
