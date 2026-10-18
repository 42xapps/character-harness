import Foundation

struct HZSetActivity { var flags: UInt32 }
struct HZSetCardsLayout { var reservedFraction: Float }
struct HZSetFraming { var value: UInt32 = 0 }
struct HZOrbitCamera { var yaw: Float; var pitch: Float; var zoom: Float }

enum HZCommand {
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
