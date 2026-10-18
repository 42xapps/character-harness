// Optional, descriptive app telemetry. No text from the client becomes instructions.
export const ACTIVITIES = ["rest", "turn", "walk", "observe", "attend", "unavailable"] as const;
export type Activity = (typeof ACTIVITIES)[number];

export interface SessionProfile { timezone?: string; user_name?: string }

export interface WorldSnapshot {
	schema: 1;
	scene_id: string;
	avatar_id: string;
	platform: "ios" | "desktop";
	position: [number, number, number];
	activity: Activity;
	previous_activity: Activity;
	previous_age_s: number;
	destination: number;
	activity_enabled: boolean;
	cards_expanded: boolean;
	framing: "full_body" | "close_up";
	capabilities: string[];
	timezone?: string;
	user_name?: string | null; // null explicitly clears a previously supplied name
}

export interface ReceivedContext { snapshot: WorldSnapshot; receivedAt: number }
export interface TurnContext {
	status: "fresh" | "stale" | "missing";
	age_ms?: number;
	snapshot?: WorldSnapshot;
	profile?: SessionProfile;
}

const token = (x: unknown): x is string => typeof x === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(x);
const activity = (x: unknown): x is Activity => ACTIVITIES.includes(x as Activity);
const bounded = (x: unknown, min: number, max: number): x is number =>
	typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;

export function validTimezone(value: unknown): value is string {
	if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(value)) return false;
	try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

export const validUserName = (value: unknown): value is string => typeof value === "string" &&
	value.length <= 80 && [...value].length <= 40 && /^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u.test(value);

export function updateSessionProfile(previous: SessionProfile, snapshot: WorldSnapshot): SessionProfile {
	const profile = { ...previous };
	if (snapshot.timezone !== undefined) profile.timezone = snapshot.timezone;
	if (snapshot.user_name === null) delete profile.user_name;
	else if (snapshot.user_name !== undefined) profile.user_name = snapshot.user_name;
	return profile;
}

export function parseWorldSnapshot(value: unknown): WorldSnapshot | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	if (v.schema !== 1 || !token(v.scene_id) || !token(v.avatar_id) ||
		(v.platform !== "ios" && v.platform !== "desktop") ||
		!Array.isArray(v.position) || v.position.length !== 3 || !v.position.every((n) => bounded(n, -10000, 10000)) ||
		!activity(v.activity) || !activity(v.previous_activity) || !bounded(v.previous_age_s, 0, 3600) ||
		!Number.isInteger(v.destination) || !bounded(v.destination, 0, 255) ||
		typeof v.activity_enabled !== "boolean" || typeof v.cards_expanded !== "boolean" ||
		(v.framing !== "full_body" && v.framing !== "close_up") ||
		!Array.isArray(v.capabilities) || v.capabilities.length > 16 || !v.capabilities.every(token)) return null;
	// Reconstruct the allowed fields; ignore arbitrary client keys, including instructions.
	return {
		schema: 1, scene_id: v.scene_id, avatar_id: v.avatar_id, platform: v.platform,
		position: [...v.position] as WorldSnapshot["position"], activity: v.activity,
		previous_activity: v.previous_activity, previous_age_s: v.previous_age_s,
		destination: v.destination, activity_enabled: v.activity_enabled, cards_expanded: v.cards_expanded,
		framing: v.framing, capabilities: [...new Set(v.capabilities)],
		...(validTimezone(v.timezone) ? { timezone: v.timezone } : {}),
		...(v.user_name === null || validUserName(v.user_name) ? { user_name: v.user_name } : {}),
	};
}

export function contextForTurn(latest?: ReceivedContext, now = Date.now(), profile?: SessionProfile): TurnContext {
	const retained = profile && Object.keys(profile).length ? { profile: { ...profile } } : {};
	if (!latest) return { status: "missing", ...retained };
	const age_ms = Math.max(0, now - latest.receivedAt);
	return age_ms <= 5000
		? { status: "fresh", age_ms, snapshot: structuredClone(latest.snapshot), ...retained }
		: { status: "stale", age_ms, ...retained };
}
