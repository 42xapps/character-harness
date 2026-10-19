import Foundation

struct HZSetActivity { var flags: UInt32 }
struct HZSetCardsLayout { var reservedFraction: Float }
struct HZSetFraming { var value: UInt32 = 0 }
struct HZOrbitCamera { var yaw: Float; var pitch: Float; var zoom: Float }

enum HZCommand {
    case setDeviceBudget(thermal: UInt32, lowPower: Bool)
    case submitText(requestID: UInt32, text: String)
    case setCompanionProfile(timezone: String, name: String)
    case setActivity(flags: UInt32)
    case setFraming(UInt32)
    case setCardsLayout(reservedFraction: Float)
    case orbitCamera(yaw: Float, pitch: Float, zoom: Float)

    func encoded() -> Data {
        var data = Data()
        func append<T>(_ value: T) {
            var copy = value
            withUnsafeBytes(of: &copy) { data.append(contentsOf: $0) }
        }
        switch self {
        case .setDeviceBudget(let thermal, let lowPower):
            append(UInt32(9).littleEndian)
            append(thermal.littleEndian)
            append(UInt32(lowPower ? 1 : 0).littleEndian)
        case .submitText(let requestID, let text):
            let bytes = Array(text.utf8)
            guard !bytes.isEmpty, bytes.count < 1024, !bytes.contains(0) else { return Data() }
            append(UInt32(7).littleEndian)
            append(requestID.littleEndian)
            append(UInt32(bytes.count).littleEndian)
            data.append(contentsOf: bytes)
            data.append(Data(repeating: 0, count: 1024 - bytes.count))
            assert(data.count == 1036)
        case .setCompanionProfile(let timezone, let name):
            append(UInt32(6).littleEndian)
            // Match HZSetCompanionProfile's two NUL-terminated UTF-8 fields.
            for (value, capacity) in [(timezone, 65), (name, 161)] {
                let bytes = Array(value.utf8)
                guard bytes.count < capacity else { return Data() }
                data.append(contentsOf: bytes)
                data.append(Data(repeating: 0, count: capacity - bytes.count))
            }
            assert(data.count == 4 + 226)
        case .setActivity(let flags):
            assert(MemoryLayout<HZSetActivity>.size == 4)
            append(UInt32(5).littleEndian)
            append(HZSetActivity(flags: flags))
        case .setCardsLayout(let fraction):
            assert(MemoryLayout<HZSetCardsLayout>.size == 4)
            append(UInt32(4).littleEndian)
            append(HZSetCardsLayout(reservedFraction: fraction))
        case .setFraming(let mode):
            assert(MemoryLayout<HZSetFraming>.size == 4)
            append(UInt32(1).littleEndian)
            append(HZSetFraming(value: mode))
        case .orbitCamera(let yaw, let pitch, let zoom):
            assert(MemoryLayout<HZOrbitCamera>.size == 12)
            append(UInt32(3).littleEndian)
            append(HZOrbitCamera(yaw: yaw, pitch: pitch, zoom: zoom))
        }
        return data
    }
}
