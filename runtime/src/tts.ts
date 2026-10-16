// The character's voice: one sentence in, streamed PCM and per-character timing
// out. ElevenLabs is the only provider. The connection is picked from the model:
// eleven_v3* and eleven_v4* use one Text to Dialogue socket per session
// (tts_dialogue.ts), anything else one streamed HTTP request per sentence.

import { DialogueTts, wsDialogueConnect } from "./tts_dialogue.ts";
import type { AlignmentChunk } from "./align.ts";
import type { DialogueEnd } from "./tts_dialogue.ts";
import type { Voice } from "./manifest.ts";

export const OUTPUT_FORMAT = "pcm_24000";

export interface SpeakRequest {
	id: number;
	text: string;
	newTurn: boolean; // the reply's first sentence
	onAudio: (pcm: Buffer) => void;
	onAlignment: (chunk: AlignmentChunk) => void;
}

// done: all audio arrived. cancelled: no tts_done. error: what the app gets instead.
export type SpeakEnd = DialogueEnd;

export class Tts {
	private readonly voice: Voice;
	private readonly apiKey: string;
	private readonly dialogue: DialogueTts | null;
	private readonly http = new Map<number, AbortController>();

	constructor(voice: Voice, apiKey: string, log: (line: string) => void) {
		this.voice = voice;
		this.apiKey = apiKey;
		this.dialogue = /^eleven_v[34]/.test(voice.model)
			? new DialogueTts({
					connect: wsDialogueConnect(apiKey, OUTPUT_FORMAT, voice.model),
					voiceId: voice.voice_id,
					voiceSettings: voice.params,
					log,
				})
			: null;
	}

	get transport(): string {
		return this.dialogue ? "dialogue" : "http";
	}

	// at session start, so the first reply does not pay the connect
	open(): void {
		this.dialogue?.open();
	}

	speak(req: SpeakRequest): Promise<SpeakEnd> {
		if (this.dialogue)
			return this.dialogue.speak({
				id: req.id,
				text: req.text,
				newTurn: req.newTurn,
				onSend: () => {},
				onAudio: (b64) => req.onAudio(Buffer.from(b64, "base64")),
				onAlignment: req.onAlignment,
			});
		return this.speakHttp(req);
	}

	cancel(id: number): void {
		this.dialogue?.cancel(id);
		this.http.get(id)?.abort();
	}

	cancelAll(): void {
		this.dialogue?.cancelAll();
		for (const ac of this.http.values()) ac.abort();
	}

	close(): void {
		this.dialogue?.close();
		for (const ac of this.http.values()) ac.abort();
	}

	// with-timestamps streams newline-delimited JSON, each line a base64 audio
	// chunk plus the alignment for exactly those samples. Audio is forwarded the
	// instant it lands.
	private async speakHttp(req: SpeakRequest): Promise<SpeakEnd> {
		const ac = new AbortController();
		this.http.set(req.id, ac);
		try {
			const resp = await fetch(
				`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voice.voice_id)}` +
					`/stream/with-timestamps?output_format=${OUTPUT_FORMAT}`,
				{
					method: "POST",
					signal: ac.signal,
					headers: { "xi-api-key": this.apiKey, "content-type": "application/json" },
					body: JSON.stringify({ text: req.text, model_id: this.voice.model, voice_settings: this.voice.params }),
				},
			);
			if (!resp.ok || !resp.body) return { error: `tts_${resp.status}` };
			const dec = new TextDecoder();
			let buf = "";
			const line = (raw: string) => {
				const s = raw.trim();
				if (!s) return;
				let j: Record<string, unknown>;
				try { j = JSON.parse(s); } catch { return; }
				if (typeof j.audio_base64 === "string" && j.audio_base64) req.onAudio(Buffer.from(j.audio_base64, "base64"));
				const a = (j.alignment ?? j.normalized_alignment) as AlignmentChunk | null | undefined;
				if (a) req.onAlignment(a);
			};
			for await (const chunk of resp.body) {
				buf += dec.decode(chunk, { stream: true });
				let nl: number;
				while ((nl = buf.indexOf("\n")) >= 0) {
					line(buf.slice(0, nl));
					buf = buf.slice(nl + 1);
				}
			}
			line(buf);
			return "done";
		} catch {
			// an abort is a cancel, not something the app should retry
			return ac.signal.aborted ? "cancelled" : { error: "tts_network" };
		} finally {
			// the app may have reused the id for a newer sentence
			if (this.http.get(req.id) === ac) this.http.delete(req.id);
		}
	}
}
