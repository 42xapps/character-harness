import Foundation

struct HZFramingChanged { var value: UInt32 = 0 }

protocol HZEventHandler: AnyObject {
    func onFramingChanged(_ event: HZFramingChanged)
}

enum HZEventDispatch {
    static func dispatch(_ data: Data, to handler: HZEventHandler) {
        guard data.count == 8 else { return }
        assert(MemoryLayout<HZFramingChanged>.size == 4)
        var tag: UInt32 = 0
        _ = withUnsafeMutableBytes(of: &tag) { data.copyBytes(to: $0, from: 0..<4) }
        guard UInt32(littleEndian: tag) == 2 else { return }
        var message = HZFramingChanged()
        _ = withUnsafeMutableBytes(of: &message) { data.copyBytes(to: $0, from: 4..<8) }
        handler.onFramingChanged(message)
    }
}
