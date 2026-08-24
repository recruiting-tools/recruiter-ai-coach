import SwiftUI

struct PreCallView: View {
    @ObservedObject var session: CallSession
    var onStart: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
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

            VStack(alignment: .leading, spacing: 8) {
                Text("Цель звонка")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("Например: закрыть оффер, выяснить зарплатные ожидания...", text: $session.myGoal)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Дополнительный контекст")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextEditor(text: $session.additionalContext)
                    .frame(height: 80)
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
        .frame(width: 480, height: 380)
    }
}
