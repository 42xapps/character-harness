// Evens out the loudness of each sentence's voice before it reaches the app.
// Delivery tags like [quiet], [soft] or [whispers] come back from the voice
// model 5-10x quieter than normal speech, quiet enough to sound like she
// stopped talking. This lifts a quiet sentence toward normal loudness. It never
// turns a sentence down, so normal and loud lines pass through unchanged.
//
// Audio is forwarded as it arrives, so the level is judged on the sentence so
// far: the loudest 50 ms window heard sets the gain. The gain waits for a few
// windows of speech before lifting anything, so the soft start of a normal line
// isn't boosted, and it only ever eases down once it has risen.

const SAMPLE_RATE = 24000;
const WINDOW = SAMPLE_RATE / 20; // 50 ms
// the loudest window of a normally spoken sentence, as RMS of full scale
const TARGET = 0.05;
const MAX_GAIN = 12;
// windows quieter than this are silence and don't count as speech
const GATE = 0.002;
// windows of speech heard before the gain may rise
const SETTLE = 5;
// per-sample gain change: rising over ~75 ms, falling over ~25 ms
const RISE = 7 / 1800;
const FALL = 7 / 600;

export class Leveler {
	private loudest = 0;
	private voiced = 0;
	private gain = 1;
	private sumSq = 0;
	private count = 0;

	// the gain applied at the end of the audio so far, for logs and tests
	get currentGain(): number {
		return this.gain;
	}

	// `pcm` is 16-bit little-endian mono; returns the leveled copy
	process(pcm: Buffer): Buffer {
		const out = Buffer.allocUnsafe(pcm.length);
		const n = pcm.length >> 1;
		for (let i = 0; i < n; i++) {
			const v = pcm.readInt16LE(i * 2) / 32768;
			this.sumSq += v * v;
			if (++this.count === WINDOW) {
				const rms = Math.sqrt(this.sumSq / WINDOW);
				if (rms > GATE) {
					this.voiced++;
					if (rms > this.loudest) this.loudest = rms;
				}
				this.sumSq = 0;
				this.count = 0;
			}
			const want =
				this.voiced >= SETTLE ? Math.min(MAX_GAIN, Math.max(1, TARGET / this.loudest)) : Math.min(this.gain, 1);
			const step = want < this.gain ? FALL : RISE;
			this.gain += Math.max(-step, Math.min(step, want - this.gain));
			let y = v * this.gain;
			// soft limit: transparent below 0.9, never past full scale
			if (y > 0.9) y = 0.9 + 0.1 * Math.tanh((y - 0.9) / 0.1);
			else if (y < -0.9) y = -0.9 - 0.1 * Math.tanh((-y - 0.9) / 0.1);
			out.writeInt16LE(Math.round(y * 32767), i * 2);
		}
		return out;
	}
}
