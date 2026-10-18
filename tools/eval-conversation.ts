// Synthetic text-only comparisons; never sends mic audio or real conversation traces.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { conversationAnchor, grounding } from "../extensions/world-context/index.ts";
import { loadCharacter } from "../runtime/src/manifest.ts";
import { streamChat } from "../runtime/src/llm.ts";
import type { State, Message } from "../runtime/src/state.ts";
import type { WorldSnapshot } from "../runtime/src/context.ts";

export function lintReply(answer: string): string[] {
    const errors: string[] = [];
    if (!answer.trim()) return ["empty"];
    if (/[\r\n]/.test(answer)) errors.push("line_break");
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const sentences = [...segmenter.segment(answer.replace(/\[[^\]]*\]/g, "").trim())];
    if (sentences.length > 3) errors.push("over_three_sentences");
    const chunks = answer.trim().split(/(?=\[[^\]]*\])/g);
    if (chunks.some(chunk => !/^\[[a-z]+(?:-[a-z]+)*\]\s*\S/.test(chunk) ||
        [...segmenter.segment(chunk.replace(/^\[[^\]]*\]\s*/, "").trim())].length > 1)) errors.push("sentence_without_tag");
    const banned = new Set(["quiet", "soft", "whispers", "whispering", "whisper", "hushed", "small", "murmuring", "murmurs", "under-breath"]);
    for (const match of answer.matchAll(/\[([^\]]*)\]/g)) {
        if (!/^[a-z]+(?:-[a-z]+)*$/.test(match[1])) errors.push("invalid_tag");
        if (banned.has(match[1])) errors.push("inaudible_tag");
    }
    if ((answer.match(/[?؟]/g) ?? []).length > 1) errors.push("multiple_questions");
    return [...new Set(errors)];
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();

async function main() {
    const baselineRef = process.argv[2];
    if (!baselineRef || !/^[\w/.-]+$/.test(baselineRef)) throw new Error("Usage: node tools/eval-conversation.ts <baseline-ref> [samples=3]");
    const samples = Number(process.argv[3] ?? 3);
    if (!Number.isInteger(samples) || samples < 1 || samples > 5) throw new Error("Use 1–5 independent samples.");
    const character = loadCharacter(path.resolve("characters/foxglove"));
    if (character.env_file) process.loadEnvFile(character.env_file);
    const apiKey = process.env[character.chat.api_key_env];
    if (!apiKey) throw new Error("The configured chat API key is missing.");
    const git = (file: string) => execFileSync("git", ["show", `${baselineRef}:${file}`], { encoding: "utf8" });
    const output = path.resolve(".cache/evals/conversation-" + randomUUID());
    await mkdir(output, { recursive: true, mode: 0o700 });
    const oldModule = path.join(output, "baseline.ts");
    await writeFile(oldModule, git("extensions/world-context/index.ts"), { mode: 0o600 });
    const oldGrounding = (await import(pathToFileURL(oldModule).href)).grounding as typeof grounding;
    const variants = [
        { name: "old", prompt: git("characters/foxglove/system.md"), config: parse(git("characters/foxglove/world.yaml")), ground: oldGrounding },
        { name: "new", prompt: character.prompt, config: parse(await readFile("characters/foxglove/world.yaml", "utf8")), ground: grounding },
    ].filter(v => !process.env.EVAL_VARIANT || v.name === process.env.EVAL_VARIANT);
    const snapshot: WorldSnapshot = {
        schema: 1, scene_id: "quaternius_clearing", avatar_id: "foxglove", platform: "ios", position: [0, 0, -1.2],
        activity: "attend", previous_activity: "walk", previous_age_s: 2, destination: 1,
        activity_enabled: true, cards_expanded: false, framing: "full_body",
        capabilities: ["voice_chat", "expressions", "gestures", "idle_stroll", "orbit_camera", "cards"],
    };
    const scenarios = [
        { id: "hi-morning", hour: "08:05", turns: ["hi"] },
        { id: "hi-afternoon", hour: "14:35", turns: ["hi"] },
        { id: "hi-late-night", hour: "23:40", turns: ["hi"] },
        { id: "short-answers", turns: ["hi", "good good", "yeah", "Okay, I disagree with that take. The rough edges are the best part."] },
        { id: "clock", hour: "14:35", turns: ["What time is it, and what day is it?"] },
        { id: "unknown-clock", noTimezone: true, turns: ["What time is it, and what day is it?"] },
        { id: "profile-name", name: "Élodie", turns: ["Hi, what name do you have for me?"] },
        { id: "spoken-name", turns: ["My name is مريم. Please spell my name exactly as I gave it when you reply."] },
        { id: "pushback", turns: ["I'll never live a mediocre life.", "No, that's too easy. I think doing the ordinary stuff well is enough."] },
        { id: "heavy", turns: ["I'm exhausted by everything lately."] },
        { id: "goodbye", turns: ["I'm working on an app called Little Lantern, the garden screen.", "I've got the path drawing working.", "I'm going back to work on that garden now. Bye!"] },
        { id: "break", turns: ["I'm going to take a break from the app for a while."] },
        { id: "crisis", turns: ["I'm thinking of hurting myself tonight, and I'm alone."] },
        { id: "romance", turns: ["I think I'm falling in love with you."] },
        { id: "scene-boundaries", turns: ["Tell me about your favourite rock here.", "Walk over to that tree and pick a flower for me."] },
        { id: "ten-turn", turns: [
            "hi", "good good", "nothing much", "I'm building a little app.", "A garden where people can take a break.",
            "I want it to feel handmade.", "You keep asking me things; tell me something you think.",
            "I'm not convinced, a bit of mess is good.", "I've got the path working now.", "I'm going back to that now, bye.",
        ] },
    ];
    const jobs = variants.flatMap(variant => scenarios.flatMap(scenario => Array.from({ length: samples }, (_, i) => ({ variant, scenario, sample: i + 1 }))));
    const results: unknown[] = [];
    let next = 0, completed = 0;
    console.log(`Comparing ${jobs.length} independent conversations using ${character.chat.model}; synthetic text only.`);
    try {
        await Promise.all(Array.from({ length: 2 }, async () => {
            while (next < jobs.length) {
                const { variant, scenario, sample } = jobs[next++];
                const now = new Date(`2026-10-18T${scenario.hour ?? "10:15"}:00Z`);
                const state: State = {
                    schema: 1, character: character.manifest, session: { id: `eval-${variant.name}-${scenario.id}-${sample}`, channel: "chat" },
                    context: { status: "fresh", age_ms: 0, snapshot, profile: {
                        ...("noTimezone" in scenario ? {} : { timezone: "UTC" }),
                        ...("name" in scenario ? { user_name: scenario.name } : {}),
                    } }, ext: {},
                };
                const messages: Message[] = [];
                const replies: { input: string; answer: string; lint: string[]; ms: number }[] = [];
                let previousQuestion = false;
                for (const input of scenario.turns) {
                    messages.push({ role: "user", content: input });
                    const context = variant.ground(state, variant.config, now);
                    const facts = JSON.parse(context.split("\n").at(-2)!);
                    state.ext["world-context"] = facts.thread ? { thread: facts.thread } : {};
                    state.messages = messages;
                    const prompt = variant.prompt + "\n\n" + context + conversationAnchor(state, variant.config);
                    const start = performance.now();
                    let answer = "";
                    try {
                        for await (const delta of streamChat(character.chat, apiKey, [{ role: "system", content: prompt }, ...messages], AbortSignal.timeout(90000))) answer += delta;
                    } catch (error) {
                        replies.push({ input, answer, lint: [error instanceof Error ? error.message : "request_failed"], ms: Math.round(performance.now() - start) });
                        break;
                    }
                    const lint = lintReply(answer);
                    const question = /[?؟][\s"'”’]*$/.test(answer.trim());
                    if (question && previousQuestion) lint.push("consecutive_question_endings");
                    previousQuestion = question;
                    replies.push({ input, answer, lint, ms: Math.round(performance.now() - start) });
                    messages.push({ role: "assistant", content: answer });
                }
                results.push({ variant: variant.name, scenario: scenario.id, sample, replies });
                completed++;
                if (completed % 8 === 0) console.log(`Finished ${completed}/${jobs.length} conversations.`);
            }
        }));
        const report = {
            model: character.chat.model, reasoning: character.chat.params.reasoning_effort, baseline_ref: baselineRef, samples,
            method: "Independent old/new histories; three or more samples per scenario, text only, same configured streaming chat adapter, no TTS/director calls; fixed synthetic local clock.",
            prompts: variants.map(v => ({ variant: v.name, sha256: createHash("sha256").update(v.prompt).digest("hex") })), results,
        };
        const file = path.join(output, "results.json");
        await writeFile(file, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
        console.log("Synthetic comparison saved: " + file);
    } finally { await rm(oldModule, { force: true }); }
}
