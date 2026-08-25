import SwiftUI

// Floating HUD — always on top, positioned at top of screen near webcam.
struct OverlayView: View {
    @ObservedObject var session: CallSession
    var onStop: () -> Void

    @State private var activeTab: Tab = .tips

    enum Tab { case transcript, tips }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            statusBar
            Divider()
            tabBar
            Divider()
            tabContent
                .animation(.easeInOut(duration: 0.15), value: activeTab)
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.25), radius: 12, y: 4)
        .frame(width: 380)
    }

    // MARK: – Status bar

    private var statusBar: some View {
        HStack(spacing: 8) {
            Circle().fill(.red).frame(width: 7, height: 7)
            Text("REC").font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(.red.opacity(0.8))
            Spacer()
            // Debug: last log entry
            if let last = session.debugLog.last {
                Text(last.components(separatedBy: "] ").last ?? last)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Button(action: onStop) {
                Image(systemName: "stop.circle").foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
    }

    // MARK: – Tabs

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabButton(.tips,       label: "Подсказки",  icon: "lightbulb.fill")
            tabButton(.transcript, label: "Транскрипт", icon: "text.bubble")
        }
    }

    private func tabButton(_ tab: Tab, label: String, icon: String) -> some View {
        Button { activeTab = tab } label: {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.caption2)
                Text(label).font(.caption2.weight(activeTab == tab ? .semibold : .regular))
            }
            .foregroundStyle(activeTab == tab ? Color.accentColor : .secondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(activeTab == tab ? Color.accentColor.opacity(0.1) : Color.clear)
        }
        .buttonStyle(.plain)
    }

    // MARK: – Tab content

    @ViewBuilder
    private var tabContent: some View {
        switch activeTab {
        case .tips:
            tipsTab
        case .transcript:
            transcriptTab
        }
    }

    // MARK: – Tips tab

    private var tipsTab: some View {
        VStack(alignment: .leading, spacing: 6) {
            if session.latestTips.isEmpty {
                HStack {
                    Spacer()
                    Text("Слушаю...")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .padding(16)
                    Spacer()
                }
            } else {
                ForEach(session.latestTips) { tip in
                    TipCard(tip: tip)
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: – Transcript tab

    private var transcriptTab: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(session.transcript.suffix(40)) { line in
                        TranscriptRow(line: line)
                            .id(line.id)
                    }
                }
                .padding(10)
            }
            .frame(maxHeight: 200)
            .onChange(of: session.transcript.count) { _ in
                if let last = session.transcript.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }
}

// MARK: – Tip card

private struct TipCard: View {
    let tip: CoachingTip

    private var accentColor: Color {
        switch tip.type {
        case .quickStart: return .green
        case .main:       return .orange
        case .clarify:    return .blue
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
                Text(tip.type.icon)
                    .font(.system(size: 11))
                Text(tip.type.label.uppercased())
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(accentColor)
                    .tracking(0.6)
            }
            Text(tip.text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(accentColor.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 8).stroke(accentColor.opacity(0.25), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

// MARK: – Transcript row

private struct TranscriptRow: View {
    let line: CallTips.TranscriptLine

    var body: some View {
        HStack(alignment: .top, spacing: 7) {
            Text(line.speaker == .me ? "Я" : "Они")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(line.speaker == .me ? Color.accentColor : .secondary)
                .frame(width: 28, alignment: .trailing)
            Text(line.text)
                .font(.caption)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
