import Foundation

let first = ["HARNESS_URL": "ws://192.168.1.2:8788/session/test", "HARNESS_CHARACTER": "foxglove"]
var saved: Data?
var applied: [String: String] = [:]
var writes = 0

func prepare(_ environment: [String: String]) {
    CompanionSessionSettings.prepare(environment: environment, load: { saved },
        save: { saved = $0; writes += 1 }, apply: { applied[$0] = $1 })
}

prepare([:])
precondition(applied.isEmpty && saved == nil)
prepare(first)
precondition(saved != nil && applied.isEmpty && writes == 1)
prepare([:])
precondition(applied == first)

for mode in ["HARNESS_PREVIEW", "HARNESS_SCREENSHOT"] {
    applied = [:]
    prepare([mode: "explicit-preview"])
    precondition(applied.isEmpty && writes == 1)
}

for explicit in [["HARNESS_URL": first["HARNESS_URL"]!],
                 ["HARNESS_CHARACTER": "another-character"],
                 ["HARNESS_URL": "https://example.com", "HARNESS_CHARACTER": "foxglove"],
                 ["HARNESS_URL": first["HARNESS_URL"]!, "HARNESS_CHARACTER": String(repeating: "é", count: 256)]] {
    applied = [:]
    prepare(explicit)
    precondition(applied.isEmpty && writes == 1)
}

let replacement = ["HARNESS_URL": "wss://example.com/session/new", "HARNESS_CHARACTER": "another-character"]
prepare(replacement)
precondition(writes == 2)
prepare([:])
precondition(applied == replacement)

for corrupt in [Data("broken".utf8),
                try JSONEncoder().encode(CompanionSessionSettings(url: "file:///tmp/test", character: "foxglove")),
                try JSONEncoder().encode(CompanionSessionSettings(url: first["HARNESS_URL"]!, character: "bad\ncharacter"))] {
    saved = corrupt
    applied = [:]
    prepare([:])
    precondition(applied.isEmpty)
}
print("Session settings checks passed: save, restore, replacement, preview override, partial settings, byte limits and corrupt data.")

let orbit = HZCommand.orbitCamera(yaw: 0.25, pitch: -0.1, zoom: 0.3).encoded()
precondition(orbit.count == 16)
precondition(orbit.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) } == 3)
let orbitPayload = orbit.dropFirst(4).withUnsafeBytes { $0.loadUnaligned(as: HZOrbitCamera.self) }
precondition(orbitPayload.yaw == 0.25 && orbitPayload.pitch == -0.1 && orbitPayload.zoom == 0.3)
precondition(HZCommand.setFraming(1).encoded().count == 8)
print("Camera message contracts passed")

let cardsLayout = HZCommand.setCardsLayout(reservedFraction: 0.4).encoded()
precondition(cardsLayout.count == 8)
precondition(cardsLayout.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) } == 4)
let cardsFraction = cardsLayout.dropFirst(4).withUnsafeBytes { $0.loadUnaligned(as: HZSetCardsLayout.self) }
precondition(cardsFraction.reservedFraction == 0.4)
print("Cards layout message contract passed")

for flags: UInt32 in [0, 1, 2, 3] {
    let activity = HZCommand.setActivity(flags: flags).encoded()
    precondition(activity.count == 8)
    precondition(activity.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) } == 5)
    precondition(activity.dropFirst(4).withUnsafeBytes { $0.loadUnaligned(as: HZSetActivity.self) }.flags == flags)
}
print("Activity/Reduce Motion message contract passed")
