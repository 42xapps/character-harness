// Speech to text: the app's mic audio relayed to ElevenLabs Scribe, and its
// transcripts relayed back, in these messages:
//
//   app -> runtime   {t:"stt_start",utterance?} | {t:"stt_eos",utterance?} | {t:"stt_reset"}
//                    binary PCM16 16 kHz mic frames
//   runtime -> app   {t:"stt_partial",text,utterance?} | {t:"stt_final",text,utterance?}
//                    {t:"error",id:0,text:"stt_upstream"}
//
// Without an utterance number one upstream socket is reused across utterances
// and each commit yields a final. With one (stt_start carrying `utterance`),
// each utterance gets its own upstream, auto-committed segments are collected,
// and the first final after the commit carries all of them and closes it.

import WebSocket from "ws";
import type { Stt } from "./manifest.ts";

const MIC_QUEUE_MAX = 256;

export class SttRelay {
	private readonly url: string;
	private readonly apiKey: string;
	private readonly send: (obj: unknown) => void;
	private sock: WebSocket | null = null;
	private opening = false;
	private closed = false;
	private generation = 0;
	private utterance: number | undefined;
	private commitPending = false;
	// when the last commit went out; the first final after it answers it
	private commitAt: number | null = null;
	private readonly micQueue: string[] = [];
	private commitUtterance = () => { this.commitPending = true; };

	constructor(stt: Stt, apiKey: string, send: (obj: unknown) => void) {
		this.apiKey = apiKey;
		this.send = send;
		const qs = new URLSearchParams({
			model_id: stt.model,
			audio_format: "pcm_16000",
			commit_strategy: "manual",
			include_timestamps: "true",
		});
		if (stt.language) qs.set("language_code", stt.language);
		for (const k of stt.keyterms) qs.append("keyterms", k);
		this.url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${qs}`;
	}

	start(utterance: unknown): void {
		if (Number.isSafeInteger(utterance) && (utterance as number) > 0) this.reset(utterance as number);
		void this.open();
	}

	endOfSpeech(utterance: unknown): void {
		if (this.utterance === undefined) this.commit();
		else if (utterance === this.utterance) this.commitUtterance();
	}

	reset(utterance?: number): void {
		this.generation++;
		if (this.sock) this.sock.terminate();
		this.sock = null;
		this.opening = false;
		this.utterance = utterance;
		this.micQueue.length = 0;
		this.commitAt = null;
		this.commitPending = false;
		this.commitUtterance = () => { this.commitPending = true; };
	}

	audio(frame: Buffer): void {
		const b64 = frame.toString("base64");
		if (!this.isOpen()) {
			this.micQueue.push(b64);
			if (this.micQueue.length > MIC_QUEUE_MAX) this.micQueue.shift();
			void this.open();
			return;
		}
		this.push(b64);
	}

	close(): void {
		this.closed = true;
		this.sock?.terminate();
		this.sock = null;
	}

	private isOpen(): boolean {
		return this.sock !== null && this.sock.readyState === WebSocket.OPEN;
	}

	private push(b64: string): void {
		if (!this.isOpen()) return;
		this.sock!.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: b64, commit: false, sample_rate: 16000 }));
	}

	private commit(): void {
		if (!this.isOpen()) return;
		this.commitAt = Date.now();
		this.sock!.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: 16000 }));
	}

	private async open(): Promise<void> {
		if (this.sock || this.opening || this.closed) return;
		this.opening = true;
		const generation = this.generation;
		const utterance = this.utterance;
		let committed = false;
		const segments: string[] = [];
		const sock = new WebSocket(this.url, { headers: { "xi-api-key": this.apiKey } });
		sock.on("error", () => { if (this.sock === sock) this.sock = null; });
		const ok = await new Promise<boolean>((resolve) => {
			sock.once("open", () => resolve(true));
			sock.once("error", () => resolve(false));
		});
		if (generation !== this.generation || this.closed) {
			sock.terminate();
			return;
		}
		this.opening = false;
		if (!ok) {
			this.send({ t: "error", id: 0, text: "stt_upstream" });
			return;
		}
		this.sock = sock;
		sock.on("message", (data, isBinary) => {
			if (this.closed || generation !== this.generation || isBinary) return;
			let m: Record<string, unknown>;
			try { m = JSON.parse(data.toString()); } catch { return; }
			const text = typeof m.text === "string" ? m.text : "";
			const tag = utterance === undefined ? {} : { utterance };
			if (m.message_type === "partial_transcript") {
				this.send({ t: "stt_partial", text, ...tag });
			} else if (m.message_type === "committed_transcript_with_timestamps") {
				// auto-committed segments belong to this socket's utterance, never a later one
				if (utterance !== undefined) {
					if (!committed) { segments.push(text); return; }
					if (this.commitAt === null) return;
				}
				// the first final after a commit is the one the person waited on
				this.commitAt = null;
				const final = utterance === undefined ? text : [...segments, text].filter(Boolean).join(" ");
				this.send({ t: "stt_final", text: final, ...tag });
				if (utterance !== undefined) sock.terminate();
			}
		});
		sock.on("close", () => { if (this.sock === sock) this.sock = null; });
		while (this.micQueue.length) this.push(this.micQueue.shift()!);
		this.commitUtterance = () => { committed = true; this.commit(); };
		if (this.commitPending) {
			this.commitPending = false;
			this.commitUtterance();
		}
	}
}
