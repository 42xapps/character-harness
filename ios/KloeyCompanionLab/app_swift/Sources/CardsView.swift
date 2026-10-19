import SwiftUI

// iOS 18+ (MeshGradient). Swift 6 / SwiftUI.

// MARK: - Theme

extension Color {
    init(hex: UInt) {
        self.init(red: Double(hex >> 16 & 0xFF) / 255,
                  green: Double(hex >> 8 & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
    static let ink = Color(hex: 0x2A2A3C)
}

extension MeshGradient {
    /// Orange → teal → red gradient shared by the card and the detail screen.
    static var sunrise: MeshGradient {
        let colors: [Color] = [0xC47A50, 0x6FAAA8, 0x45B8CE,
                               0xD4704E, 0xA87A80, 0x8A7D95,
                               0xF2592F, 0xE04A4A, 0xE8364A].map { Color(hex: $0) }
        return MeshGradient(width: 3, height: 3,
                            points: [[0, 0], [0.5, 0], [1, 0],
                                     [0, 0.5], [0.5, 0.5], [1, 0.5],
                                     [0, 1], [0.5, 1], [1, 1]],
                            colors: colors)
    }
}

// MARK: - Model

enum CardKind: String, CaseIterable, Identifiable {
    case intentions, affirmation, wellbeing, question
    var id: Self { self }

    var eyebrow: LocalizedStringKey {
        switch self {
        case .intentions: "Intentions"
        case .affirmation: "Daily Affirmation"
        case .wellbeing: "Wellbeing"
        case .question: "Quick Question"
        }
    }
    var title: LocalizedStringKey {
        switch self {
        case .intentions: "Where’s your focus today?"
        case .affirmation: "Reveal your daily affirmation"
        case .wellbeing: "What moments have brought you the deepest satisfaction?"
        case .question: "When were you accidentally right?"
        }
    }
    /// `nil` means the card uses a round play button.
    var buttonTitle: LocalizedStringKey? {
        switch self {
        case .intentions: "Choose now"
        case .affirmation: nil
        case .wellbeing: "Start"
        case .question: "Start chat"
        }
    }
    var conversationPrompt: String {
        switch self {
        case .intentions: "I’d like to choose an intention for today."
        case .affirmation: "Can we talk about this affirmation: \(Self.affirmationText)"
        case .wellbeing: "Help me reflect on moments that brought me satisfaction."
        case .question: "Let’s talk about a time I was accidentally right."
        }
    }
    static let intentionChoices = ["Make room for a small win.", "Take a moment to recharge.",
                             "Be present for someone you love."]

    var fill: AnyShapeStyle {
        switch self {
        case .intentions:
            AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x58B9F2), Color(hex: 0xB9F3FD)],
                                         startPoint: .top, endPoint: .bottom))
        case .affirmation:
            AnyShapeStyle(MeshGradient.sunrise)
        case .wellbeing:
            AnyShapeStyle(LinearGradient(colors: [Color(hex: 0x46548C), Color(hex: 0x1D1440), Color(hex: 0x1A1235)],
                                         startPoint: .top, endPoint: .bottom))
        case .question:
            AnyShapeStyle(Color(hex: 0xFAF8F3))
        }
    }
    var isLight: Bool { self == .question || self == .intentions }
    var foreground: Color { isLight ? .ink : .white }
    var contrast: Color { isLight ? .white : .ink }
    var isDismissible: Bool { self != .question }

    var symbol: String {
        switch self {
        case .intentions: "scope"
        case .affirmation: "sunrise.fill"
        case .wellbeing: "moon.stars.fill"
        case .question: "questionmark.bubble.fill"
        }
    }
    static let affirmationText = "I back my hunger for more with consistent, intentional action today."
    /// Large text on the full-screen detail.
    var detailText: LocalizedStringKey {
        self == .affirmation ? LocalizedStringKey(Self.affirmationText) : title
    }
}

// MARK: - Reusable pieces

/// White circular icon button (carousel toggle and detail "next").
struct CircleButton: View {
    let symbol: String
    var size: CGFloat = 48
    var fill: Color = .white
    var ink: Color = .ink
    let label: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size * 0.30, weight: .semibold))
                .foregroundStyle(ink)
                .frame(width: size, height: size)
                .background(fill, in: .circle)
        }
        .accessibilityLabel(label)
    }
}

/// Pill/circle button with a soft outer halo.
struct HaloButtonStyle: ButtonStyle {
    let fill: Color
    let ink: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(ink)
            .background(fill, in: .capsule)
            .padding(5)
            .background(fill.opacity(0.2), in: .capsule)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .animation(reduceMotion ? nil : .snappy, value: configuration.isPressed)
    }
}

/// Small caps title with a short rule beneath it.
struct Eyebrow: View {
    let text: LocalizedStringKey
    var font: Font = .footnote.weight(.semibold)
    var rule: CGFloat = 27

    var body: some View {
        VStack(spacing: 11) {
            Text(text).font(font).textCase(.uppercase).tracking(2.5)
            Capsule().frame(width: rule, height: 1.5)
        }
    }
}

// MARK: - Card

private struct Diamond {
    let x, y, size: CGFloat
    let color: Color
    var filled = true
}

private let diamonds: [Diamond] = [
    .init(x: 51, y: 24, size: 13, color: Color(hex: 0x2F6B9A), filled: false),
    .init(x: 231, y: 32, size: 8, color: .white.opacity(0.6)),
    .init(x: 275, y: 39, size: 13, color: Color(hex: 0x9DA8F0), filled: false),
    .init(x: 287, y: 87, size: 14, color: Color(hex: 0xA3CB4E)),
    .init(x: 26, y: 102, size: 8, color: Color(hex: 0x2F6B9A)),
    .init(x: 78, y: 96, size: 13, color: .white.opacity(0.5), filled: false),
    .init(x: 224, y: 116, size: 11, color: Color(hex: 0x2F6B9A).opacity(0.8)),
    .init(x: 61, y: 151, size: 14, color: .white),
    .init(x: 267, y: 157, size: 7, color: Color(hex: 0x9DA8F0), filled: false),
    .init(x: 193, y: 179, size: 8, color: Color(hex: 0xA3CB4E)),
]

private struct Diamonds: View {
    var body: some View {
        ZStack {
            ForEach(diamonds.indices, id: \.self) { i in
                let d = diamonds[i]
                Rectangle()
                    .fill(d.filled ? d.color : .clear)
                    .overlay(Rectangle().strokeBorder(d.color, lineWidth: 1.5))
                    .frame(width: d.size, height: d.size)
                    .rotationEffect(.degrees(45))
                    .position(x: d.x, y: d.y)
            }
        }
    }
}

struct CardView: View {
    let kind: CardKind
    let onAction: () -> Void
    let onDismiss: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private static let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)

    var body: some View {
        VStack(spacing: 0) {
            Eyebrow(text: kind.eyebrow)
                .padding(.horizontal, 48)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 12)
            Text(kind.title)
                .font(.system(.title3, design: .serif))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 32)
            Spacer(minLength: 12)
            actionButton
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
        .frame(minHeight: 188)
        .background(kind.fill, in: Self.shape)
        .overlay {
            if !dynamicTypeSize.isAccessibilitySize {
                decoration.allowsHitTesting(false).accessibilityHidden(true)
            }
        }
        .overlay(alignment: .topTrailing) { accessories }
        .foregroundStyle(kind.foreground)
        .contentShape(Self.shape)
        .accessibilityAction(named: kind.buttonTitle ?? "Open affirmation", onAction)
    }

    private var actionButton: some View {
        Button(action: onAction) {
            if let title = kind.buttonTitle {
                Text(title).font(.headline).multilineTextAlignment(.center)
                    .lineLimit(nil).fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 16).frame(minHeight: 44)
            } else {
                Label("Reveal affirmation", systemImage: "play.fill").labelStyle(.iconOnly).frame(width: 44, height: 44)
            }
        }
        .buttonStyle(HaloButtonStyle(fill: kind.foreground, ink: kind.contrast))
        .accessibilityIdentifier("CardAction_\(kind.rawValue)")
    }

    @ViewBuilder private var decoration: some View {
        switch kind {
        case .intentions:
            Diamonds()
        case .wellbeing:
            Self.shape.strokeBorder(.white.opacity(0.3), lineWidth: 2)
        case .question:
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color(hex: 0xDDD6C8),
                              style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [18, 14]))
                .padding(10)
        case .affirmation:
            EmptyView()
        }
    }

    private var accessories: some View {
        HStack(spacing: 0) {
            if kind == .wellbeing {
                Button(action: onAction) {
                    Image(systemName: "text.bubble.fill").font(.system(size: 18)).frame(width: 44, height: 44)
                }
                .accessibilityLabel("Chat")
            }
            if kind.isDismissible {
                Button(action: onDismiss) {
                    Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).opacity(0.6)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Dismiss")
            }
        }
        .padding(.top, 6)
        .padding(.trailing, 3)
    }
}

// MARK: - Home

struct HomeView: View {
    @State private var cards = CardKind.allCases
    @State private var selection: CardKind? = .intentions
    @Binding var isExpanded: Bool
    var onDetailVisibilityChange: (Bool) -> Void = { _ in }
    var onMenu: () -> Void = {}
    var onConversation: (String) -> Bool = { _ in false }
    var actionPending = false
    @Binding var actionError: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presented: CardKind?
    @Namespace private var zoom

    /// Cards still ahead of the current one.
    private var unseen: Int {
        selection.flatMap(cards.firstIndex(of:)).map { cards.count - 1 - $0 } ?? 0
    }

    var body: some View {
        VStack(spacing: 24) {
            topBar
            if isExpanded {
                carousel.transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .fullScreenCover(item: $presented) { kind in
            let detail = DetailView(kind: kind, actionError: $actionError, onConversation: { text in
                let accepted = onConversation(text)
                if accepted { isExpanded = false }
                return accepted
            })
            if reduceMotion { detail }
            else { detail.navigationTransition(.zoom(sourceID: kind, in: zoom)) }
        }
        .onChange(of: presented != nil) { _, visible in onDetailVisibilityChange(visible) }
        .sensoryFeedback(.selection, trigger: selection)
        .preferredColorScheme(.dark)
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack {
            barButton("Menu", alignment: .leading, action: onMenu) {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach([23, 17, 13] as [CGFloat], id: \.self) { Capsule().frame(width: $0, height: 2.5) }
                }
            }
            Spacer()

        }
        .foregroundStyle(.white)
        .padding(.horizontal, 26)
        .overlay { toggle }
    }

    private func barButton<Glyph: View>(_ label: LocalizedStringKey, alignment: Alignment,
                                        action: @escaping () -> Void = {},
                                        @ViewBuilder glyph: () -> Glyph) -> some View {
        Button(action: action) {
            glyph().frame(width: 44, height: 44, alignment: alignment).contentShape(.rect)
        }
        .accessibilityLabel(label)
    }

    private var toggle: some View {
        CircleButton(symbol: isExpanded ? "chevron.up" : "chevron.down",
                     label: isExpanded ? "Collapse cards" : "Expand cards") {
            withAnimation(reduceMotion ? nil : .smooth) { isExpanded.toggle() }
        }
        .accessibilityIdentifier("ToggleCompanionCards")
        .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
        .overlay(alignment: .topTrailing) {
            if unseen > 0 {
                Text("\(unseen)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.ink)
                    .fixedSize()
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .frame(minWidth: 22, minHeight: 22)
                    .background(Color(hex: 0xF6CF68), in: .circle)
                    .overlay(Circle().stroke(Color.ink, lineWidth: 2))
                    .offset(x: 8, y: -7)
                    .accessibilityLabel("\(unseen) more")
            }
        }
    }

    // MARK: Carousel

    private var carousel: some View {
        VStack(spacing: 24) {
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(cards) { card in
                        CardView(kind: card, onAction: {
                            if card == .question {
                                if onConversation(card.conversationPrompt) { isExpanded = false }
                            } else { presented = card }
                        }, onDismiss: { dismiss(card) })
                            .disabled(actionPending)
                            .matchedTransitionSource(id: card, in: zoom)
                            .padding(.horizontal, 32)
                            .containerRelativeFrame(.horizontal)
                    }
                }
                .scrollTargetLayout()
            }
            .accessibilityIdentifier("CompanionCardsPager")
            .scrollIndicators(.hidden)
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $selection)
            .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                ForEach(cards) { card in
                    Circle().strokeBorder(.white, lineWidth: 2)
                        .frame(width: 14, height: 14)
                        .overlay { if card == selection { Circle().fill(.white).padding(3) } }
                }
            }
            .accessibilityHidden(true)
        }
        .accessibilityIdentifier("CompanionCardsCarousel")
    }

    private func dismiss(_ card: CardKind) {
        guard let i = cards.firstIndex(of: card) else { return }
        withAnimation(reduceMotion ? nil : .smooth) {
            cards.remove(at: i)
            selection = cards.indices.contains(i) ? cards[i] : cards.last
            if cards.isEmpty { isExpanded = false }
        }
    }
}

// MARK: - Detail (full screen)

struct DetailView: View {
    let kind: CardKind
    @Binding var actionError: String?
    var onConversation: (String) -> Bool = { _ in false }
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GeometryReader { geometry in
        ScrollView {
        VStack(spacing: 24) {
            Eyebrow(text: kind.eyebrow, font: .callout.weight(.semibold), rule: 45)
            Spacer()
            VStack(spacing: 20) {
                Image(systemName: kind.symbol).font(.largeTitle)
                Text(kind.detailText)
                    .font(.system(.largeTitle, design: .serif))
                    .fontWeight(.medium)
                    .kerning(-0.5)
                    .multilineTextAlignment(.center)
                if kind == .affirmation {
                    ShareLink(item: CardKind.affirmationText) {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .font(.headline)
                            .padding(.horizontal, 28)
                            .frame(height: 44)
                            .background(kind.foreground.opacity(0.25), in: .capsule)
                    }
                }
            }
            Spacer()
            if kind == .intentions {
                ForEach(Array(CardKind.intentionChoices.enumerated()), id: \.offset) { index, intention in
                    Button {
                        if onConversation("My intention today is: " + intention) { dismiss() }
                    } label: {
                        Text(intention).frame(minHeight: 44)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: 16))
                    .tint(kind.foreground)
                    .foregroundStyle(kind.contrast)
                    .accessibilityIdentifier("ChooseIntention_\(index)")
                }
            } else {
                Button {
                    if onConversation(kind.conversationPrompt) { dismiss() }
                } label: {
                    Text(kind == .affirmation ? "Talk about this" : "Start chat").frame(minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 16))
                .tint(kind.foreground)
                .foregroundStyle(kind.contrast)
                .accessibilityIdentifier("StartCardConversation")
            }
            if kind == .affirmation {
                Text("Breathe")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(kind.foreground.opacity(0.4))
                    .padding(.bottom, 20)
            }
            CircleButton(symbol: "chevron.right", size: 52, fill: kind.foreground, ink: kind.contrast,
                         label: "Close") { dismiss() }
                .accessibilityIdentifier("CloseCardDetail")
        }

        .foregroundStyle(kind.foreground)
        .padding()
        .frame(maxWidth: .infinity)
        .frame(minHeight: geometry.size.height)
        }
        }
        .background(Rectangle().fill(kind.fill).ignoresSafeArea())
        .modifier(ConversationErrorAlert(message: $actionError))
    }
}

#Preview {
    @Previewable @State var expanded = false
    HomeView(isExpanded: $expanded, actionError: .constant(nil)).preferredColorScheme(.dark)
}
