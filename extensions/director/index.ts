// Stages each spoken sentence as beats: the emotion the character performs,
// the talking style her body loops through, an optional gesture and an
// optional camera move, each anchored to the phrase where it starts. A second
// model call picks the words from the character's vocabulary; the runtime
// times them to the voice.
//
// Calls are serialized per session, so each sentence sees what the previous
// ones spent (camera moves, gestures, intense emotions) and which talking style
// is running. A failed or late call means no beats for that sentence, never a
// wrong one.
//
// config (usually a character's director.yaml):
//   model:     { base_url, api_key_env, model }   an OpenAI-compatible chat model
//   emotions:  { name: hint }                     the emotion words, with what each means
//   intense:   [ ... ]                            peak-only emotions
//   registers, gestures, cameras: [ ... ]         the other words
//   limits:    { cameras, intense }               per reply
//   tags:      { tag: emotion }                   synonyms a near-miss word maps through
//   prompt:    the director's instructions

interface Beat {
	span: string;
	emotion: string; // "" = carry over the previous beat's
	register: string; // "" = carry over; "none" = a reaction beat, the gesture is the body
	gesture: string; // "none" = nothing
	camera: string; // "none" = leave the camera alone
}

interface Config {
	model: { base_url: string; api_key_env: string; model: string };
	emotions: Record<string, string>;
	intense?: string[];
	registers?: string[];
	gestures?: string[];
	cameras?: string[];
	limits?: { cameras?: number; intense?: number };
	tags?: Record<string, string>;
	prompt: string;
}

interface Input {
	event: string;
	state: {
		session: { id: string };
		turn?: number;
		sentence?: string;
		beats?: unknown[];
	};
	config: Config;
}

// what the reply has spent so far, so sparsity holds across its sentences
interface Budget {
	beats: number;
	cameras: number;
	gestures: number;
	intense: number;
	lastGesture: string;
	lastRegister: string;
}

interface Session {
	turn: number | undefined;
	budget: Budget;
	spoken: string; // this reply's sentences already staged, for context
	chain: Promise<unknown>;
}

const sessions = new Map<string, Session>();

const newBudget = (): Budget => ({ beats: 0, cameras: 0, gestures: 0, intense: 0, lastGesture: "none", lastRegister: "" });

// delivery tags are the speaking model's hints, not director words: left in,
// the director echoes them back and quotes spans that were never voiced
const stripTags = (text: string) =>
	text.replace(/\[[a-zA-Z][a-zA-Z ,_'-]*\]/g, " ").replace(/^[\s.!?,;:—-]+/, "").replace(/\s+/g, " ").trim();

const list = (a: readonly string[]) => a.map((s) => `\`${s}\``).join(" ");

function systemPrompt(c: Config): string {
	const hints = Object.entries(c.emotions)
		.filter(([, hint]) => hint)
		.map(([name, hint]) => `- \`${name}\` — ${hint}`)
		.join("\n");
	return (
		c.prompt +
		`\n## Vocabularies (the ONLY legal words)\n\n` +
		`**emotion**: ${list(Object.keys(c.emotions))}\n` +
		(hints ? `\nWhat each one means:\n${hints}\n` : "") +
		`\nUse the whole range; staging every beat with the same few emotions wastes the palette.\n\n` +
		(c.intense?.length
			? `These are the INTENSE ones, peak-only and capped at ${c.limits?.intense ?? 2} per reply: ${list(c.intense)}\n\n`
			: "") +
		`**register**: ${list(c.registers ?? [])} — or \`none\` for a reaction beat.\n\n` +
		`**gesture**: ${list(c.gestures ?? [])} — or \`none\`.\n\n` +
		`**camera**: ${list(c.cameras ?? [])} — or \`none\`.\n`
	);
}

function continuity(b: Budget, c: Config): string {
	const cameras = c.limits?.cameras ?? 1;
	const intense = c.limits?.intense ?? 2;
	return (
		`CONTINUITY — register currently running: ${b.lastRegister || "none yet"}` +
		` (default to continuing it). beats staged so far this reply: ${b.beats}.` +
		` camera moves used: ${b.cameras}/${cameras}. gestures used: ${b.gestures}.` +
		` intense emotions used: ${b.intense}/${intense}. previous beat's gesture: ${b.lastGesture}.` +
		(b.cameras >= cameras ? ` CAMERA BUDGET IS SPENT — every camera must be "none".` : "")
	);
}

function parseJson(text: string): unknown {
	const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
	try {
		return JSON.parse(t);
	} catch {
		const a = t.indexOf("{");
		const b = t.lastIndexOf("}");
		if (a >= 0 && b > a) {
			try {
				return JSON.parse(t.slice(a, b + 1));
			} catch {
				// give up
			}
		}
	}
	return null;
}

// keeps only legal words; a near-miss emotion goes through the tag synonyms
function coerce(raw: unknown, c: Config): Beat[] {
	const arr = (raw as { beats?: unknown } | null)?.beats;
	if (!Array.isArray(arr)) return [];
	const emotions = Object.keys(c.emotions);
	const legal = (words: string[] | undefined, none: boolean) => (w: string) =>
		(none && w === "none") || (words ?? []).includes(w);
	const pick = (v: unknown, ok: (w: string) => boolean, fallback: string) => {
		const w = typeof v === "string" ? v.trim().toLowerCase() : "";
		if (!w) return fallback;
		if (ok(w)) return w;
		const synonym = c.tags?.[w];
		return synonym && ok(synonym) ? synonym : fallback;
	};
	const out: Beat[] = [];
	for (const it of arr) {
		const o = it as Record<string, unknown>;
		if (!o || typeof o.span !== "string" || !o.span) continue;
		const beat: Beat = {
			span: o.span,
			emotion: pick(o.emotion, legal(emotions, false), ""),
			register: pick(o.register, legal(c.registers, true), ""),
			gesture: pick(o.gesture, legal(c.gestures, true), "none"),
			camera: pick(o.camera, legal(c.cameras, true), "none"),
		};
		// a reaction beat with no gesture would freeze the body; keep it talking
		if (beat.register === "none" && beat.gesture === "none") beat.register = "";
		out.push(beat);
	}
	return out;
}

function spend(b: Budget, beats: Beat[], c: Config): void {
	for (const beat of beats) {
		b.beats++;
		if (beat.camera !== "none") b.cameras++;
		if (beat.gesture !== "none") {
			b.gestures++;
			b.lastGesture = beat.gesture;
		} else {
			b.lastGesture = "none";
		}
		if (c.intense?.includes(beat.emotion)) b.intense++;
		if (beat.register) b.lastRegister = beat.register;
	}
}

async function stage(line: string, s: Session, c: Config): Promise<Beat[]> {
	const user =
		`ALREADY SPOKEN (context only — do not stage this):\n${s.spoken || "(this is the opening)"}\n\n` +
		`${continuity(s.budget, c)}\n\n` +
		`STAGE THIS PASSAGE (spans must be exact substrings of it):\n${line}`;
	const resp = await fetch(`${c.model.base_url.replace(/\/+$/, "")}/chat/completions`, {
		method: "POST",
		signal: AbortSignal.timeout(7000),
		headers: {
			Authorization: `Bearer ${process.env[c.model.api_key_env] ?? ""}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: c.model.model,
			temperature: 0.4,
			max_completion_tokens: 900,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: systemPrompt(c) },
				{ role: "user", content: user },
			],
		}),
	});
	if (!resp.ok) throw new Error(`the director model answered HTTP ${resp.status}`);
	const j = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
	return coerce(parseJson(j.choices?.[0]?.message?.content ?? ""), c);
}

export default async function ({ event, state, config }: Input) {
	if (event === "on_session_end") {
		sessions.delete(state.session.id);
		return;
	}
	const line = stripTags(state.sentence ?? "");
	if (event !== "on_sentence" || !line) return;
	let s = sessions.get(state.session.id);
	if (!s) {
		s = { turn: state.turn, budget: newBudget(), spoken: "", chain: Promise.resolve() };
		sessions.set(state.session.id, s);
	}
	const session = s;
	const run = session.chain.then(async () => {
		// a new reply starts a new budget; the talking style carries over
		if (session.turn !== state.turn) {
			session.turn = state.turn;
			session.budget = { ...newBudget(), lastRegister: session.budget.lastRegister };
			session.spoken = "";
		}
		const beats = await stage(line, session, config);
		spend(session.budget, beats, config);
		session.spoken = `${session.spoken} ${line}`.trim();
		return beats;
	});
	session.chain = run.catch(() => {});
	const beats = await run;
	if (!beats.length) return;
	return { state: { ...state, beats: [...(state.beats ?? []), ...beats] } };
}
