import type { SessionPrincipal } from "../../runtime/src/state.ts";

export interface MemoryEntry {
	id: string;
	text: string;
	kind: "memory" | "chunk" | "profile";
	sourceIds: string[];
	updatedAt?: string;
	inferred: boolean;
	latest: boolean;
	related?: { id: string; text: string; relation: string }[];
}
export interface Recall {
	entries: MemoryEntry[];
	availability: "ready" | "cached" | "empty" | "unavailable" | "disabled" | "suppressed";
}
export interface ConversationEvent {
	id: string;
	sessionId: string;
	text: string;
	channel: string;
	date: string;
	timezone?: string;
}
export interface Outcome {
	reply?: string;
	status: "generated" | "interrupted" | "failed" | "silent";
	eligible: boolean;
}
export interface DocumentWrite {
	id: string;
	content: string;
	date: string;
	revision: number;
}
export interface ForgetPreview {
	ids: string[];
	sourceIds: string[];
	clearsAll: boolean;
	// Opaque, authenticated snapshot; applying it fails if memory changed.
	token: string;
}
export interface MemoryProvider {
	add(namespace: string, doc: DocumentWrite): Promise<string>;
	status(namespace: string, id: string): Promise<{ chunks: "pending" | "done" | "failed"; dreaming: "dreaming" | "done" | "unknown" }>;
	setup(namespace: string): Promise<void>;
	search(namespace: string, query: string, signal: AbortSignal): Promise<MemoryEntry[]>;
	profile(namespace: string, signal: AbortSignal): Promise<MemoryEntry[]>;
	list(namespace: string, page: number): Promise<unknown>;
	preview(namespace: string, query: string): Promise<string[]>;
	sources(namespace: string, ids: string[]): Promise<string[] | null>;
	forget(namespace: string, ids: string[]): Promise<void>;
	deleteNamespace(namespace: string): Promise<void>;
}
export type Principal = SessionPrincipal;
