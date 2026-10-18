# GPT-6 Luna iPhone setup

The conversation runtime and character configuration are in the repository
root. The native SwiftUI host and Kaigen scene are under
`ios/KloeyCompanionLab/`. No second harness checkout is required.

## Run on the iPhone

From the repository root:

```bash
./ios/KloeyCompanionLab/run-iphone.sh --restart-server
```

The first run asks for the OpenAI and ElevenLabs keys using hidden input, saves
them only in the ignored root `.env`, creates a stable local session token,
installs the Node dependencies if needed, and builds and launches the app.
Provider keys stay on the Mac and are not copied into the app. Do not commit
`.env`.

The Mac needs Node.js 23.6 or later, Xcode with your Apple ID signed in, and
Kaigen activated with the pinned `0.6.2.001-beta` engine and its iOS component.
Keep the phone unlocked, trusted by Xcode, in Developer Mode, and on the same
Wi-Fi as the Mac. On a new Mac, automatic signing may first ask you to select
your development team in Xcode.

Use `--list-devices` to inspect paired phones or `--device "My iPhone"` to
select one explicitly. Use `--skip-engine` only after an engine framework has
already been built on that Mac. Restarting the server resets in-memory
conversation history; the app's saved development address and character stay
in the iPhone Keychain.

## What the client uses

`../../characters/foxglove/character.yaml` selects GPT-6 Luna through the OpenAI
Responses API. ElevenLabs Scribe v2 Realtime handles speech recognition and
Eleven v4 Turbo speaks Kloey's replies. The required keys are
`OPENAI_API_KEY` and `ELEVENLABS_API_KEY`; `../../.env.example` documents them.

The runtime sends transcripts and companion context to the configured model,
then streams the spoken reply and animation cues to the Kaigen player. The
SwiftUI app owns the native cards, controls and session restoration. The
Kaigen app owns the 3D scene, camera, character and touch exploration.

## Validation

- Runtime tests: 139 passed.
- TypeScript typecheck: passed.
- Character manifest check: zero errors or warnings.
- The app and live voice conversation were previously confirmed on the user's
  physical iPhone. This packaging update changes the launcher and setup notes;
  it does not change the SwiftUI or Kaigen runtime behavior.
