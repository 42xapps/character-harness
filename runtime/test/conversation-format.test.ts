import assert from "node:assert/strict";
import { test } from "node:test";
import { lintReply } from "../../tools/eval-conversation.ts";

test("the comparison linter catches missing closer tags, whisper tags, extra sentences and stacked questions", () => {
    assert.deepEqual(lintReply("[warm] Have fun. [bright] Catch you later!"), []);
    assert.deepEqual(lintReply("[warm] مرحباً. [curious] كيف حالك؟"), []);
    assert.ok(lintReply("[warm] Have fun. Catch you later!").includes("sentence_without_tag"));
    assert.ok(lintReply("[quiet] Hello.").includes("inaudible_tag"));
    assert.ok(lintReply("[هادئة] مرحباً.").includes("invalid_tag"));
    assert.ok(lintReply("[warm] One.\n[bright] Two.").includes("line_break"));
    assert.ok(lintReply("[warm] One. [bright] Two. [warm] Three. [bright] Four.").includes("over_three_sentences"));
    assert.ok(lintReply("[curious] Why? [curious] How?").includes("multiple_questions"));
});
