// Changes the character's face the moment a sentence starts, from the delivery
// tag the model opens it with ("[teasing] ...") and the character's tag map.
// No model call, so it lands before any slower staging does. An unmapped tag
// changes nothing: guessing an emotion is worse than waiting for the director.
//
// config:
//   tags: { teasing: playful, ... }   delivery tag -> emotion

interface Input {
	event: string;
	state: { sentence?: string; beats?: unknown[] };
	config: { tags?: Record<string, string> };
}

export default function ({ state, config }: Input) {
	const tag = /^\s*\[([a-zA-Z][a-zA-Z-]*)\]/.exec(state.sentence ?? "")?.[1]?.toLowerCase();
	const emotion = tag ? config.tags?.[tag] : undefined;
	if (!emotion) return;
	return { state: { ...state, beats: [...(state.beats ?? []), { span: "", emotion }] } };
}
