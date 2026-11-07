# Upstream and iOS integration

Upstream main at 5fd426e is an ancestor of the integrated branch. The fork
retains the SwiftUI companion, forest and locomotion, world context, Luna model
configuration, OpenAI reaction provider and Supermemory work.

The iOS engine now matches upstream's 0.6.4.002 pin. Avatar shaders, import
settings, materials and shared helpers follow upstream; the iOS host links
CoreHaptics required by that SDK. The native player connects to the service
offers channel, acknowledges offers against current voice state, and closes the
offer connection while the scene is inactive. Listening settings travel through
the launcher and persist with its saved development connection.

Upstream's runtime tools, services, game-link, speech timing, silent replies,
Studio, web player, releases, shaders and camera assets remain in the repository.
The iOS close-up cue uses the updated asset and keeps the head in its own camera
rig. Desktop/Browser Studio are separate clients; iOS remains the native companion.
Native history retains reply text, matching upstream's native player rather than
Studio's richer tool-entry history.

Verification:

- Runtime: 328 tests and TypeScript check passed.
- Studio: production build and 37 tests passed.
- Native iOS: Debug and Release engine/framework and SwiftUI builds passed.
- Swift session settings: save/restore, invalid data, preview overrides and
  listening-setting persistence checks passed.
- Physical iPhone 14: signed Release app installed and launched. Offline protocol
  probe accepted a service/game offer, started a conversation turn, processed
  tool-result messages and requested TTS; alignment, PCM and a 3D cue delivered.
- Physical screenshot/UI test: passed; avatar, forest and native controls render.
- Desktop 0.6.4 player: build and rendered preview passed in the preceding
  integration pass.

The physical protocol test uses synthetic speech data and no provider calls.
It does not establish live provider availability, the quality of Luna's tool
choices, or compatibility with every external Neuro game. Those require the
configured providers or game to be running.
