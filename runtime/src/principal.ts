import type { SessionPrincipal } from "./state.ts";

const validId = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,99}$/.test(v);
export function validatePrincipal(p: SessionPrincipal): SessionPrincipal {
	if (!validId(p.user_id) || !validId(p.companion_id)) throw new Error("Invalid server session principal");
	return { user_id: p.user_id, companion_id: p.companion_id };
}
// This is deliberately a development-only resolver. Hosted callers pass a principal
// from their authenticated backend to runSession instead of trusting these variables.
export function localPrincipal(env: NodeJS.ProcessEnv): SessionPrincipal | undefined {
	if (env.HARNESS_IDENTITY_MODE !== "local") return undefined;
	if (env.NODE_ENV === "production") throw new Error("Local session identity is forbidden in production");
	return validatePrincipal({ user_id: env.HARNESS_USER_ID ?? "", companion_id: env.HARNESS_COMPANION_ID ?? "" });
}
