# Companion Lab SwiftUI host

- This is the native SwiftUI half. `../app` is the Kaigen C/asset project.
- Open `KloeyCompanionLab.xcodeproj`; the sources are under `Sources/`.
- `project.yml` is the regeneration source. XcodeGen is installed on this Mac.
- SwiftUI-only changes build in Xcode. Engine changes first run `../build-engine.sh`.
- The native engine framework is linked only for iphoneos. Simulator compiles a
  deliberate viewport placeholder so native cards/sheets can be developed there.
- Keep required Apple frameworks and conditional device link settings in sync.
- Host commands/events are four-byte tags plus fixed-size POD payloads. Keep the
  two Swift files under `Sources/Generated` and the C `host_msgs.gen.h/.c` in sync.
  Tag 1 is SetFraming (4 bytes); tag 2 is FramingChanged (4 bytes); tag 3 is OrbitCamera (12 bytes: yaw, pitch, zoom Floats); tag 4 is SetCardsLayout (4-byte Float: reserved top fraction). Tag 5 is SetActivity (4-byte UInt32 flags: active bit 0, Reduce Motion bit 1). No generator currently exists.
- Engine callbacks hop to the main queue before updating observable Swift state.
- Do not add buttons for waving/gesturing; live character performance belongs
  to the conversation harness. The framing control is a scene/camera preference.
- App.swift is this lab's @main only. Do not copy it over Kloey's app entry point.
- CompanionSessionSettings saves only the development address/character in the
  Keychain and restores launch environment before HZEngineView starts. Preserve
  explicit launch/preview overrides. Provider keys never belong in the host.
- Verify builds and read visual captures. Distinguish Simulator UI validation,
  desktop scene validation and physical-device validation in reports.

- ContentView owns cardsExpanded (false by default). HomeView takes its binding and stays intrinsically sized with no scene background or trailing Spacer. Its measured height drives camera headroom through tag 4. Keep the engine view full screen; do not scale the Metal view or avatar to fit cards.

- ContentView sends scene/detail visibility and Reduce Motion through tag 5. HomeView reports detail visibility through onDetailVisibilityChange. Preserve a fresh quiet interval after returning; cards expanding alone should not pause the companion.

- Tag 6 is SetCompanionProfile: 226 bytes, two fixed NUL-terminated UTF-8 fields (65 bytes for the IANA zone, 161 for the optional name). HZMessages encodes zero-padded fields; the C struct has a size assertion. It has no reply event. Preserve all existing message tags and sizes.
- ContentView sends the current phone zone and explicitly entered name on appearance, foreground, zone change and saved-name change. The top-left HomeView menu opens these native settings. The lab stores the name in UserDefaults; never infer it from the device or Apple ID. Kloey integration should supply its authenticated profile instead. Empty sends null in scene telemetry to clear the session name. Newlines, markup and names over 40 Unicode scalars are rejected.
- Deliver system-zone notifications on the main run loop before sending a profile command; the host boundary is a single UI-thread producer.
