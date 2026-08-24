import SwiftUI

// Floating HUD shown during the call.
// Window stays on top of Zoom/Teams/etc. via .floating window level (set in AppDelegate).
struct OverlayView: View {
    @ObservedObject var session: CallSession
    var onStop: () -> Void

    @State private var isTranscriptExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Status bar
            HStack {
                Circle()
                    .fill(.red)
                    .frame(width: 8, height: 8)
                Text("Запись")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Button(action: onStop) {
                    Image(systemName: "stop.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()

            // Latest tip — main focus area
            if let tip = session.latestTip {
                TipBubble(tip: tip)
                    .transition(.move(edge: .top).combined(with: .opacity))
            } else {
                Text("Слушаю...")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .padding(12)
            }

            // Collapsible transcript
            if isTranscriptExpanded {
                Divider()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(session.transcript.suffix(30)) { line in
                            TranscriptLine(line: line)
                        }
                    }
                    .padding(8)
                }
                .frame(maxHeight: 200)
            }

            // Toggle transcript
            Button(action: { withAnimation { isTranscriptExpanded.toggle() } }) {
                HStack {
                    Image(systemName: isTranscriptExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                    Text(isTranscriptExpanded ? "Скрыть транскрипт" : "Показать транскрипт")
                        .font(.caption2)
                }
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(radius: 8, y: 4)
        .frame(width: 320)
    }
}

private struct TipBubble: View {
    let tip: Tip

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "lightbulb.fill")
                .foregroundStyle(.yellow)
                .font(.caption)
                .padding(.top, 2)
            Text(tip.text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct TranscriptLine: View {
    let line: Models.TranscriptLine

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Text(line.speaker == .me ? "Я" : "Они")
                .font(.caption2.bold())
                .foregroundStyle(line.speaker == .me ? Color.accentColor : .secondary)
                .frame(width: 28, alignment: .trailing)
            Text(line.text)
                .font(.caption2)
                .foregroundStyle(.primary)
        }
    }
}
