// A small client for Typesafe's Jev, the judge the memory asks. One POST to
// `<base_url>/systemone` answers several questions about one situation:
//
//   in:  { model, state, questions: { id: question } }
//   out: { answers: { id: answer }, usage }
//
// Jev never writes text: a choice comes back as one of the option keys it was
// offered, a score as a level, each with the probabilities behind it. So what
// the memory keeps is always something the user said, never something Jev made
// up.

export interface Model {
	base_url: string;
	api_key_env: string;
	model: string;
}

export type Question =
	| { type: "choice"; instructions: string; criteria: Record<string, string> }
	| { type: "score"; instructions: string; criteria: string[] } // ordered levels, 0 first
	| { type: "noul"; instructions: string; criteria: { true: string; false: string } };

// Fields Jev adds that the memory doesn't read (`type`, `legend`) are ignored.
export interface Answer {
	choice?: string;
	confidence?: number;
	score?: number;
	noul?: boolean;
	probabilities: Record<string, number>;
}

// An answer is a few kilobytes; anything near this is not an answer.
const MAX_BODY = 1 << 20;

export async function ask(
	m: Model,
	state: unknown,
	questions: Record<string, Question>,
	deadlineMs: number,
): Promise<Record<string, Answer>> {
	const key = process.env[m.api_key_env];
	if (!key) throw new Error(`${m.api_key_env} is not set`);
	// whatever a server or the network says back, the key never reaches a log
	const fail = (msg: string) => new Error(msg.split(key).join("***"));
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), deadlineMs);
	const late = () => fail(`Jev didn't answer in ${deadlineMs} ms`);
	try {
		let resp: Response;
		try {
			resp = await fetch(`${m.base_url.replace(/\/+$/, "")}/systemone`, {
				method: "POST",
				signal: ac.signal,
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
				body: JSON.stringify({ model: m.model, state, questions }),
			});
		} catch (e) {
			if (ac.signal.aborted) throw late();
			throw fail(`couldn't reach Jev: ${e instanceof Error ? e.message : String(e)}`);
		}
		let text: string;
		try {
			text = await readCapped(resp, MAX_BODY);
		} catch (e) {
			if (ac.signal.aborted) throw late();
			throw fail(e instanceof TooBig ? `Jev's answer is over ${MAX_BODY} bytes` : "Jev's answer was cut off");
		}
		if (!resp.ok) throw fail(`Jev answered HTTP ${resp.status}${detail(text.split(key).join("***"))}`);
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			throw fail("Jev's answer is not JSON");
		}
		const answers = (body as { answers?: unknown } | null)?.answers;
		if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw fail("Jev's answer has no `answers`");
		return answers as Record<string, Answer>;
	} finally {
		clearTimeout(timer);
	}
}

class TooBig extends Error {}

// the body as text, given up past `max` bytes rather than held in memory whole
async function readCapped(resp: Response, max: number): Promise<string> {
	if (!resp.body) return "";
	const reader = resp.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > max) {
			await reader.cancel().catch(() => undefined);
			throw new TooBig();
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString("utf8");
}

// what an error answer says, short, so a log line stays a line
function detail(text: string): string {
	let msg = text.slice(0, 2000);
	try {
		const j = JSON.parse(text) as { error?: { message?: unknown } | string; message?: unknown };
		const m = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message);
		if (typeof m === "string") msg = m;
	} catch {
		// not JSON; show the text
	}
	msg = msg.replace(/\s+/g, " ").trim();
	if (!msg) return "";
	return `: ${msg.length > 200 ? `${msg.slice(0, 200)}…` : msg}`;
}
