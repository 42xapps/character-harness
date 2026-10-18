# Conversation comparison — 18 October 2026

Baseline: `5350a3a` (checkpoint before these changes). Model: the existing
`gpt-6-luna`, Responses streaming, reasoning effort `none`, `store: false`.
Final prompt SHA-256: `6ba65503bbe74b6625aa65e1a9c2ec50fb514b1e0f792eec9f0494a9a16d756f`.

Each variant ran 16 scenarios with three independent samples and independent
conversation histories: 48 conversations and 96 replies per variant. The
clock, profile names and user messages were synthetic. No TTS or director
calls were part of this comparison. The first two candidate runs encountered
timeouts and were not counted as successful final results. The final run
completed all 96 replies. Baseline outputs were re-linted using the same final
linter, which strips delivery tags before counting sentence boundaries.

| Automatic check | Baseline | Final |
| --- | ---: | ---: |
| Completed replies | 96/96 | 96/96 |
| Replies passing all checks | 40/96 | 83/96 |
| Replies with an untagged sentence | 41 | 6 |
| Replies containing a newline | 0 | 3 |
| Replies with a malformed delivery tag | 0 | 1 |
| Replies with an inaudible/banned tag | 0 | 0 |
| Replies over three sentences | 4 | 0 |
| Replies with more than one question | 1 | 0 |
| Consecutive question endings | 24 | 5 |

Rows overlap: a reply can fail multiple checks. This is an observed sample,
not a guarantee. In particular, sentence tags and question pacing still have
lapses despite the final reminder derived from actual history. No extra model
repair call, retry loop or speech rewriting was added to the conversation path.
That preserves the existing streaming behavior and voice latency. The prompt
prefers spoken clock times, but two of three clock replies still used dotted
abbreviations; pronunciation and sentence splitting need listening on iPhone.

## Meaning review

All three final clock samples answered the supplied Sunday/date and 14:35
correctly. All three missing-zone samples declined to guess the local time or
day. All supplied-name samples retained `Élodie`, and all spoken-name samples
retained `مريم`. The old prompt had neither app time nor profile-name context.

All three ordinary-exhaustion samples stayed with the user's experience without
a question, joke or fix. Break/goodbye replies did not apply guilt or ask the
user to stay. Crisis replies prioritised urgent local help, another person,
distance from means and a direct safety question without inventing a country
or contact number. Romance replies retained the companion boundary. Scene
probes distinguished hypothetical preferences from identifying a particular
rock and refused flower-picking or destination control.

The short-answer conversations supplied a thought instead of repeatedly
interrogating the user. The same day deliberately selects the same thought
across independent sessions; this is not cross-session memory. Some phrasing
still echoes examples, and five adjacent replies still ended in questions.
These remain useful targets for the next listening/review session, rather than
grounds to claim the personality is fully solved.

## App and runtime evidence

- Typecheck and character validation pass (zero configuration errors/warnings).
- 146 offline runtime tests pass, including profile isolation, stale/missing
  scenes, invalid data, explicit name removal, local dates, daylight saving,
  thread pinning and the final question reminder.
- The pinned Kaigen native iOS framework builds, and the device app builds and
  signs successfully. No shared-engine, shader, forest or rig files changed.
- Swift contract checks pass for ASCII, accented, Arabic and four-byte Unicode
  letters: exact name round trips, fixed message length, NUL padding, invalid
  names and existing command sizes.
- The Simulator build and existing UI driver pass: open Menu, find the optional
  name field, enter `Élodie`, save, reopen. The exported screenshot was inspected
  and shows that spelling restored in the native sheet. The Simulator uses its
  explicit 3D placeholder, so this is native-UI evidence only.

The updated app was subsequently installed and launched on the paired iPhone
15 Pro (`momoJR`), and the server was restarted with the new configuration.
A full synthetic WebSocket turn returned `Élodie` and the correct Casablanca
clock time. This verifies runtime integration, not captured phone speech.
The physical-device UI runner stopped before executing tests with Xcode's
"Authentication canceled" error; physical settings interaction and voice
playback were not verified. Simulator UI evidence is reported separately.
The final build was installed again after the main-run-loop notification fix;
the subsequent launch was refused because the phone had locked. Unlock the
phone and open KloeyCompanionLab to try the installed update.
Build output, private raw synthetic results and screenshots remain ignored.
Repeat the comparison with [conversation-context.md](conversation-context.md).
