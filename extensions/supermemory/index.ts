import type { HookInput } from "../../runtime/src/extensions.ts";
import { config, credentials } from "./config.ts";
import { Provider } from "./provider.ts";
import { Store } from "./store.ts";
import { MemoryService } from "./service.ts";
import { renderMemory } from "./prompt.ts";

const services = new Map<string, { signature: string; service: MemoryService }>();
export function check({ config: raw }: { config: unknown }) {
	try {
		const c = config(raw);
		if (c.enabled) {
			if (!c.qualified) return { errors: [], warnings: ["Supermemory qualification has not passed; memory is inactive"] };
			credentials(c);
		}
		return { errors: [], warnings: [] };
	} catch (e) { return { errors: [e instanceof Error ? e.message : "Invalid memory config"], warnings: [] }; }
}
export default async function memory({ event, state, config: raw }: HookInput): Promise<{ state: HookInput["state"] } | void> {
	const c = config(raw);
	if (!c.enabled || !c.qualified || !state.session.principal) return;
	const signature = JSON.stringify(c);
	let entry = services.get(c.dir);
	if (entry && entry.signature !== signature) throw new Error("Different memory configurations cannot share a journal directory");
	if (!entry) {
		const { apiKey, encryptionKey } = credentials(c);
		entry = { signature, service: new MemoryService(c, new Store(c.dir, encryptionKey), new Provider(c, apiKey)) };
		services.set(c.dir, entry);
	}
	const service = entry.service;
	const p = state.session.principal;
	if (event === "on_session_start") { await service.getProfile(p); return; }
	if (event === "before_llm") {
		const input = state.input_event;
		const retained = input && service.enqueueConversation(p, { id: input.id, sessionId: state.session.id, date: input.accepted_at,
			text: state.input?.text ?? "", channel: state.input?.channel ?? "unknown", timezone: state.context?.profile?.timezone });
		const previous = (state.messages ?? []).filter((m) => m.role === "user").slice(-3, -1).map((m) => m.content.slice(0, 250));
		const recalled = await service.recall(p, [...previous, state.input?.text ?? ""].join("\n"));
		const block = renderMemory(recalled.entries, c.prompt_tokens);
		if (c.log_events) console.info("[supermemory]", JSON.stringify({ event: "context_prepared", entries: recalled.entries.length, context_bytes: Buffer.byteLength(block), availability: recalled.availability }));
		const generation = service.status(p).relationship.generation;
		return { state: { ...state, prompt: (state.prompt ?? "") + block,
			ext: { ...state.ext, supermemory: { retained: !!retained, event_id: input?.id, generation, availability: recalled.availability } } } };
	}
	if (event === "after_turn" && state.input_event) {
		// Capture is identified by its durable event ID, never the app's reusable turn ID.
		// The generation stored before generation prevents deleted inputs resurfacing.
		const own = state.ext.supermemory as { event_id?: string; generation?: number } | undefined;
		if (own?.event_id === state.input_event.id && typeof own.generation === "number") service.finalize(p, state.input_event.id, {
			reply: state.reply, status: state.turn_outcome ?? (state.error ? "failed" : state.cancel ? "silent" : "interrupted"),
			eligible: state.cancel !== true,
		}, own.generation);
	}
	if (event === "on_session_end") service.endSession(p, state.session.id);
}

export async function dispose() {
	await Promise.all([...services.values()].map(({ service }) => service.close()));
	services.clear();
}
