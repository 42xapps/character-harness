import XCTest

// Generic, scriptable UI driver — the XCUITest analog of the engine's
// `--commands` harness, but it drives the *whole* app (native SwiftUI controls
// AND the engine's Metal view) and its screenshots capture the real composited
// screen (engine 3D + SwiftUI + keyboard), which the engine's own PNG dump
// cannot see.
//
// The command script is passed via the TEST_RUNNER_CMDS env var (xcodebuild
// strips the TEST_RUNNER_ prefix, so the test reads it as CMDS). Commands are
// ';'-separated; each is "<op> <arg>":
//
//   wait <seconds>            sleep
//   tap <nx>,<ny>             tap at normalized screen coords (for the engine)
//   tapId <accessibilityId>   tap a native control by accessibility identifier
//   type <text>               type into the focused control
//   shot <name>               capture the full screen as a named attachment
//
// Screenshots land in the .xcresult as attachments; shot.sh extracts them.
final class Driver: XCTestCase {
    func testRunCommands() throws {
        continueAfterFailure = true
        let app = XCUIApplication()
        if let preview = ProcessInfo.processInfo.environment["LAUNCH_PREVIEW"] {
            app.launchEnvironment["HARNESS_PREVIEW"] = preview
            app.launchEnvironment["HARNESS_CHARACTER"] = "foxglove"
        }
        app.launch()

        let script = ProcessInfo.processInfo.environment["CMDS"] ?? "wait 2; shot default"
        for raw in script.split(separator: ";") {
            let cmd = raw.trimmingCharacters(in: .whitespaces)
            if cmd.isEmpty { continue }
            let bits = cmd.split(separator: " ", maxSplits: 1).map(String.init)
            let op = bits[0]
            let arg = bits.count > 1 ? bits[1].trimmingCharacters(in: .whitespaces) : ""

            switch op {
            case "background":
                XCUIDevice.shared.press(.home)

            case "activate":
                app.activate()

            case "wait":
                Thread.sleep(forTimeInterval: Double(arg) ?? 1.0)

            case "tap":
                let xy = arg.split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0.5 }
                let nx = xy.count > 0 ? xy[0] : 0.5
                let ny = xy.count > 1 ? xy[1] : 0.5
                app.coordinate(withNormalizedOffset: CGVector(dx: nx, dy: ny)).tap()

            case "tapId":
                app.descendants(matching: .any)[arg].firstMatch.tap()

            case "type":
                app.typeText(arg)

            case "submit":
                app.typeText("\n")   // Return -> SwiftUI .onSubmit

            case "drag":
                let v = arg.split(separator: ",").compactMap { Double($0) }
                guard v.count == 4 else { XCTFail("drag needs x1,y1,x2,y2"); continue }
                let start = app.coordinate(withNormalizedOffset: CGVector(dx: v[0], dy: v[1]))
                let end = app.coordinate(withNormalizedOffset: CGVector(dx: v[2], dy: v[3]))
                start.press(forDuration: 0.05, thenDragTo: end)

            case "pinch":
                let scale = CGFloat(Double(arg) ?? 1)
                app.descendants(matching: .any)["CompanionWorld"].firstMatch.pinch(withScale: scale, velocity: scale < 1 ? -1 : 1)

            case "doubleTapWorld":
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)).doubleTap()

            case "expectId":
                XCTAssertTrue(app.descendants(matching: .any)[arg].firstMatch.waitForExistence(timeout: 4))

            case "expectAbsent":
                XCTAssertFalse(app.descendants(matching: .any)[arg].firstMatch.exists)

            case "expectText":
                XCTAssertTrue(app.staticTexts[arg].firstMatch.waitForExistence(timeout: 4), "Missing text: \(arg)")

            case "shot":
                let shot = XCUIScreen.main.screenshot()
                let att = XCTAttachment(screenshot: shot)
                att.name = arg.isEmpty ? "shot" : arg
                att.lifetime = .keepAlways
                add(att)

            default:
                XCTFail("unknown command: \(op)")
            }
        }
    }
}
