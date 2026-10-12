// The character's chat model, as `models.chat` names it. Two request formats,
// picked by `api`; everything else (where, which key, which model) comes from
// the manifest, so adding a provider never touches this file.
//
//   chat_completions  <base_url>/chat/completions  xAI, OpenAI, any compatible server
//   responses         <base_url>/responses         OpenAI's Responses API
//
// The responses request sends the system
// prompt as `instructions`, the conversation as `input`, `store: false`, and
// one `prompt_cache_key`, so the long system prompt, the same on every turn,
// lands on a server that already has it. Reasoning models reject
// `temperature`, and their reasoning spends the same `max_output_tokens` the
// answer does, so a responses call gets headroom on top of `max_tokens`.

import type { ChatModel } from "./manifest.ts";
import type { Message } from "./state.ts";

// room for the thinking before the answer; a guess, not measured
const REASONING_HEADROOM = 2000;
const PROMPT_CACHE_KEY = "character";

export class LlmHttpError extends Error {
	readonly status: number;
	constructor(status: number) {
		super(`the model answered HTTP ${status}`);
		this.status = status;
	}
}

function request(m: ChatModel, messages: Message[]): { url: string; body: Record<string, unknown> } {
	const { temperature, max_tokens, reasoning_effort } = m.params;
	if (m.api === "chat_completions")
		return {
			url: `${m.base_url}/chat/completions`,
			body: {
				model: m.model,
				stream: true,
				messages,
				...(temperature !== undefined ? { temperature } : {}),
				...(max_tokens !== undefined ? { max_completion_tokens: max_tokens } : {}),
			},
		};
	const instructions = messages.filter((x) => x.role === "system").map((x) => x.content).join("\n\n");
	return {
		url: `${m.base_url}/responses`,
		body: {
			model: m.model,
			stream: true,
			...(instructions ? { instructions } : {}),
			input: messages.filter((x) => x.role !== "system"),
			...(reasoning_effort !== undefined ? { reasoning: { effort: reasoning_effort } } : {}),
			...(max_tokens !== undefined ? { max_output_tokens: max_tokens + REASONING_HEADROOM } : {}),
			store: false,
			prompt_cache_key: PROMPT_CACHE_KEY,
		},
	};
}

// The text one streamed `data:` payload adds, if any.
function delta(m: ChatModel, j: unknown): string {
	if (m.api === "chat_completions")
		return (j as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content ?? "";
	const e = j as { type?: string; delta?: string };
	return e.type === "response.output_text.delta" ? e.delta ?? "" : "";
}

// Yields the reply as it streams. Throws LlmHttpError on a non-2xx answer, and
// whatever fetch throws on a network failure or an abort.
export async function* streamChat(
	m: ChatModel,
	apiKey: string,
	messages: Message[],
	signal: AbortSignal,
): AsyncGenerator<string> {
	const { url, body } = request(m, messages);
	const resp = await fetch(url, {
		method: "POST",
		signal,
		headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok || !resp.body) throw new LlmHttpError(resp.status);
	const dec = new TextDecoder();
	let buf = "";
	for await (const chunk of resp.body) {
		buf += dec.decode(chunk, { stream: true });
		let nl: number;
		while ((nl = buf.indexOf("\n")) >= 0) {
			const line = buf.slice(0, nl).trim();
			buf = buf.slice(nl + 1);
			if (!line.startsWith("data:")) continue;
			const data = line.slice(5).trim();
			if (data === "[DONE]") continue;
			let j: unknown;
			try { j = JSON.parse(data); } catch { continue; }
			const d = delta(m, j);
			if (d) yield d;
		}
	}
}
