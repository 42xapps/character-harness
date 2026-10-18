import SwiftUI
#if !targetEnvironment(simulator)
import HZEngine

struct EngineView: UIViewRepresentable {
    let engine: Engine
    func makeCoordinator() -> Coordinator { Coordinator(engine: engine) }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let engine: Engine
        init(engine: Engine) { self.engine = engine }
        @objc func pan(_ gesture: UIPanGestureRecognizer) {
            guard gesture.state == .changed else { return }
            let delta = gesture.translation(in: gesture.view)
            gesture.setTranslation(.zero, in: gesture.view)
            engine.send(.orbitCamera(yaw: Float(-delta.x * 0.006),
                                     pitch: Float(delta.y * 0.004), zoom: 0))
        }
        @objc func pinch(_ gesture: UIPinchGestureRecognizer) {
            guard gesture.state == .changed, gesture.scale.isFinite, gesture.scale > 0 else { return }
            engine.send(.orbitCamera(yaw: 0, pitch: 0, zoom: Float(-log(gesture.scale))))
            gesture.scale = 1
        }
        @objc func reset(_ gesture: UITapGestureRecognizer) { engine.send(.setFraming(0)) }
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
    }
    func makeUIView(context: Context) -> HZEngineView {
        CompanionSessionSettings.prepare()
        let view = HZEngineView(frame: .zero)
        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pan(_:)))
        pan.maximumNumberOfTouches = 1
        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pinch(_:)))
        let reset = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.reset(_:)))
        reset.numberOfTapsRequired = 2
        for gesture in [pan, pinch, reset] {
            gesture.delegate = context.coordinator
            view.addGestureRecognizer(gesture)
        }
        view.accessibilityIdentifier = "CompanionWorld"
        view.isAccessibilityElement = true
        view.accessibilityLabel = "Companion forest. Drag to orbit, pinch to zoom, double-tap to reset."
        return view
    }
    func updateUIView(_ view: HZEngineView, context: Context) {}
}
#else
struct EngineView: View {
    let engine: Engine
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.27, green: 0.47, blue: 0.42),
                                    Color(red: 0.68, green: 0.76, blue: 0.56)],
                           startPoint: .top, endPoint: .bottom)
            VStack(spacing: 18) {
                Image(systemName: "figure.stand")
                    .font(.system(size: 140, weight: .ultraLight))
                Text("Your 3D companion appears on iPhone")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
            }
            .foregroundStyle(.white.opacity(0.9))
            .padding(32)
        }
    }
}
#endif
