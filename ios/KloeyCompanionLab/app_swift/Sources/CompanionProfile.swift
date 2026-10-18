import Foundation

enum CompanionProfile {
    static let nameKey = "companion.userName"

    static func validName(_ value: String) -> Bool {
        value.isEmpty || (value.unicodeScalars.count <= 40 &&
            value.range(of: #"\A[\p{L}\p{M}][\p{L}\p{M}'’ -]*\z"#, options: .regularExpression) != nil)
    }

    static func command(name: String, timezone: TimeZone = .current) -> HZCommand {
        .setCompanionProfile(timezone: timezone.identifier, name: validName(name) ? name : "")
    }
}
