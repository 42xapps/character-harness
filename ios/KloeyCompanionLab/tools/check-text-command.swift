import Foundation

@main
struct TextCommandCheck {
    final class Receiver: HZEventHandler {
        var received: HZTextSubmitted?
        func onFramingChanged(_ event: HZFramingChanged) {}
        func onTextSubmitted(_ event: HZTextSubmitted) { received = event }
    }
    static func main() throws {
        let text = "My intention: مرحبا Élodie 🦊"
        let data = HZCommand.submitText(requestID: 0x10203040, text: text).encoded()
        precondition(data.count == 1036)
        precondition(Array(data.prefix(8)) == [7, 0, 0, 0, 0x40, 0x30, 0x20, 0x10])
        let count = text.utf8.count
        precondition(String(decoding: data[12..<(12 + count)], as: UTF8.self) == text)
        precondition(data[(12 + count)...].allSatisfy { $0 == 0 })
        precondition(HZCommand.submitText(requestID: 1, text: "").encoded().isEmpty)
        precondition(HZCommand.submitText(requestID: 1, text: "a\0b").encoded().isEmpty)
        precondition(HZCommand.submitText(requestID: 1, text: String(repeating: "a", count: 1024)).encoded().isEmpty)
        precondition(!HZCommand.submitText(requestID: 1, text: String(repeating: "a", count: 1023)).encoded().isEmpty)
        precondition(Array(HZCommand.setDeviceBudget(thermal: 2, lowPower: true).encoded()) == [9, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0])
        let receiver = Receiver()
        HZEventDispatch.dispatch(Data([8, 0, 0, 0, 0x40, 0x30, 0x20, 0x10, 1, 0, 0, 0]), to: receiver)
        precondition(receiver.received?.requestID == 0x10203040 && receiver.received?.status == 1)
        receiver.received = nil
        HZEventDispatch.dispatch(Data([8, 0, 0, 0]), to: receiver)
        precondition(receiver.received == nil)
        if CommandLine.arguments.count == 2 { try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1])) }
        if CommandLine.arguments.count == 3 && CommandLine.arguments[1] == "--ack" {
            let wire = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
            HZEventDispatch.dispatch(wire, to: receiver)
            precondition(receiver.received?.requestID == 0x10203040 && receiver.received?.status == 1)
            print("C-emitted acknowledgement decoded by the real Swift event dispatcher.")
        }
        print("Text command: UTF-8 boundaries, fixed wire layout and acknowledgement dispatch passed.")
    }
}
