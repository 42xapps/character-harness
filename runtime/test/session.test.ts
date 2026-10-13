// How the session merges what overlapping hooks wrote to `ext`. Run with `npm test`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { applyExt, extChanges } from "../src/session.ts";

test("a hook's stale copy of ext does not undo what another hook wrote", () => {
	const start = { a: { n: 1 }, b: 1 };
	// two hooks start from the same copy; one changes a, the other b
	const first = extChanges(start, { a: { n: 2 }, b: 1 });
	const second = extChanges(start, { a: { n: 1 }, b: 2 });
	const ext = applyExt(applyExt(start, first), second);
	assert.deepEqual(ext, { a: { n: 2 }, b: 2 });
});

test("a key a hook removed is removed, and new keys are added", () => {
	const ext = applyExt({ a: 1, b: 2 }, extChanges({ a: 1, b: 2 }, { a: 1, c: 3 }));
	assert.deepEqual(ext, { a: 1, c: 3 });
});

test("a hook that hands back no ext changes nothing, and a value JSON can't write counts as changed", () => {
	assert.deepEqual(extChanges({ a: 1 }, undefined as never), { set: {}, removed: [] });
	assert.deepEqual(extChanges(undefined as never, { a: 1 }), { set: { a: 1 }, removed: [] });
	assert.deepEqual(extChanges({ a: 1n }, { a: 1n }).set, { a: 1n });
});
