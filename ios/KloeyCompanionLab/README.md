# Kloey Companion Lab

A separate SwiftUI iOS prototype built from the migrated character player and
Kaigen's native SwiftUI host template. The existing Kloey app is unchanged.
This project uses iOS 26, matching Kloey's current deployment target.

## Start in Xcode

Open `app_swift/KloeyCompanionLab.xcodeproj`, select the **KloeyCompanionLab**
scheme, select your physical iPhone, and choose your development team under
Signing & Capabilities. Then Run. This Mac already has the user's signing team
configured in the Xcode project, and signed device builds have been installed.

Without a saved conversation session, the starter is offline. It shows Kloey,
a full-body camera and an animated Quaternius clearing. SwiftUI supplies the camera-framing sheet and native UI; the intention card and selection sheet remain available in source. There are no manual gesture
buttons. The intention lives in local view state for now.

Simulator and SwiftUI previews show the native UI with an explicit placeholder
for the 3D viewport. The Kaigen library is device-only and is linked only for
`iphoneos`; a runtime condition alone would not make the framework Simulator-compatible.

## The two parts you edit

| Change | File or folder |
| --- | --- |
| Native cards, sheets, buttons, screen layout | `app_swift/Sources/ContentView.swift` |
| Where the Metal view fits in SwiftUI | `app_swift/Sources/EngineView.swift` |
| Swift-to-engine communication | `app_swift/Sources/HZEngine.swift`, `Sources/Generated/`, `app/src/app_swift/` |
| Full-body camera defaults | `app/src/app/app_config.h` |
| Camera, lights and forest placement | `app/assets/mutuals/main_scene/chunk_0.hzt` |
| Imported forest model and generated materials | `app/assets/environments/quaternius/` |
| Editable Blender forest | `art/nature/clearing.blend` |
| Repeatable Blender preparation | `tools/prepare-nature.py` |
| Character rig, animations, facial setup | `app/assets/characters/foxglove.hzt`, `app/assets/foxglove/` |
| Engine application/frame loop | `app/src/app/player.c` |
| Xcode project configuration | `app_swift/project.yml` |

The body was already in the model. The full-body view moves the camera back
and changes what it aims at; it does not require a new avatar. **Your view**
(open the top-left menu) switches full body / close up through a typed command
sent from SwiftUI to C. The engine acknowledges the framing change back to Swift.

`ContentView` layers `HomeView(isExpanded: $cardsExpanded)` above `EngineView`
in a top-aligned ZStack. Cards start collapsed. HomeView has no scene background
and no trailing Spacer, so only its visible controls/cards sit above the world.
ContentView measures the expanded overlay and sends a reserved-top fraction to
the camera. Kaigen smoothly pulls back and lowers the character in the picture;
collapsing restores the previous framing without clearing orbit/zoom preferences.
Card visuals and paging remain in `CardsView.swift`; integration/state belongs
in `ContentView.swift`; camera response belongs in `app/src/app/player.c`.

The forest is an ordinary scene entity referencing an imported GLB. FoxGlove
remains a separate rigged character. Its environment does not need a new backend
or animation system. SwiftUI continues to handle native controls.

See [IDLE-LIFE.md](IDLE-LIFE.md) for automatic strolling, conversation priority, tuning and verification.
See [conversation context](../../docs/conversation-context.md) for local time,
the optional name, daily thoughts and old/new prompt comparisons. The top-left
menu accepts a name; blank removes it. This is a local lab preference, ready
to replace with the authenticated Kloey user profile during app integration.
See [NATURE.md](NATURE.md) for the active animated clearing, touch controls and build notes.
[FOREST.md](FOREST.md) preserves the previous forest integration notes.
The original primitive ground/tree materials remain under `app/assets/lab/`
but are no longer used in the active scene.

For a simple background, start with the scene's clear/sky colour, or add a
background plane with an image material. A SwiftUI image placed behind an opaque
Metal view will not automatically show through it; transparent compositing is a
separate renderer/host change. A complete 3D environment gives the camera real
depth, lighting and shadows and is the route to a forest like the reference images.

## Your daily edit loop

This iOS lab is stored at `ios/KloeyCompanionLab` inside the character-harness
repository. From the repository root, build the Kaigen framework, prepare the
local conversation server, build and sign the SwiftUI app, and install it on a
connected iPhone with:

```bash
./ios/KloeyCompanionLab/run-iphone.sh --restart-server
```

On first use, the script securely asks for OpenAI and ElevenLabs keys if the
local `.env` does not have them, creates a stable session token, and installs
the locked Node dependencies. Secret input is hidden. The `.env` file is
ignored by Git and is written with owner-only permissions. Keys are never
copied into the iOS app or committed.

Both Macs need the same Kaigen engine pin with its iOS component, Xcode with
your Apple ID signed in, and the paired iPhone trusted and unlocked with
Developer Mode enabled. Keep the Mac and phone on the same Wi-Fi. A first-time
Xcode install may ask you to choose your signing team; the launcher then uses
automatic signing. The project pins Kaigen `0.6.2.001-beta` in
`app/hzproject.hzt` and does not substitute a newer engine.

The script prefers the single connected physical iPhone. Use
`./ios/KloeyCompanionLab/run-iphone.sh --list-devices` and
`./ios/KloeyCompanionLab/run-iphone.sh --device "My iPhone"` if several are
paired. Use `--skip-engine` for SwiftUI-only changes after the engine framework
has been built once, `--build-only` to build/sign without installing or opening,
or `--console` to stay attached to the device console. Build/install/launch
logs are in `app_swift/build/iphone/`.

`--restart-server` picks up changed voice, personality, world configuration and
runtime code. It validates the harness, stops only a verified Node runtime
from this checkout on the selected port, starts a fresh server, and supplies
the session to the phone. It resets in-memory conversation history; the new
server stays running after deployment. It requires Node >=23.6 and both
devices on the same Wi-Fi. An unrelated listener is left alone.

To build without restarting the conversation server, omit `--restart-server`;
the app then restores its previously saved connection.

`NODE_BINARY`, `HARNESS_IOS_HOST` (Mac hostname/IP), and `PORT` override discovery.
Without `--restart-server`, you can supply both `HARNESS_URL` and
`HARNESS_CHARACTER` to replace the saved connection explicitly. Restart cannot
be combined with `--build-only` or `--list-devices`.

For SwiftUI-only changes, edit the Swift files and press Run in Xcode. You do
not need to rebuild Kaigen or open Kaigen Studio for every card/button change.

For C, shader, model or scene changes, rebuild the engine package first from
the lab directory:

```bash
cd ios/KloeyCompanionLab
./build-engine.sh
```

Then Run from Xcode again. This updates the static engine framework and cooks
assets; Xcode links the framework and copies `app/cooked` into the app bundle.
The script regenerates the Xcode project from `app_swift/project.yml` only if
the project file is missing; XcodeGen is needed only for that recovery path.

For a fast desktop preview of the 3D scene alone:

```bash
cd ios/KloeyCompanionLab
cd app
hz/hzbuild macos run
```

Add `app/` as an existing project in Kaigen Studio if you want a launcher for
that desktop preview. Xcode remains the native iOS host, signing and app build tool.

## Connecting conversation

The conversation runtime runs in this repository using GPT-6 Luna for replies
and the director, with ElevenLabs hearing and voice.
See [OPENAI_TESTING.md](OPENAI_TESTING.md) for setup and the exact transferred files.
The lab saves the supplied development session in the iPhone Keychain and
restores it before Kaigen starts, so home-screen launches can reconnect.
A physical phone needs a reachable backend address; localhost on a phone is
that phone, not your Mac. Keep the Mac runtime running and its session token
stable. Provider API keys remain on the server.

For production, obtain an authenticated session from Kloey's hosted backend
instead of depending on this saved development connection.

Personality, memory and per-user companion records belong to the backend.
The 3D model, clothes, camera and environment belong to the rendered scene.
Native cards/buttons can use your usual Swift models and API services.

## Moving into Kloey

Move the reusable view/model/bridge files into a companion feature module;
use Kloey's existing app entry point rather than copying this lab's `@main`.
Link the engine framework and required Apple frameworks, and add the cooked
assets as bundle resources. Connect Kloey's authentication and companion state.
Use a single active engine viewport/session, and validate navigation, audio,
interruption and app backgrounding on a physical iPhone.

The starter's device link flags also include GameController, VideoToolbox and
CoreMedia, which the installed SDK needs in addition to its older host template's list.
`project.yml` is the complete working example of the device/Simulator linkage.

## Validation on this Mac

- The native macOS forest scene rendered successfully with the complete
  character: `app/out/forest-preview.png`. The earlier primitive stage capture
  remains available as `app/out/lab-full-body.png`.
- The SwiftUI app built and launched in a temporary iPhone Simulator; the native
  layout was inspected in `app_swift/build/lab-ui-simulator.png`. This capture
  deliberately uses the Simulator placeholder rather than the 3D renderer.
- The complete app built and signed successfully and runs on the user's physical
  iPhone. The user confirmed both camera views and live voice conversation.
- Saved-session restoration was verified by terminating the app and launching
  again without harness settings; the runtime observed a new connection.
- The imported forest was built, installed and visually verified on the user's
  iPhone with the saved GPT-6 Luna/ElevenLabs connection. See [FOREST.md](FOREST.md).
- Hosted backend authentication, conversation memory and per-user persistence
  remain future work.

The scene is a deliberately simple technical prototype. Matching the supplied
screenshots requires original character/environment art, lighting and animation
polish, followed by performance and battery checks on the target phones.

## References

- [Kaigen setup and templates](https://kaigen3d.com/docs/)
- [Writing Kaigen applications](https://kaigen3d.com/docs/writing-applications)
- Local SDK and SwiftUI-host guidance: `app/hz/AGENTS.md` and
  `app/hz/templates/_swift_host/AGENTS.md`.

## Credits

The reference character, player code and art come from Mutuals Character Harness
under Apache 2.0; original LICENSE and NOTICE are included. Kaigen is a separate
licensed SDK. The active clearing uses Quaternius models/textures under CC0. The retained previous forest is adapted from Don Carson's Walk in the Woods under CC BY 3.0; its attribution remains in NOTICE and beside its asset.

## Cards overlay validation

The card integration was built and tested on the physical iPhone. The device test
asserted no carousel at launch, expanded it, paged to another card, collapsed it,
and exercised orbit gestures in the world. Captures under `app_swift/build/`
show the forest around the cards, the smaller/lower character when expanded,
and the restored framing after collapse. The tag-4 wire-size/value check passes.

## Kloey's world awareness

The active companion is named Kloey; `foxglove` remains the saved character/rig
identifier. `app/src/app/player.c` observes the existing `CalmLife` and character
controller, then sends a small descriptive context message over the existing
voice socket before the voice tick. It sends activity transitions and a one
second heartbeat. Preview/screenshot launches send no telemetry. The update
uses the SDK's existing WebSocket API and does not patch the shared engine,
change the movement controller, add Swift bridge tags or alter forest assets.

The integrated harness validates snapshots per connection and freezes one for
each reply. Its world-context extension combines recognized ids with authored
facts in `../../characters/foxglove/world.yaml`; `system.md` defines Kloey's
grounded spoken persona. She has no user-camera feed and no movement-on-request
action tool.
Card contents and chosen intentions are not sent. Automatic strolling remains
local and takes no additional model calls. Context adds a small amount of prompt
input on conversational turns only.

Development conversation traces are in `../../.cache/conversations/`, one
private JSONL file per session.
Generated text and requested speech are labeled separately from actual playback;
interrupted audio is not a verified transcript. Trace details and disabling
instructions are in the harness's `../../docs/extensions.md`; the exact
telemetry contract is in `../../docs/protocol.md`. No OpenAI dashboard storage
is enabled.

After updating the runtime, restart it with the same development token/address
and launch the updated app for a fresh in-memory conversation. Existing Keychain
connection settings are retained. Test where she is, what she was doing, whether
she can see you, and unsupported requests such as sitting or picking flowers.
