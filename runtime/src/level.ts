// Evens out the loudness of each sentence's voice before it reaches the app.
// The voice model renders delivery tags at very different levels: calm ones
// like [honest] or [thoughtful] come back 8-13 dB below [sudden] or [proud],
// and whisper tags 5-10x quieter still, so a reply jumps in volume from one
// sentence to the next. This brings every sentence to the same loudness.
//
// The start of each sentence is held (HOLD, or all of it if shorter) and the
// gain is set from the loudness of that stretch, so even a one-word line is
// leveled from its first sample. After that the audio passes straight through
// and the gain eases toward the loudness of everything heard so far. Audio
// arrives about 2.5x faster than it plays, so holding 400 ms delays a reply by
// about 160 ms; later sentences are queued ahead and lose nothing.

const SAMPLE_RATE = 24000;
const WINDOW = SAMPLE_RATE / 20; // 50 ms
// audio held before the gain is set
const HOLD = (SAMPLE_RATE * 400) / 1000;
// loudness of a sentence's voiced audio, in dB of full scale
const TARGET_DB = -26;
const MAX_GAIN = 12;
const MIN_GAIN = 0.5;
// windows quieter than this RMS are silence and don't count toward loudness
const GATE = 0.004;
// per-sample gain change once the gain is set: 1.0 over 100 ms
const STEP = 1 / 2400;

export class Leveler {
	private gain = 1;
	// the gain the loudness so far asks for; updated once per window
	private want = 1;
	private set = false;
	private held: Buffer[] = [];
	private heldSamples = 0;
	// a byte left over when a chunk ends mid-sample
	private odd: Buffer | null = null;
	// mean square of each voiced window so far, summed
	private voicedSum = 0;
	private voiced = 0;
	private sumSq = 0;
	private count = 0;

	// the gain applied at the end of the audio so far, for logs and tests
	get currentGain(): number {
		return this.gain;
	}

	// `pcm` is 16-bit little-endian mono. Returns the leveled audio that is
	// ready to send, empty while the start is held.
	process(pcm: Buffer): Buffer {
		if (this.odd) {
			pcm = Buffer.concat([this.odd, pcm]);
			this.odd = null;
		}
		if (pcm.length & 1) {
			this.odd = pcm.subarray(pcm.length - 1);
			pcm = pcm.subarray(0, pcm.length - 1);
		}
		if (this.set) return this.apply(pcm, true);
		this.measure(pcm);
		this.held.push(pcm);
		this.heldSamples += pcm.length >> 1;
		return this.heldSamples >= HOLD ? this.release() : Buffer.alloc(0);
	}

	// at the end of the sentence: whatever is still held, leveled
	flush(): Buffer {
		this.odd = null;
		return this.set ? Buffer.alloc(0) : this.release();
	}

	private release(): Buffer {
		this.gain = this.want;
		this.set = true;
		const out = this.apply(Buffer.concat(this.held), false);
		this.held = [];
		return out;
	}

	private measure(pcm: Buffer): void {
		const n = pcm.length >> 1;
		for (let i = 0; i < n; i++) this.addSample(pcm.readInt16LE(i * 2) / 32768);
	}

	private addSample(v: number): void {
		this.sumSq += v * v;
		if (++this.count < WINDOW) return;
		const ms = this.sumSq / WINDOW;
		if (ms > GATE * GATE) {
			this.voicedSum += ms;
			this.voiced++;
			const db = 10 * Math.log10(this.voicedSum / this.voiced);
			this.want = Math.min(MAX_GAIN, Math.max(MIN_GAIN, 10 ** ((TARGET_DB - db) / 20)));
		}
		this.sumSq = 0;
		this.count = 0;
	}

	// `track`: the audio is new, so it counts toward loudness and the gain follows it
	private apply(pcm: Buffer, track: boolean): Buffer {
		const out = Buffer.allocUnsafe(pcm.length);
		const n = pcm.length >> 1;
		for (let i = 0; i < n; i++) {
			const v = pcm.readInt16LE(i * 2) / 32768;
			if (track) {
				this.addSample(v);
				this.gain += Math.max(-STEP, Math.min(STEP, this.want - this.gain));
			}
			let y = v * this.gain;
			// soft limit: transparent below 0.9, never past full scale
			if (y > 0.9) y = 0.9 + 0.1 * Math.tanh((y - 0.9) / 0.1);
			else if (y < -0.9) y = -0.9 - 0.1 * Math.tanh((-y - 0.9) / 0.1);
			out.writeInt16LE(Math.round(y * 32767), i * 2);
		}
		return out;
	}
}
