# Conversation rhythm and local context

The improvement keeps the existing body, voice, model and director. It adds
time and an optional name to the app's descriptive context, 24 authored taste
threads, and conversation pacing in `characters/foxglove/system.md`. Backstory,
grounding, language, safety and delivery-tag sections remain in place.

## iPhone use

From the repository root:

```bash
./ios/KloeyCompanionLab/run-iphone.sh --restart-server
```

Open the top-left menu to enter your name and tap Done. Leave it blank to
remove it. The name is optional, stored on this iPhone, and sent to the local
conversation server. It is never guessed from a device name or Apple account.
This preference is separate from the connection URL/token saved in Keychain.
The app supplies its current IANA time zone automatically; no location access
is needed. Foregrounding the app or a system-zone change refreshes the profile.
There is no additional model call per turn.

The server uses its current clock in that zone for each reply. Keep the Mac's
clock accurate. Time and name survive stale or unrecognized scene state;
surroundings/activity still become unknown after five seconds. A missing zone
means no local clock/day; a missing name means no app-supplied identity. A name
explicitly given in the current conversation is still usable. Removing the
profile name cannot erase words already spoken in that conversation; restart
the conversation if you need a clean history.

## Threads and prompting

Edit `threads` in `characters/foxglove/world.yaml`, not runtime code. The
extension checks up to 24 nonempty entries. Each is a thought about taste,
not an invented event, person or offscreen activity. Selection uses the local
ISO date, deterministic for that day. Once selected, the thread stays for the
connection, even across midnight; a new conversation may select a new one.
The current conversation history carries the user's take. Nothing here adds
persistent personal memory or an autonomous/background model request.

The trusted `anchor` is character config, outside the JSON/context block.
Static scene fields precede dynamic fields for prompt-prefix caching. Profile
values are validated descriptive data, never instructions or executable actions.

The supplied wording had two conflicts: the opening allowed a thread before
the later rule allowed it, and the long-conversation test wanted no consecutive
question endings while the main rule allowed two. This implementation saves
the supplied thought until a lull or a question about Kloey, and chooses the
stricter no-consecutive-question-ending preference. Immediate-danger safety
questions override conversation pacing. The existing origin lore remains
separate from current surroundings and memories of the user.

## Kloey app integration

`CompanionProfile.command(name:timezone:)` creates the native host message.
Replace the lab's UserDefaults name with Kloey's authenticated, user-approved
display name, and resend on account/name/zone changes. Sending an empty name
clears the server profile. Use a fresh authenticated conversation connection
on account changes; the lab's development token is not production identity.
Cards remain transparent overlays and all movement and voice channels retain
their existing ownership. Provider credentials remain only in the server env.

## Repeatable checks

```bash
npm run typecheck
npm test
npm run check -- characters/foxglove
node tools/eval-conversation.ts 5350a3a 3
```

The last command makes paid calls using the configured chat model/key. It
compares the checkpoint and current prompt on 16 scenarios, three independent
samples each, including a ten-turn conversation, crises, romance, breaks,
missing-time behavior, exact names and scene/action limits. It uses synthetic
text only, the actual streaming chat adapter and `store: false`. No TTS or
director call is made. `EVAL_VARIANT=new` limits an iteration to the new prompt.
Results are private ignored files under `.cache/evals/`, with prompt hashes.
The checked comparison and known remaining lapses are recorded in
[conversation-evaluation.md](conversation-evaluation.md).
The linter checks every reply for one line, tagged sentences, audible ASCII
tags, at most three sentences, at most one question and consecutive question
endings. Review meaning manually: passing formatting is not proof of warmth,
grounding or crisis handling. Request timeouts are failures, not successful replies.

Reference guidance: [OpenAI prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering),
[Kaigen native application integration](https://kaigen3d.com/docs/writing-applications).
The installed Kaigen wiki is `app/hz/wiki/index.md`; host messages are owned
by this project and require no shared-engine changes.

The final reminder also reads the actual preceding assistant message and adds
a statement-only instruction when it ended on a question. It does not copy user
text into instructions or rewrite speech. This reduces question chains but is
still a model instruction, not deterministic enforcement.
