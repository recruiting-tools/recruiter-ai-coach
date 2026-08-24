import SwiftUI

private let languages: [(code: String, label: String)] = [
    ("ru", "🇷🇺 Русский"),
    ("en", "🇺🇸 English"),
    ("de", "🇩🇪 Deutsch"),
    ("es", "🇪🇸 Español"),
    ("fr", "🇫🇷 Français"),
]

struct PreCallView: View {
    @ObservedObject var session: CallSession
    var onStart: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Настройка звонка")
                .font(.title2.bold())

            VStack(alignment: .leading, spacing: 8) {
                Text("Тип звонка")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Picker("", selection: $session.callType) {
                    ForEach(CallType.allCases) { type in
                        Text(type.rawValue).tag(type)
                    }
                }
                .pickerStyle(.segmented)
            }

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Основной язык")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Picker("", selection: $session.primaryLanguage) {
                        ForEach(languages, id: \.code) { lang in
                            Text(lang.label).tag(lang.code)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Дополнительный")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Picker("", selection: $session.secondaryLanguage) {
                        Text("—").tag("")
                        ForEach(languages, id: \.code) { lang in
                            Text(lang.label).tag(lang.code)
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Цель звонка")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Например: закрыть оффер, выяснить зарплатные ожидания...", text: $session.myGoal)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Дополнительный контекст")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextEditor(text: $session.additionalContext)
                    .frame(height: 60)
                    .font(.body)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3)))
            }

            Spacer()

            Button(action: onStart) {
                Label("Начать звонок", systemImage: "mic.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(24)
        .frame(width: 480, height: 420)
    }
}
