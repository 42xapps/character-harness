import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareMemoryRequest } from "../../tools/supermemory/ollama.ts";

const model = "local-memory-model";
test("memory gateway preserves extraction prompts and tools and disables extended thinking", () => {
	const input = { model, messages: [{ role: "system", content: "Exact provider prompt" }, { role: "user", content: "Evidence" }], tools: [{ type: "function", function: { name: "CreateMemory" } }], reasoning_effort: "high", temperature: 0.2 };
	const before = structuredClone(input);
	const out = prepareMemoryRequest(input, model);
	assert.equal(out.reasoning_effort, "none");
	assert.deepEqual(out.messages, input.messages);
	assert.deepEqual(out.tools, input.tools);
	assert.equal(out.temperature, input.temperature);
	assert.deepEqual(input, before);
});
test("memory gateway uses GPT-OSS supported low reasoning while preserving extraction tools", () => {
	const input = { model: "gpt-oss:20b-cloud", messages: [{ role: "user", content: "Synthetic evidence" }],
		tools: [{ type: "function", function: { name: "CreateMemory" } }], reasoning_effort: "none", reasoning: { effort: "none" } };
	const before = structuredClone(input);
	const out = prepareMemoryRequest(input, "gpt-oss:20b-cloud");
	assert.equal(out.reasoning_effort, "low");
	assert.equal(out.reasoning, undefined);
	assert.deepEqual(out.messages, input.messages);
	assert.deepEqual(out.tools, input.tools);
	assert.deepEqual(input, before);
});
test("memory gateway supplies the missing bounded forget schema for the pinned server contract", () => {
	const content = 'The user wants to forget memories about: "tea".\n\nBelow are 2 candidate memories, numbered 1 to 2. Return the numbers.\n\nCandidates:\n1. Tea.\n2. A sister.';
	const input = { model, response_format: { type: "json_object" }, messages: [{ role: "user", content }] };
	const out = prepareMemoryRequest(input, model);
	assert.equal(out.response_format?.type, "json_schema");
	const format = out.response_format as unknown as { json_schema: { schema: { properties: { forget: { items: { minimum: number; maximum: number } } }; required: string[] } } };
	assert.deepEqual(format.json_schema.schema.required, ["forget"]);
	assert.deepEqual(format.json_schema.schema.properties.forget.items, { type: "integer", minimum: 1, maximum: 2 });
	assert.deepEqual(out.messages?.at(-1), input.messages[0]);
	assert.equal(input.messages.length, 1);
	assert.equal(input.response_format.type, "json_object");
});
test("memory gateway leaves unrelated JSON contracts alone and refuses another model", () => {
	const input = { model, response_format: { type: "json_object" }, messages: [{ role: "user", content: "Summarize this evidence." }] };
	const out = prepareMemoryRequest(input, model);
	assert.deepEqual(out.messages, input.messages);
	assert.deepEqual(out.response_format, input.response_format);
	assert.throws(() => prepareMemoryRequest({ ...input, model: "cloud-model" }, model), /Unexpected model/);
	assert.throws(() => prepareMemoryRequest(null, model));
});
