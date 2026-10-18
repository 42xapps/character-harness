import Foundation

@main
struct ProfileContractCheck {
    static func main() {
        for name in ["", "Élodie", "مريم", "O’Neill", String(repeating: "𐐀", count: 40)] {
            precondition(CompanionProfile.validName(name))
            let command = CompanionProfile.command(name: name, timezone: TimeZone(identifier: "Africa/Casablanca")!)
            let bytes = Array(command.encoded())
            precondition(bytes.count == 230 && bytes.prefix(4) == [6, 0, 0, 0])
            let zone = String(decoding: bytes[4..<69].prefix(while: { $0 != 0 }), as: UTF8.self)
            let decodedName = String(decoding: bytes[69..<230].prefix(while: { $0 != 0 }), as: UTF8.self)
            precondition(zone == "Africa/Casablanca" && decodedName == name)
            precondition(bytes[68] == 0 && bytes[229] == 0)
        }
        for name in ["<instructions>", "Name\norders", String(repeating: "a", count: 41), "🦊", "   "] {
            precondition(!CompanionProfile.validName(name))
        }
        precondition(HZCommand.setCompanionProfile(timezone: String(repeating: "x", count: 65), name: "").encoded().isEmpty)
        precondition(HZCommand.setActivity(flags: 1).encoded().count == 8)
        precondition(HZCommand.orbitCamera(yaw: 0, pitch: 0, zoom: 0).encoded().count == 16)
        print("Companion profile: Unicode validation, exact names, wire lengths, zero padding and existing commands passed.")
    }
}
