import SwiftUI

enum CameraFraming: UInt32, CaseIterable, Identifiable {
    case fullBody = 0, closeUp = 1
    var id: UInt32 { rawValue }
    var title: String { self == .fullBody ? "Full body" : "Close up" }
}

final class CompanionModel: ObservableObject, HZEventHandler {
    @Published var framing: CameraFraming = .fullBody
    @Published var confirmedFraming: CameraFraming = .fullBody
    @Published var actionError: String?
    @Published var pendingText: UInt32?
    private var nextRequest = UInt32.random(in: 1...UInt32.max - 1)
    let engine = Engine.shared

    init() { engine.handler = self }

    func selectFraming(_ framing: CameraFraming) {
        self.framing = framing
        engine.send(.setFraming(framing.rawValue))
    }

    @discardableResult func submit(_ text: String) -> Bool {
        guard pendingText == nil else { return false }
        nextRequest &+= 1
        let request = nextRequest
        pendingText = request
        guard engine.send(.submitText(requestID: request, text: text)) else {
            pendingText = nil
            actionError = "Couldn’t send this message. Open the iPhone app with a conversation connection and try again."
            return false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            guard let self, self.pendingText == request else { return }
            self.actionError = "This message is still waiting for the companion. Return to the scene to finish sending it."
        }
        return true
    }

    func onTextSubmitted(_ event: HZTextSubmitted) {
        guard pendingText == event.requestID else { return }
        pendingText = nil
        if event.status != 0 {
            actionError = event.status == 1
                ? "Your conversation isn’t connected yet. Please try again when it connects."
                : "This message couldn’t be sent. Please try again."
        }
    }

    func onFramingChanged(_ event: HZFramingChanged) {
        confirmedFraming = CameraFraming(rawValue: event.value) ?? .fullBody
        framing = confirmedFraming
    }
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var detailPresented = false
    @StateObject private var model = CompanionModel()
    @State private var showingSceneOptions = false
    @State private var cardsExpanded = false
    @State private var cardsHeight: CGFloat = 0
    @AppStorage(CompanionProfile.nameKey) private var userName = ""
    @State private var nameDraft = ""


    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                EngineView(engine: model.engine)
                    .ignoresSafeArea()
                HomeView(isExpanded: $cardsExpanded, onDetailVisibilityChange: { visible in
                    detailPresented = visible
                }, onMenu: { nameDraft = userName; showingSceneOptions = true },
                onConversation: { text in model.submit(text) }, actionPending: model.pendingText != nil,
                actionError: $model.actionError)
                    .padding(.top, 8)
                    .onGeometryChange(for: CGFloat.self) { proxy in
                        proxy.size.height
                    } action: { height in
                        cardsHeight = height
                    }
            }
            .onChange(of: cardsExpanded, initial: true) { updateCardsLayout(geometry) }
            .onChange(of: cardsHeight) { updateCardsLayout(geometry) }
            .onChange(of: geometry.size) { updateCardsLayout(geometry) }
        }
        .onAppear { model.selectFraming(model.framing); updateActivity(); updateProfile(); updateDeviceBudget() }
        .onChange(of: scenePhase) {
            updateActivity()
            if scenePhase == .active { updateProfile(); updateDeviceBudget() }
        }
        .onReceive(NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)
            .receive(on: RunLoop.main)) { _ in updateDeviceBudget() }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
            .receive(on: RunLoop.main)) { _ in updateDeviceBudget() }
        .onChange(of: userName) { updateProfile() }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name.NSSystemTimeZoneDidChange)
            .receive(on: RunLoop.main)) { _ in updateProfile() }
        .onChange(of: showingSceneOptions) { updateActivity() }
        .onChange(of: reduceMotion) { updateActivity() }
        .onChange(of: detailPresented) { updateActivity() }
        .modifier(ConversationErrorAlert(message: $model.actionError, enabled: !detailPresented && !showingSceneOptions))
        .sheet(isPresented: $showingSceneOptions) {
            NavigationStack {
                Form {
                    Section {
                        TextField("Your name (optional)", text: $nameDraft)
                            .textContentType(.givenName)
                            .autocorrectionDisabled()
                            .accessibilityIdentifier("CompanionUserName")
                        if !CompanionProfile.validName(nameDraft) {
                            Text("Use up to 40 letters, spaces, apostrophes or hyphens.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    } header: { Text("What should Kloey call you?") }
                    footer: { Text("Saved on this iPhone and shared with the conversation server. Leave blank to keep your name private. Your local time comes from this iPhone's time zone.") }
                    Picker("Framing", selection: Binding(get: { model.framing },
                        set: { model.selectFraming($0) })) {
                        ForEach(CameraFraming.allCases) { framing in
                            Text(framing.title).tag(framing)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("FramingPicker")
                    Section("Explore the clearing") {
                        Text("Drag to look around. Pinch to zoom. Double-tap to return to your companion.")
                        Button("Return to companion") { model.selectFraming(.fullBody) }
                    }
                    Section("Forest credits") {
                        Link("Stylized Nature MegaKit — Quaternius · CC0",
                             destination: URL(string: "https://quaternius.itch.io/stylized-nature-megakit")!)
                    }
                    .font(.caption)
                }
                .navigationTitle("Your view")
                .toolbar {
                    Button("Done") { userName = nameDraft; showingSceneOptions = false }
                        .disabled(!CompanionProfile.validName(nameDraft))
                }
            }
            .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.large] : [.medium, .large])
        }
    }

    private func updateActivity() {
        let active = scenePhase == .active && !detailPresented && !showingSceneOptions
        model.engine.send(.setActivity(flags: (active ? 1 : 0) | (reduceMotion ? 2 : 0)))
    }

    private func updateDeviceBudget() {
        let info = ProcessInfo.processInfo
        model.engine.send(.setDeviceBudget(thermal: UInt32(info.thermalState.rawValue), lowPower: info.isLowPowerModeEnabled))
    }

    private func updateProfile() {
        model.engine.send(CompanionProfile.command(name: userName))
    }

    private func updateCardsLayout(_ geometry: GeometryProxy) {
        let viewportHeight = geometry.size.height + geometry.safeAreaInsets.top + geometry.safeAreaInsets.bottom
        let occupiedHeight = cardsHeight + geometry.safeAreaInsets.top + 16
        let fraction = cardsExpanded && viewportHeight > 0 ? Float(occupiedHeight / viewportHeight) : 0
        model.engine.send(.setCardsLayout(reservedFraction: fraction))
    }

}

struct ConversationErrorAlert: ViewModifier {
    @Binding var message: String?
    var enabled = true
    @State private var showing = false

    func body(content: Content) -> some View {
        content
            .onChange(of: enabled && message != nil, initial: true) { _, visible in showing = visible }
            .onChange(of: showing) { _, visible in
                if !visible && enabled && message != nil { message = nil }
            }
            .alert("Conversation message", isPresented: $showing) {
                Button("OK") { message = nil }
            } message: { Text(message ?? "") }
    }
}

#Preview { ContentView() }
