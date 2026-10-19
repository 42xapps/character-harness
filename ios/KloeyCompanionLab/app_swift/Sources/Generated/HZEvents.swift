import Foundation

// Command tag 9 carries an 8-byte device budget and has no reply.
// Command tag 6 carries the 226-byte companion profile; it has no reply event.

struct HZFramingChanged { var value: UInt32 = 0 }
struct HZTextSubmitted { var requestID: UInt32 = 0; var status: UInt32 = 0 }

protocol HZEventHandler: AnyObject {
    func onFramingChanged(_ event: HZFramingChanged)
    func onTextSubmitted(_ event: HZTextSubmitted)
}

extension HZEventHandler {
    func onTextSubmitted(_ event: HZTextSubmitted) {}
}

enum HZEventDispatch {
    static func dispatch(_ data: Data, to handler: HZEventHandler) {
        guard data.count >= 4 else { return }
        assert(MemoryLayout<HZFramingChanged>.size == 4)
        var tag: UInt32 = 0
        _ = withUnsafeMutableBytes(of: &tag) { data.copyBytes(to: $0, from: 0..<4) }
        switch UInt32(littleEndian: tag) {
        case 2 where data.count == 8:
            var message = HZFramingChanged()
            _ = withUnsafeMutableBytes(of: &message) { data.copyBytes(to: $0, from: 4..<8) }
            handler.onFramingChanged(message)
        case 8 where data.count == 12:
            assert(MemoryLayout<HZTextSubmitted>.size == 8)
            var message = HZTextSubmitted()
            _ = withUnsafeMutableBytes(of: &message) { data.copyBytes(to: $0, from: 4..<12) }
            handler.onTextSubmitted(message)
        default: break
        }
    }
}
