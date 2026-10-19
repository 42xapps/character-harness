import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { parse } from "yaml";
import reactions, { decisionAnswers, decisionRequest, resolve } from "../../extensions/reactions/index.ts";
import director, { arbitrate, check } from "../../extensions/director/index.ts";
import cues from "../../extensions/gesture-cues/index.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
	delete process.env.TEST_IOS_REACTION_KEY;
});

test("Decisions maps rubric questions and normalizes calibrated answers", () => {
	const request = decisionRequest({
		model: "gpt-6-luna", state: { message: "synthetic" }, questions: {
			beat: { type: "choice", instructions: "face", criteria: { none: "no change", happy: "good news" } },
			intensity: { type: "score", instructions: "strength", criteria: ["none", "some", "strong"] },
			guarded: { type: "noul", instructions: "hidden?", criteria: { true: "hidden", false: "open" } },
		},
	});
	assert.equal(request.questions[0].type, "choice");
	assert.deepEqual(request.questions[0].choices, [{ value: "none", description: "no change" }, { value: "happy", description: "good news" }]);
	assert.equal(request.questions[2].type, "predicate");
	const answers = decisionAnswers({ answers: [
		{ type: "choice", name: "beat", choice: "happy", confidence: .9, probabilities: [{ value: "happy", probability: .9 }] },
		{ type: "predicate", name: "guarded", probability: .1 },
		{ type: "refusal", name: "intensity" },
	] }, new Set(["beat", "guarded", "intensity"]));
	assert.deepEqual(answers.beat.probabilities, { happy: .9 });
	assert.equal(answers.guarded.noul, .1);
	assert.equal(answers.intensity, undefined);
	assert.throws(() => decisionAnswers({ answers: [{ type: "predicate", name: "x" }, { type: "predicate", name: "x" }] }, new Set(["x"])), /repeated/);
});

test("OpenAI reaction uses bounded transport, emits once and forgets the session", async () => {
	const config = parse(readFileSync(new URL("../../characters/foxglove/reactions.yaml", import.meta.url), "utf8"));
	config.model.api_key_env = "TEST_IOS_REACTION_KEY";
	process.env.TEST_IOS_REACTION_KEY = "synthetic";
	assert.equal(resolve(config).api, "openai_decisions");
	let calls = 0;
	globalThis.fetch = async (url, init) => {
		calls++;
		assert.match(String(url), /\/decisions$/);
		const body = JSON.parse(String(init?.body));
		assert.deepEqual(body.questions.map((q: { name: string }) => q.name), ["beat", "intensity"]);
		assert.equal(body.model, "gpt-6-luna");
		return Response.json({ answers: [{ type: "choice", name: "beat", choice: "delight", confidence: .99 }, { type: "score", name: "intensity", score: 3 }] });
	};
	const state = { session: { id: "ios-reaction-fixture" }, turn: 1, input: { text: "I got the job!" }, sentence: "That is wonderful!", beats: [] };
	await reactions({ event: "before_reply", state, config });
	assert.equal((await reactions({ event: "on_sentence", state, config }))?.state.beats.length, 1);
	assert.equal(await reactions({ event: "on_sentence", state, config }), undefined);
	await reactions({ event: "on_session_end", state, config });
	assert.equal(calls, 1);
});

test("earlier cue/reaction channels survive director opening beats", () => {
	const beat = { span: "Hello friend", emotion: "happy", register: "regular", gesture: "cheer", camera: "none" };
	const existing = [{ span: "", emotion: "warm" }, { span: "Hello", gesture: "wave" }];
	const out = arbitrate([beat], existing, "Hello friend, I am glad you came.");
	assert.equal(out[0].gesture, "none");
	assert.equal(out[0].emotion, "");
	assert.equal(out[0].register, "regular");
	assert.deepEqual(arbitrate([{ ...beat, register: "none" }], existing, "Hello friend"), []);
	assert.equal(cues({ event: "on_sentence", state: { sentence: "Hello", beats: [{ gesture: "nod" }] }, config: { cues: { hello: "wave" } } }), undefined);
});

const directorConfig = {
	model: { base_url: "https://model.example/v1", api_key_env: "TEST_IOS_REACTION_KEY", model: "fixture" },
	emotions: { surprised: "surprise", happy: "delight" }, intense: ["surprised"], registers: ["regular"],
	gestures: ["wave"], cameras: ["push-in"], first_batch_idle_ms: 0, prompt: "Stage the line.",
};

test("director counts earlier channels and drops an in-flight result after session end", async () => {
	let reply!: (response: Response) => void;
	let called!: () => void;
	const started = new Promise<void>(done => { called = done; });
	globalThis.fetch = async (_url, init) => {
		const prompt = JSON.parse(String(init?.body)).messages[1].content;
		assert.match(prompt, /camera moves used: 1\/1/);
		assert.match(prompt, /gestures used: 1/);
		assert.match(prompt, /intense emotions used: 1\/2/);
		called();
		return new Promise<Response>(done => { reply = done; });
	};
	const state = { session: { id: "ios-director-ended" }, turn: 1, sentence: "Hello friend", beats: [{ span: "", emotion: "surprised", gesture: "wave", camera: "push-in" }] };
	const pending = director({ event: "on_sentence", state, config: directorConfig });
	await started;
	await director({ event: "on_session_end", state, config: directorConfig });
	reply(Response.json({ choices: [{ message: { content: JSON.stringify({ beats: [{ span: "Hello", emotion: "happy", register: "regular" }] }) } }] }));
	assert.equal(await pending, undefined);
});

test("director rejects an invalid opening-batch delay", () => {
	const body = { emotions: null, registers: null, gestures: null, cameras: null };
	assert.equal(check({ config: directorConfig, body }).errors.length, 0);
	for (const value of [-1, 401, NaN, "0"]) {
		assert.match(check({ config: { ...directorConfig, first_batch_idle_ms: value as number }, body }).errors.join(" "), /first_batch_idle_ms/);
	}
});
