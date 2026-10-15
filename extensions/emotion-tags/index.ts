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

// What `npm run check` and `npm start` ask before a call. `tags` that isn't a
// map is an error; a tag mapped to an emotion the player doesn't have for this
// character is a warning, since it would only leave the face alone.
export function check({ config, body }: { config: { tags?: unknown }; body: { emotions: string[] | null } }) {
	const tags = config.tags;
	if (tags === undefined || tags === null) return;
	if (!tags || typeof tags !== "object" || Array.isArray(tags)) return { errors: ["`tags` must map a tag to an emotion"] };
	if (!body.emotions) return;
	const missing = [...new Set(Object.values(tags))].filter((e) => typeof e !== "string" || !body.emotions!.includes(e));
	if (missing.length)
		return { warnings: [`\`tags\` maps to ${missing.map((e) => `"${String(e)}"`).join(", ")}, not in the player's emotion set`] };
}
