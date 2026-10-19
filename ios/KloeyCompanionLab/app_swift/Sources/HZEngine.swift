import Foundation
#if !targetEnvironment(simulator)
import HZEngine
#endif

final class Engine {
    static let shared = Engine()
    weak var handler: HZEventHandler?

    private init() {
        precondition(Thread.isMainThread)
        #if !targetEnvironment(simulator)
        engine_set_host_recv({ buffer, count, context in
            guard let buffer, let context else { return }
            let data = Data(bytes: buffer, count: Int(count))
            let engine = Unmanaged<Engine>.fromOpaque(context).takeUnretainedValue()
            DispatchQueue.main.async {
                guard let handler = engine.handler else { return }
                HZEventDispatch.dispatch(data, to: handler)
            }
        }, Unmanaged.passUnretained(self).toOpaque())
        #endif
    }

    @discardableResult func send(_ command: HZCommand) -> Bool {
        precondition(Thread.isMainThread)
        #if targetEnvironment(simulator)
        if case .setFraming(let value) = command {
            handler?.onFramingChanged(HZFramingChanged(value: value))
        }
        if case .submitText = command { return false }
        return true
        #else
        let data = command.encoded()
        guard !data.isEmpty else { return false }
        return data.withUnsafeBytes { bytes in
            engine_recv(bytes.bindMemory(to: UInt8.self).baseAddress, UInt32(data.count))
        } != 0
        #endif
    }
}
