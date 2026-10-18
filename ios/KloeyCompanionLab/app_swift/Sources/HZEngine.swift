import Foundation
#if !targetEnvironment(simulator)
import HZEngine
#endif

final class Engine {
    weak var handler: HZEventHandler?

    init() {
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

    deinit {
        #if !targetEnvironment(simulator)
        engine_set_host_recv(nil, nil)
        #endif
    }

    func send(_ command: HZCommand) {
        #if targetEnvironment(simulator)
        if case .setFraming(let value) = command {
            handler?.onFramingChanged(HZFramingChanged(value: value))
        }
        #else
        let data = command.encoded()
        data.withUnsafeBytes { bytes in
            engine_recv(bytes.bindMemory(to: UInt8.self).baseAddress, UInt32(data.count))
        }
        #endif
    }
}
