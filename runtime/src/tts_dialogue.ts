// The character's TTS on ElevenLabs' Text to Dialogue WebSocket, with any eleven_v3* or
// eleven_v4* model (eleven_v4_turbo takes exactly one voice, which is all this
// registers). Other models take the per-sentence HTTP request in tts.ts.
//
// ONE connection per session, opened when the session opens so the first reply
// does not pay the connect (~260 ms measured). Sentences go onto a FIFO queue and
// out the moment they arrive: the server generates them one after another, so
// there is nothing to hold back. Its messages carry no sentence id, so
// everything received belongs to the head of the queue, and
// `is_final_audio_for_turn` (one per flushed sentence) ends the head.
//
// There is no cancel message. `new_turn` and ignoring the audio both leave a cut
// sentence generating to its end, which put the next reply ~2.5 s after the cut
// against ~0.65 s for tearing the socket down and reconnecting (measured). So a
// cancel, like a drop, terminates the socket and opens a new one; the sentences
// that were in flight with it are re-sent if nothing of them has reached the app
// yet, and answered `tts_dropped` otherwise, which the app retries.
//
// The socket is injected (`DialogueConnect`) so a test can drive this against a
// fake server; `wsDialogueConnect` is the real one.

import WebSocket from "ws";
import type { AlignmentChunk } from "./align.ts";

// The server closes after 20 s without a message from us: 1008
// `input_timeout_exceeded` (measured).
const KEEP_ALIVE_MS = 8000;
// A failed connect is retried after each of these; after the last, the queue
// gets `error`. A socket that goes before it has proved itself counts as a
// failed connect, so a server that accepts and then refuses cannot loop.
const RETRY_MS = [500, 1000, 2000];
// what proves a socket: it carried audio, or it stayed up this long (refusals
// arrive within a second or two; the idle close takes 20 s)
const STABLE_MS = 5000;
// a connect with no answer by then counts as failed (connects measured ~260 ms)
const CONNECT_TIMEOUT_MS = 3000;

// What the queue needs from a socket.
export interface DialogueSocket {
	send(data: string): void;
	// tear it down. Never `close_socket`: that generates, and bills, any text still pending.
	terminate(): void;
}
export interface DialogueSocketEvents {
	message(data: string): void;
	close(code: number, reason: string): void;
}
// resolves once the socket is open, rejects when it cannot be opened
export type DialogueConnect = (on: DialogueSocketEvents) => Promise<DialogueSocket>;

// The real socket. Node can drop the connection outright, which is what
// `terminate` wants: nothing pending gets generated or billed.
export function wsDialogueConnect(apiKey: string, outputFormat: string, model: string): DialogueConnect {
	const url =
		"wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input" +
		`?model_id=${encodeURIComponent(model)}&output_format=${outputFormat}&sync_alignment=true`;
	return (on) =>
		new Promise((resolve, reject) => {
			const ws = new WebSocket(url, { headers: { "xi-api-key": apiKey } });
			let opened = false;
			ws.on("open", () => {
				opened = true;
				resolve({
					send: (d) => ws.send(d),
					terminate: () => ws.terminate(),
				});
			});
			ws.on("message", (d, isBinary) => { if (!isBinary) on.message(d.toString()); });
			ws.on("close", (code, reason) => { if (opened) on.close(code, reason.toString()); });
			// before `open`, an error is the handshake failing; after it, `close` follows
			ws.on("error", (e) => { if (!opened) reject(e); });
		});
}

// One message's alignment moved onto its sentence's own clip. Each message's
// times restart at 0 where the previous message's characters ended (the
// "running" clock, verified over 24 sentences and several turns on one
// connection), so the sentence keeps an offset: where its characters have
// reached so far, in ms. Null for a message that carries no characters.
// Exported so a test can hold it against recorded runs.
export function runningChunk(a: unknown, offsetMs: number): { chunk: AlignmentChunk; endMs: number } | null {
	const al = a as { chars?: unknown; char_start_times_ms?: unknown; char_durations_ms?: unknown } | null | undefined;
	const chars = al?.chars;
	const starts = al?.char_start_times_ms;
	const durs = al?.char_durations_ms;
	if (!Array.isArray(chars) || !chars.length || !Array.isArray(starts) || !starts.length) return null;
	const ends = (starts as number[]).map((t, i) => t + ((Array.isArray(durs) ? durs[i] : undefined) ?? 0));
	return {
		chunk: {
			characters: chars as string[],
			character_start_times_seconds: (starts as number[]).map((t) => (t + offsetMs) / 1000),
			character_end_times_seconds: ends.map((t) => (t + offsetMs) / 1000),
		},
		endMs: offsetMs + Math.max(...ends),
	};
}

// One sentence, as tts.ts hands it over.
export interface DialogueSentence {
	id: number;
	text: string;
	newTurn: boolean;               // the reply's first sentence
	onSend: () => void;             // just before its `inputs` message, every time it goes out
	onAudio: (b64: string) => void; // base64 PCM, forwarded at once
	onAlignment: (chunk: AlignmentChunk) => void;
}
// how a sentence ended: all its audio arrived, it was cancelled (no tts_done),
// or the `error` text the app gets instead of tts_done
export type DialogueEnd = "done" | "cancelled" | { error: string };

interface Queued {
	sentence: DialogueSentence;
	// waiting: not sent on any socket yet. sent: sent, nothing back yet.
	// forwarded: its audio or alignment reached tts.ts. lost: forwarded, then
	// its socket went, so it gets tts_dropped instead of a re-send.
	stage: "waiting" | "sent" | "forwarded" | "lost";
	offsetMs: number; // the running alignment clock
	end: (e: DialogueEnd) => void;
}

export interface DialogueOptions {
	connect: DialogueConnect;
	voiceId: string;
	voiceSettings: Record<string, unknown>;
	log: (line: string) => void;
	// a test shortens these; the runtime takes the defaults
	keepAliveMs?: number;
	retryMs?: number[];
	connectTimeoutMs?: number;
}

const idList = (qs: Queued[]) => qs.map((q) => q.sentence.id).join(",") || "none";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export class DialogueTts {
	private queue: Queued[] = [];
	// idle: no socket and none being opened. connecting: a connect (and its
	// retries) is under way. open: `sock` is live. closed: the session is over.
	private state: "idle" | "connecting" | "open" | "closed" = "idle";
	private sock: DialogueSocket | null = null;
	// the socket whose events count; anything from an older one is ignored
	private live: object | null = null;
	private opens = 0;
	private openedAt = 0;
	private heard = false; // the live socket has carried audio
	// failed attempts in a row: connects that failed, and sockets that went
	// before they proved themselves (STABLE_MS)
	private failures = 0;
	private lastFailure = "";
	private keepAlive: ReturnType<typeof setTimeout> | null = null;

	private readonly opts: DialogueOptions;

	constructor(opts: DialogueOptions) {
		this.opts = opts;
	}

	// at session start
	open(): void {
		if (this.state === "idle") void this.connect();
	}

	// resolves once, when the sentence ends
	speak(sentence: DialogueSentence): Promise<DialogueEnd> {
		return new Promise((end) => {
			if (this.state === "closed") return end("cancelled");
			const q: Queued = { sentence, stage: "waiting", offsetMs: 0, end };
			this.queue.push(q);
			if (this.state === "open") this.sendSentence(q);
			else if (this.state === "idle") void this.connect(); // the last connect gave up: try again
		});
	}

	// One cancel per id arrives on a barge-in. The first one that finds its id
	// in flight tears the socket down; the rest land during the reconnect and
	// only remove their ids, so there is never one reconnect per cancel. An id
	// not in the queue changes nothing.
	cancel(id: number): void {
		const i = this.queue.findIndex((q) => q.sentence.id === id);
		if (i < 0) return;
		const [q] = this.queue.splice(i, 1);
		q.end("cancelled");
		if (this.state === "open") this.restart(`terminated for cancel id=${id}`);
	}

	// Drops everything. The socket is torn down only if something was generating.
	cancelAll(): void {
		const all = this.queue.splice(0);
		for (const q of all) q.end("cancelled");
		if (this.state === "open" && all.length) this.restart(`terminated for cancelAll ids=${idList(all)}`);
	}

	// at session end: terminate, and nothing reopens
	close(): void {
		if (this.state === "closed") return;
		this.state = "closed";
		this.terminate();
		for (const q of this.queue.splice(0)) q.end("cancelled");
	}

	// read through a call: TypeScript would keep `state` narrowed across the awaits in connect()
	private closed(): boolean {
		return this.state === "closed";
	}

	private terminate(): void {
		if (this.keepAlive !== null) { clearTimeout(this.keepAlive); this.keepAlive = null; }
		const sock = this.sock;
		this.sock = null;
		this.live = null;
		if (sock) terminateQuietly(sock);
	}

	// A cancel or a drop: tear down and reopen. What was in flight is settled
	// when the new socket opens (or the connect gives up), so a cancel arriving
	// meanwhile can still take its id out first; the reconnect's line says what
	// became of each.
	private restart(why: string): void {
		this.terminate();
		for (const q of this.queue) if (q.stage === "forwarded") q.stage = "lost";
		this.opts.log(`${why}; in flight ids=${idList(this.queue)}`);
		void this.connect();
	}

	// any close we did not ask for, and any server error message
	private dropped(why: string): void {
		if (this.state !== "open") return;
		const stable = this.heard || Date.now() - this.openedAt >= STABLE_MS;
		this.failures = stable ? 0 : this.failures + 1;
		this.lastFailure = why;
		this.restart(`dropped: ${why}`);
	}

	private async connect(): Promise<void> {
		this.state = "connecting";
		const retry = this.opts.retryMs ?? RETRY_MS;
		for (;;) {
			if (this.failures > retry.length) break;
			if (this.failures > 0) {
				await sleep(retry[this.failures - 1]);
				if (this.closed()) return;
			}
			const t0 = Date.now();
			const token = {};
			let sock: DialogueSocket | null = null;
			try {
				sock = await this.dial(token);
			} catch (e) {
				this.lastFailure = errorText(e);
			}
			if (this.closed()) {
				if (sock) terminateQuietly(sock);
				return;
			}
			if (sock) return this.opened(sock, token, Date.now() - t0);
			this.failures++;
			this.opts.log(
				`connect failed in ${Date.now() - t0}ms (${this.lastFailure})` +
					(this.failures <= retry.length ? `; retry in ${retry[this.failures - 1]}ms` : ""),
			);
		}
		const attempts = this.failures;
		this.failures = 0; // the next sentence gets an attempt straight away
		this.state = "idle";
		const failed = this.queue.splice(0);
		this.opts.log(
			`gave up after ${attempts} failed attempts (${this.lastFailure}); ` +
				`error for ids=${idList(failed)}; the next sentence tries again`,
		);
		for (const q of failed) q.end({ error: q.stage === "lost" ? "tts_dropped" : "tts_connect" });
	}

	private dial(token: object): Promise<DialogueSocket> {
		const on: DialogueSocketEvents = {
			message: (d) => { if (this.live === token) this.onMessage(d); },
			close: (code, reason) => {
				if (this.live === token) this.dropped(`close ${code}${reason ? ` "${reason}"` : ""}`);
			},
		};
		const ms = this.opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
		return new Promise((resolve, reject) => {
			let late = false;
			const timer = setTimeout(() => { late = true; reject(new Error(`no answer in ${ms}ms`)); }, ms);
			this.opts.connect(on).then(
				(sock) => {
					clearTimeout(timer);
					if (late) terminateQuietly(sock);
					else resolve(sock);
				},
				(e) => { clearTimeout(timer); reject(e); },
			);
		});
	}

	private opened(sock: DialogueSocket, token: object, ms: number): void {
		this.sock = sock;
		this.live = token;
		this.state = "open";
		this.openedAt = Date.now();
		this.heard = false;
		const first = this.opens++ === 0;
		this.send({ voices: [this.opts.voiceId], voice_settings: this.opts.voiceSettings });
		if (this.state !== "open") return; // the first send already found it gone
		const lost = this.queue.filter((q) => q.stage === "lost");
		this.queue = this.queue.filter((q) => q.stage !== "lost");
		const again = this.queue.filter((q) => q.stage !== "waiting");
		this.opts.log(
			first
				? `connected in ${ms}ms`
				: `reconnected in ${ms}ms; re-sent ids=${idList(again)}, tts_dropped ids=${idList(lost)}`,
		);
		for (const q of lost) q.end({ error: "tts_dropped" });
		for (const q of [...this.queue]) this.sendSentence(q);
	}

	private sendSentence(q: Queued): void {
		if (this.state !== "open") return;
		const s = q.sentence;
		s.onSend();
		q.stage = "sent";
		q.offsetMs = 0;
		this.send({ inputs: [{ text: s.text, voice_id: this.opts.voiceId, new_turn: s.newTurn }] });
		this.send({ flush: true });
	}

	private send(msg: unknown): void {
		if (!this.sock) return;
		try {
			this.sock.send(JSON.stringify(msg));
		} catch (e) {
			this.dropped(`send failed (${errorText(e)})`);
			return;
		}
		if (this.keepAlive !== null) clearTimeout(this.keepAlive);
		this.keepAlive = setTimeout(() => {
			this.keepAlive = null;
			this.send({ keep_alive: true });
		}, this.opts.keepAliveMs ?? KEEP_ALIVE_MS);
	}

	private onMessage(data: string): void {
		let m: Record<string, unknown>;
		try { m = JSON.parse(data); } catch { return; }
		if (m.error) {
			this.dropped(`server error ${String(m.error)} ${String(m.code ?? "")}: ${String(m.message ?? "")}`);
			return;
		}
		const head = this.queue[0];
		if (head) {
			if (typeof m.audio === "string" && m.audio) {
				this.heard = true;
				head.stage = "forwarded";
				head.sentence.onAudio(m.audio);
			}
			const r = runningChunk(m.alignment, head.offsetMs);
			if (r) {
				head.stage = "forwarded";
				head.offsetMs = r.endMs;
				head.sentence.onAlignment(r.chunk);
			}
			if (m.is_final_audio_for_turn) {
				this.queue.shift();
				head.end("done");
			}
		}
		if (m.is_final) this.opts.log("is_final arrived, which only close_socket should cause");
	}
}

function terminateQuietly(sock: DialogueSocket): void {
	try { sock.terminate(); } catch { /* already gone */ }
}
