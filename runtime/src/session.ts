// One app connection: a single WebSocket for the whole conversation, with
// everything multiplexed over it:
//
//   app -> runtime
//     text  {t:"stt_start",utterance?} | {t:"stt_eos",utterance?} | {t:"stt_reset"}
//           {t:"llm",id,history,source?} | {t:"tts",id,text} | {t:"cancel",id}
//     bin   PCM16 16 kHz mic frames
//   runtime -> app
//     text  {t:"mode",text,v} | {t:"stt_partial"|"stt_final",text,utterance?}
//           {t:"llm_delta",id,text} | {t:"llm_done",id} | {t:"tts_done",id}
//           {t:"beat",id,bt,emotion,talk,gesture,camera} | {t:"emotion",id,emotion}
//           {t:"error",id,text}
//     bin   [id:u8][PCM16 24 kHz]  TTS audio, tagged so concurrent sentences demux
//
// The app owns the conversation: it sends the whole history with each `llm`,
// splits the reply into sentences, and asks for each one's audio with `tts`.
// So a turn here is one `llm` request and the `tts` requests that follow it,
// and the hooks fire on those messages:
//
//   on_session_start  the socket opens
//   before_reply      an `llm` arrives; runs alongside before_llm and the model
//   before_llm        an `llm` arrives; can change `prompt` and `messages`
//   after_llm         the reply has finished streaming
//   on_sentence       a `tts` arrives, while its audio is synthesized; the
//                     beats it returns are timed to the audio and sent as
//                     `beat` (or `emotion`) messages
//   on_speak          a sentence's audio and timing are complete
//   after_turn        the next `llm` arrives, the socket closes, or the reply
//                     and its sentences are done and nothing new came for a moment
//   on_session_end    the socket closes

import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { hasHook, runHook } from "./extensions.ts";
import type { Loaded } from "./extensions.ts";
import { LlmHttpError, streamChat } from "./llm.ts";
import { ELEVENLABS_KEY } from "./manifest.ts";
import type { Character } from "./manifest.ts";
import { STATE_SCHEMA } from "./state.ts";
import type { Beat, Message, State, Timing } from "./state.ts";
import { SttRelay } from "./stt.ts";
import { Tts } from "./tts.ts";
import { Alignment } from "./align.ts";
import { Leveler } from "./level.ts";
import type { AlignmentChunk } from "./align.ts";

const PROTOCOL_VERSION = 1;

// What a turn that makes no sound sends instead of nothing. The app waits ~12 s
// on a turn with no text before calling the model dead, so a cancelled turn
// sends this one character and `llm_done`. The app hands it back as a `tts`,
// which is dropped without a sound.
const SILENT_TURN = "…";

// How long a finished reply waits for more sentences before after_turn fires.
// The app sends a sentence's `tts` as a playback slot frees up, so most of a
// reply's sentences arrive after its `llm_done`.
const TURN_IDLE_MS = 1500;

interface Turn {
	id: number;
	state: State;
	llmDone: boolean;
	ttsInFlight: number;
	firstSentence: boolean; // its first `tts` has not arrived yet
	closed: boolean;
	idle: ReturnType<typeof setTimeout> | undefined;
}

function toMessages(history: unknown): Message[] {
	if (!Array.isArray(history)) return [];
	return history
		.filter((h): h is Message => typeof h?.role === "string" && typeof h?.content === "string")
		// the app's `interrupted` marker is not for the model
		.map((h) => ({ role: h.role, content: h.content }));
}

// One sentence while it is spoken: its voice timing so far, and the beats
// extensions handed back for it, waiting until their span is voiced.
interface Spoken {
	id: number;
	align: Alignment;
	line: string; // the sentence without its [tags], for placing an unvoiced span
	pending: Beat[];
	searchAt: number; // beats resolve in order, so a repeated phrase can't match backwards
	ended: boolean;
	cancelled: boolean;
}

// removes the listed [tags] from a sentence; the rest of it is left as written
function dropTags(text: string, tags: string[]): string {
	if (!tags.length) return text;
	return text
		.replace(/\[([a-zA-Z][a-zA-Z-]*)\]\s*/g, (tag, word: string) => (tags.includes(word.toLowerCase()) ? "" : tag))
		.trim();
}

const stripTags = (text: string) => text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();

function isBeat(b: unknown): b is Beat {
	return typeof b === "object" && b !== null && typeof (b as Beat).span === "string";
}

function pushTiming(t: Timing, a: AlignmentChunk): void {
	const chars = a.characters ?? [];
	const st = a.character_start_times_seconds ?? [];
	const en = a.character_end_times_seconds ?? [];
	for (let i = 0; i < chars.length && i < st.length; i++) {
		t.characters.push(chars[i]);
		t.starts.push(st[i]);
		t.ends.push(en[i] ?? st[i]);
	}
}

export function runSession(ws: WebSocket, character: Character, exts: Loaded[]): void {
	const sessionId = randomUUID();
	const log = (line: string) => console.log(`[${sessionId.slice(0, 8)}] ${line}`);
	const session: State["session"] = { id: sessionId, channel: "voice" };
	let closed = false;
	// extension data, carried from turn to turn for the whole session
	let ext: Record<string, unknown> = {};
	let turn: Turn | null = null;
	const llmStreams = new Map<number, AbortController>();
	const spoken = new Map<number, Spoken>();

	const send = (obj: unknown) => {
		if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
	};
	const sendAudio = (id: number, pcm: Buffer) => {
		if (ws.readyState === WebSocket.OPEN) ws.send(Buffer.concat([Buffer.from([id & 0xff]), pcm]));
	};
	const baseState = (): State => ({
		schema: STATE_SCHEMA,
		character: character.manifest,
		session: { ...session },
		ext,
	});
	// sentence hooks run side by side, so each hands back only its `ext`
	const mergeExt = (t: Turn, s: State) => { t.state.ext = { ...t.state.ext, ...s.ext }; };

	const elevenKey = process.env[ELEVENLABS_KEY] ?? "";
	const stt = new SttRelay(character.stt, elevenKey, send);
	const tts = new Tts(character.voice, elevenKey, (s) => log(`[tts] ${s}`));

	const closeTurn = async (t: Turn) => {
		if (t.closed) return;
		t.closed = true;
		clearTimeout(t.idle);
		ext = t.state.ext;
		const s = await runHook(exts, "after_turn", t.state, log);
		ext = s.ext;
		// a turn that began while this one's after_turn ran keeps its own writes
		if (turn && turn !== t) turn.state.ext = { ...s.ext, ...turn.state.ext };
	};
	// after_turn waits for the reply and every sentence of it, then a moment more
	const settle = (t: Turn) => {
		if (t.closed || !t.llmDone || t.ttsInFlight > 0) return;
		clearTimeout(t.idle);
		t.idle = setTimeout(() => void closeTurn(t), TURN_IDLE_MS);
	};

	send({ t: "mode", text: "companion", v: PROTOCOL_VERSION });
	tts.open();
	log(`open: ${character.id}, chat ${character.chat.model}, voice ${character.voice.model} on ${tts.transport}`);
	const started = runHook(exts, "on_session_start", baseState(), log).then((s) => { ext = s.ext; });

	const onLlm = async (id: number, history: unknown, source: unknown) => {
		await started;
		if (turn) void closeTurn(turn);
		const messages = toMessages(history);
		const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
		const channel = source === "chat" || source === "screen" ? source : "voice";
		const t: Turn = {
			id,
			state: { ...baseState(), turn: id, input: { text: lastUser, channel }, messages, prompt: character.prompt },
			llmDone: false,
			ttsInFlight: 0,
			firstSentence: true,
			closed: false,
			idle: undefined,
		};
		turn = t;
		const ac = new AbortController();
		llmStreams.set(id, ac);
		const finish = (how: string) => {
			llmStreams.delete(id);
			t.llmDone = true;
			log(`turn ${id}: ${how}`);
			settle(t);
		};
		const silent = () => {
			t.state.cancel = true;
			send({ t: "llm_delta", id, text: SILENT_TURN });
			send({ t: "llm_done", id });
			finish("cancelled, nothing spoken");
		};

		// before_reply works on its own copy; only its `cancel` is kept
		const replyCancelled = hasHook(exts, "before_reply")
			? runHook(exts, "before_reply", t.state, log).then((s) => s.cancel === true)
			: Promise.resolve(false);

		t.state = await runHook(exts, "before_llm", t.state, log);
		if (closed) return;
		if (ac.signal.aborted) return finish("cut off by the app");
		if (t.state.cancel === true) return silent();

		// The reply streams as it is written, but nothing reaches the app until
		// before_reply has decided.
		let decided = false;
		const held: string[] = [];
		void replyCancelled.then((cancel) => {
			decided = true;
			if (cancel) {
				ac.abort();
				return;
			}
			// the app cut the turn off while it waited; what was held stays unsent
			if (ac.signal.aborted) return;
			for (const text of held) send({ t: "llm_delta", id, text });
			held.length = 0;
		});

		let reply = "";
		let failure: string | null = null;
		try {
			const apiKey = process.env[character.chat.api_key_env] ?? "";
			const request: Message[] = [{ role: "system", content: t.state.prompt ?? "" }, ...(t.state.messages ?? [])];
			for await (const text of streamChat(character.chat, apiKey, request, ac.signal)) {
				if (closed) break;
				reply += text;
				if (decided) send({ t: "llm_delta", id, text });
				else held.push(text);
			}
		} catch (e) {
			if (!ac.signal.aborted) failure = e instanceof LlmHttpError ? `llm_${e.status}` : "llm_network";
		}
		const cancelled = await replyCancelled;
		if (closed) return;
		if (cancelled) return silent();
		t.state.reply = reply;
		if (failure) {
			t.state.error = failure;
			send({ t: "error", id, text: failure });
			return finish(`failed: ${failure}`);
		}
		// a barge-in: the app tore the turn down and is not waiting for llm_done
		if (ac.signal.aborted) return finish("cut off by the app");
		send({ t: "llm_done", id });
		t.state = await runHook(exts, "after_llm", t.state, log);
		finish(`replied, ${reply.length} chars`);
	};

	// A beat that only changes the face at the start goes out as `emotion`, so it
	// lands at once; any other beat is a `beat` timed into the sentence's audio.
	const sendBeat = (id: number, b: Beat, bt: number) => {
		if (b.emotion && bt === 0 && !b.register && !b.gesture && !b.camera) {
			send({ t: "emotion", id, emotion: b.emotion });
			return;
		}
		send({
			t: "beat",
			id,
			bt,
			emotion: b.emotion ?? "",
			talk: b.register ?? "",
			gesture: b.gesture ?? "none",
			camera: b.camera ?? "none",
		});
	};
	// Sends every pending beat whose span has been voiced. Once the audio is
	// complete, a span that never matched is placed by where it sits in the text.
	const flushBeats = (sp: Spoken) => {
		while (sp.pending.length && !sp.cancelled && !closed) {
			const b = sp.pending[0];
			let bt = 0;
			if (b.span.trim()) {
				const hit = sp.align.find(b.span, sp.searchAt);
				if (hit) {
					bt = hit.t;
					sp.searchAt = hit.projEnd;
				} else if (sp.ended) {
					const at = sp.line.indexOf(b.span);
					bt = sp.align.approx(at >= 0 && sp.line.length ? at / sp.line.length : 0);
				} else {
					return;
				}
			}
			sp.pending.shift();
			sendBeat(sp.id, b, bt);
		}
	};

	const onTts = async (id: number, text: string) => {
		if (!text || text.trim() === SILENT_TURN) return;
		const t = turn && !turn.closed ? turn : null;
		// the reply's first sentence starts a new turn on the dialogue socket
		const newTurn = t?.firstSentence ?? false;
		if (t) {
			t.ttsInFlight++;
			clearTimeout(t.idle);
			if (t.firstSentence) {
				t.firstSentence = false;
				// The app holds the start of a reply, up to 2 s, until a beat for it
				// arrives. An empty one changes nothing and lets the audio start.
				send({ t: "beat", id, bt: 0, emotion: "", talk: "", gesture: "", camera: "" });
			}
		}
		const sp: Spoken = {
			id,
			align: new Alignment(),
			line: stripTags(text),
			pending: [],
			searchAt: 0,
			ended: false,
			cancelled: false,
		};
		spoken.set(id, sp);
		// each extension's beats go out as soon as it returns, so a fast one is
		// not held back by a slow one after it
		if (t && hasHook(exts, "on_sentence")) {
			const takeBeats = (s: State): State => {
				if (Array.isArray(s.beats)) {
					sp.pending.push(...s.beats.filter(isBeat));
					flushBeats(sp);
				}
				return { ...s, beats: [] };
			};
			void runHook(exts, "on_sentence", { ...t.state, sentence: text, beats: [] }, log, takeBeats).then((s) =>
				mergeExt(t, s),
			);
		}
		const timing: Timing = { characters: [], starts: [], ends: [] };
		// delivery tags come back at very different loudness; this evens them out
		const leveler = new Leveler();
		const sendLeveled = (pcm: Buffer) => { if (pcm.length) sendAudio(id, pcm); };
		const end = await tts.speak({
			id,
			text: dropTags(text, character.voice.drop_tags),
			newTurn,
			onAudio: (pcm) => sendLeveled(leveler.process(pcm)),
			onAlignment: (a) => {
				pushTiming(timing, a);
				sp.align.push(a);
				flushBeats(sp);
			},
		});
		spoken.delete(id);
		if (end === "cancelled") sp.cancelled = true;
		sp.ended = true;
		flushBeats(sp);
		if (end === "done") {
			// the start of a sentence is held until it is leveled
			sendLeveled(leveler.flush());
			send({ t: "tts_done", id });
			if (t && hasHook(exts, "on_speak"))
				void runHook(exts, "on_speak", { ...t.state, sentence: text, timing }, log).then((s) => mergeExt(t, s));
		} else if (end !== "cancelled") {
			// no tts_done after an error: the app retries the sentence on the same id
			send({ t: "error", id, text: end.error });
			log(`sentence ${id}: ${end.error}`);
			if (t) t.state.error = end.error;
		}
		if (t) {
			t.ttsInFlight--;
			settle(t);
		}
	};

	const cancel = (id: number) => {
		llmStreams.get(id)?.abort();
		const sp = spoken.get(id);
		if (sp) sp.cancelled = true;
		tts.cancel(id);
	};

	ws.on("message", (data, isBinary) => {
		if (closed) return;
		if (isBinary) {
			stt.audio(data as Buffer);
			return;
		}
		let msg: Record<string, unknown>;
		try {
			msg = JSON.parse(data.toString());
		} catch {
			return;
		}
		switch (msg.t) {
			case "stt_start": stt.start(msg.utterance); break;
			case "stt_eos": stt.endOfSpeech(msg.utterance); break;
			case "stt_reset": stt.reset(); break;
			case "llm": void onLlm(msg.id as number, msg.history, msg.source); break;
			case "tts": void onTts(msg.id as number, typeof msg.text === "string" ? msg.text : ""); break;
			case "cancel": cancel(msg.id as number); break;
		}
	});

	const teardown = async (reason: string) => {
		if (closed) return;
		closed = true;
		tts.close();
		for (const ac of llmStreams.values()) ac.abort();
		stt.close();
		if (turn) await closeTurn(turn);
		await runHook(exts, "on_session_end", { ...baseState(), session: { ...session, end_reason: reason } }, log);
		log(`closed: ${reason}`);
	};
	ws.on("close", () => void teardown("the app disconnected"));
	ws.on("error", () => void teardown("the connection failed"));
}
