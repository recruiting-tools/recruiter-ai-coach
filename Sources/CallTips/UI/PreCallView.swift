import SwiftUI

struct PreCallView: View {
    @ObservedObject var session: CallSession
    var apiKey: String
    var onStart: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Mode selector at top
            modeSelector
            Divider()
            // Mode-specific content
            modeContent
        }
    }

    // MARK: – Mode tabs

    private var modeSelector: some View {
        HStack(spacing: 0) {
            ForEach(CallType.allCases) { type in
                modeTab(type)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    private func modeTab(_ type: CallType) -> some View {
        Button {
            session.callType = type
        } label: {
            VStack(spacing: 4) {
                Text(modeIcon(type))
                    .font(.title3)
                Text(type.rawValue)
                    .font(.caption2)
                    .fontWeight(session.callType == type ? .semibold : .regular)
                    .foregroundStyle(session.callType == type ? Color.accentColor : .secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                session.callType == type
                    ? Color.accentColor.opacity(0.1)
                    : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.plain)
    }

    private func modeIcon(_ type: CallType) -> String {
        switch type {
        case .recruiterInterview: return "🎯"
        case .candidateInterview: return "👤"
        case .workCall:           return "💼"
        case .other:              return "💬"
        }
    }

    // MARK: – Mode content routing

    @ViewBuilder
    private var modeContent: some View {
        switch session.callType {
        case .recruiterInterview:
            RecruiterSetupView(session: session, apiKey: apiKey, onStart: onStart)
        case .candidateInterview:
            CandidateSetupView(session: session, apiKey: apiKey, onStart: onStart)
        default:
            workCallSetup
        }
    }

    // MARK: – Work call (minimal setup)

    private var workCallSetup: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Group {
                    Text("Цель звонка").font(.caption).foregroundStyle(.secondary)
                    TextField("Договориться о сроках, обсудить задачу...", text: $session.myGoal)
                        .textFieldStyle(.roundedBorder)
                }

                Group {
                    Text("Дополнительный контекст").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $session.additionalContext)
                        .frame(height: 60)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3)))
                }

                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Основной язык").font(.caption).foregroundStyle(.secondary)
                        Picker("", selection: $session.primaryLanguage) {
                            ForEach(languages, id: \.code) { Text($0.label).tag($0.code) }
                        }
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Дополнительный").font(.caption).foregroundStyle(.secondary)
                        Picker("", selection: $session.secondaryLanguage) {
                            Text("—").tag("")
                            ForEach(languages, id: \.code) { Text($0.label).tag($0.code) }
                        }
                    }
                }

                Spacer(minLength: 0)

                Button(action: onStart) {
                    Label("Начать звонок", systemImage: "mic.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(24)
        }
        .frame(width: 560)
    }
}

private let languages: [(code: String, label: String)] = [
    ("ru", "🇷🇺 Русский"),
    ("en", "🇺🇸 English"),
    ("de", "🇩🇪 Deutsch"),
    ("es", "🇪🇸 Español"),
    ("fr", "🇫🇷 Français"),
]
