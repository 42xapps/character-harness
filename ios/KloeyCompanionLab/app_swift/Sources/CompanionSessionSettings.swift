import Foundation
import Security

struct CompanionSessionSettings: Codable {
    let url: String
    let character: String

    private var isValid: Bool {
        guard !url.isEmpty, url.utf8.count < 512,
              url.rangeOfCharacter(from: .whitespacesAndNewlines) == nil,
              !url.contains("\0"),
              !character.isEmpty, character.utf8.count < 512,
              character.rangeOfCharacter(from: .newlines) == nil,
              !character.contains("\0"),
              let address = URLComponents(string: url),
              ["ws", "wss"].contains(address.scheme?.lowercased() ?? ""),
              let host = address.host, !host.isEmpty else { return false }
        return true
    }

    // Restore before HZEngineView starts its native engine threads.
    static func prepare(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        load: () -> Data? = readSaved,
        save: (Data) -> Void = writeSaved,
        apply: (String, String) -> Void = { setenv($0, $1, 1) }
    ) {
        guard (environment["HARNESS_PREVIEW"] ?? "").isEmpty,
              (environment["HARNESS_SCREENSHOT"] ?? "").isEmpty else { return }
        let url = environment["HARNESS_URL"] ?? ""
        let character = environment["HARNESS_CHARACTER"] ?? ""
        if !url.isEmpty || !character.isEmpty {
            let settings = Self(url: url, character: character)
            if settings.isValid, let data = try? JSONEncoder().encode(settings) {
                save(data)
            }
            return
        }
        guard let data = load(),
              let settings = try? JSONDecoder().decode(Self.self, from: data),
              settings.isValid else { return }
        apply("HARNESS_URL", settings.url)
        apply("HARNESS_CHARACTER", settings.character)
    }

    private static var keychainQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.kaigen.kloeycompanionlab.development-session",
         kSecAttrAccount as String: "last-session"]
    }

    private static func readSaved() -> Data? {
        var query = keychainQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess
        else { return nil }
        return result as? Data
    }

    private static func writeSaved(_ data: Data) {
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        var status = SecItemUpdate(keychainQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            let item = keychainQuery.merging(attributes) { _, new in new }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        if status != errSecSuccess {
            NSLog("Companion connection could not be saved (status %d).", status)
        }
    }
}
