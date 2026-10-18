import SwiftUI

enum CameraFraming: UInt32, CaseIterable, Identifiable {
    case fullBody = 0, closeUp = 1
    var id: UInt32 { rawValue }
    var title: String { self == .fullBody ? "Full body" : "Close up" }
}

final class CompanionModel: ObservableObject, HZEventHandler {
    @Published var framing: CameraFraming = .fullBody
    @Published var confirmedFraming: CameraFraming = .fullBody
    @Published var intention = "Make room for a small win."
    let engine = Engine()

    init() { engine.handler = self }

    func selectFraming(_ framing: CameraFraming) {
        self.framing = framing
        engine.send(.setFraming(framing.rawValue))
    }

    func onFramingChanged(_ event: HZFramingChanged) {
        confirmedFraming = CameraFraming(rawValue: event.value) ?? .fullBody
        framing = confirmedFraming
    }
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var detailPresented = false
    @StateObject private var model = CompanionModel()
    @State private var showingIntentions = false
    @State private var showingSceneOptions = false
    @State private var cardsExpanded = false
    @State private var cardsHeight: CGFloat = 0
    @AppStorage(CompanionProfile.nameKey) private var userName = ""
    @State private var nameDraft = ""
    private let intentions = ["Make room for a small win.", "Take a moment to recharge.",
                              "Be present for someone you love."]

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                EngineView(engine: model.engine)
                    .ignoresSafeArea()
                HomeView(isExpanded: $cardsExpanded, onDetailVisibilityChange: { visible in
                    detailPresented = visible
                }, onMenu: { nameDraft = userName; showingSceneOptions = true })
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
        .onAppear { model.selectFraming(model.framing); updateActivity(); updateProfile() }
        .onChange(of: scenePhase) {
            updateActivity()
            if scenePhase == .active { updateProfile() }
        }
        .onChange(of: userName) { updateProfile() }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name.NSSystemTimeZoneDidChange)
            .receive(on: RunLoop.main)) { _ in updateProfile() }
        .onChange(of: showingSceneOptions) { updateActivity() }
        .onChange(of: reduceMotion) { updateActivity() }
        .onChange(of: detailPresented) { updateActivity() }
        .sheet(isPresented: $showingIntentions) {
            NavigationStack {
                List(intentions, id: \.self) { intention in
                    Button {
                        model.intention = intention
                        showingIntentions = false
                    } label: {
                        HStack {
                            Text(intention).foregroundStyle(.primary)
                            Spacer()
                            if intention == model.intention {
                                Image(systemName: "checkmark").foregroundStyle(.green)
                            }
                        }
                    }
                }
                .navigationTitle("An intention for today")
                .toolbar { Button("Done") { showingIntentions = false } }
            }
            .presentationDetents([.medium])
        }
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
            .presentationDetents([.medium])
        }
    }

    private func updateActivity() {
        let active = scenePhase == .active && !detailPresented && !showingSceneOptions
        model.engine.send(.setActivity(flags: (active ? 1 : 0) | (reduceMotion ? 2 : 0)))
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

    private var intentionCard: some View {
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 7) {
                Text("TODAY’S INTENTION")
                    .font(.caption2.weight(.semibold)).tracking(1.5)
                    .foregroundStyle(.secondary)
                Text(model.intention)
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Button("Choose") { showingIntentions = true }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.18, green: 0.29, blue: 0.24))
                .accessibilityIdentifier("ChooseIntentionButton")
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 26))
        .accessibilityIdentifier("IntentionCard")
    }
}

#Preview { ContentView() }
