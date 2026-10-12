// Incremental char->seconds table built from ElevenLabs' character timestamps
// (the with-timestamps stream, or the dialogue socket's). Beats anchor to a text
// span; this turns that span into "seconds into THIS clip's audio", which is
// what the client fires beats against.
//
// Spans come from the model's text, but the alignment describes what was
// actually VOICED — v3 audio tags, punctuation and whitespace may differ. So
// matching happens on a letters+digits projection of both, with an index map
// back to the real character stream.

export interface AlignmentChunk {
	characters?: string[];
	character_start_times_seconds?: number[];
	character_end_times_seconds?: number[];
}

function isWord(c: string): boolean {
	return (c >= "a" && c <= "z") || (c >= "0" && c <= "9");
}

export function project(s: string): string {
	let out = "";
	for (const ch of s.toLowerCase()) if (isWord(ch)) out += ch;
	return out;
}

export class Alignment {
	private starts: number[] = [];
	private ends: number[] = [];
	private proj = "";
	private projToChar: number[] = [];

	push(a: AlignmentChunk | null | undefined): void {
		const chars = a?.characters;
		const st = a?.character_start_times_seconds;
		if (!chars || !st) return;
		const en = a.character_end_times_seconds;
		for (let i = 0; i < chars.length && i < st.length; i++) {
			const idx = this.starts.length;
			this.starts.push(st[i]);
			this.ends.push(en?.[i] ?? st[i]);
			const c = chars[i].toLowerCase();
			if (c.length === 1 && isWord(c)) { this.proj += c; this.projToChar.push(idx); }
		}
	}

	get empty(): boolean { return this.starts.length === 0; }
	get duration(): number { return this.ends.length ? this.ends[this.ends.length - 1] : 0; }
	get projLen(): number { return this.proj.length; }

	// locate `span` at or after `fromProj` (kept monotonic so beats resolve in
	// order and a repeated phrase can't match backwards). null = not voiced yet.
	find(span: string, fromProj: number): { t: number; projEnd: number } | null {
		const p = project(span);
		if (!p) return null;
		const at = this.proj.indexOf(p, fromProj);
		if (at < 0) return null;
		return { t: this.starts[this.projToChar[at]], projEnd: at + p.length };
	}

	// last-resort placement once the stream ended and a span never matched:
	// spread it across the clip by where it sits in the source text.
	approx(fraction: number): number {
		const f = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction;
		return this.duration * f;
	}
}
