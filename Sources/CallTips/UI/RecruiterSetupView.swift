import SwiftUI

struct RecruiterSetupView: View {
    @ObservedObject var session: CallSession
    var apiKey: String
    var onStart: () -> Void

    @State private var step: Step = .input
    @State private var isGenerating = false
    @State private var errorMessage: String?

    enum Step { case input, plan }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Label("Режим рекрутера", systemImage: "person.badge.plus")
                    .font(.headline)
                Spacer()
                if step == .plan {
                    Button("← Назад") { step = .input }
                        .buttonStyle(.plain)
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 16)

            Divider()

            if step == .input {
                inputForm
            } else {
                planView
            }
        }
        .frame(width: 560)
    }

    // MARK: – Input form

    private var inputForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                Group {
                    fieldLabel("Имя кандидата")
                    TextField("Иван Петров", text: $session.candidateName)
                        .textFieldStyle(.roundedBorder)
                }

                Group {
                    fieldLabel("Длина интервью")
                    Picker("", selection: $session.interviewDuration) {
                        Text("15 мин").tag(15)
                        Text("30 мин").tag(30)
                        Text("60 мин").tag(60)
                    }
                    .pickerStyle(.segmented)
                }

                Group {
                    fieldLabel("Резюме кандидата")
                    TextEditor(text: $session.resumeText)
                        .frame(height: 120)
                        .font(.system(size: 12, design: .monospaced))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3)))
                        .overlay(alignment: .topLeading) {
                            if session.resumeText.isEmpty {
                                Text("Вставь текст резюме...")
                                    .foregroundStyle(.tertiary)
                                    .font(.system(size: 12))
                                    .padding(6)
                                    .allowsHitTesting(false)
                            }
                        }
                }

                Group {
                    fieldLabel("Описание вакансии")
                    TextEditor(text: $session.jobDescription)
                        .frame(height: 100)
                        .font(.system(size: 12, design: .monospaced))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3)))
                        .overlay(alignment: .topLeading) {
                            if session.jobDescription.isEmpty {
                                Text("Текст вакансии или ссылка...")
                                    .foregroundStyle(.tertiary)
                                    .font(.system(size: 12))
                                    .padding(6)
                                    .allowsHitTesting(false)
                            }
                        }
                }

                Group {
                    fieldLabel("Язык")
                    HStack(spacing: 12) {
                        languagePicker(label: "Основной", selection: $session.primaryLanguage)
                        languagePicker(label: "Дополнительный", selection: $session.secondaryLanguage, includeNone: true)
                    }
                }

                if let err = errorMessage {
                    Text(err)
                        .foregroundStyle(.red)
                        .font(.caption)
                }

                HStack(spacing: 12) {
                    // Skip plan generation — start call directly
                    Button("Начать без плана") {
                        onStart()
                    }
                    .buttonStyle(.bordered)

                    // Generate plan then show it
                    Button {
                        Task { await generatePlan() }
                    } label: {
                        if isGenerating {
                            HStack(spacing: 8) {
                                ProgressView().controlSize(.small)
                                Text("Генерирую план...")
                            }
                        } else {
                            Label("Создать план интервью", systemImage: "wand.and.stars")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isGenerating || session.resumeText.isEmpty || session.jobDescription.isEmpty)
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(24)
        }
    }

    // MARK: – Plan view

    private var planView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Plan header
            VStack(alignment: .leading, spacing: 4) {
                if let plan = session.interviewPlan {
                    Text(plan.candidateName.isEmpty ? "План интервью" : "План интервью — \(plan.candidateName)")
                        .font(.subheadline.bold())
                    Text("\(plan.durationMinutes) мин · \(plan.allQuestions.count) вопросов")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(session.interviewPlan?.sections ?? []) { section in
                        sectionBlock(section)
                    }
                }
                .padding(24)
            }

            Divider()

            HStack {
                Spacer()
                Button(action: onStart) {
                    Label("Начать звонок с этим планом", systemImage: "mic.fill")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(20)
        }
    }

    private func sectionBlock(_ section: InterviewPlan.Section) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(section.category.icon)
                Text(section.title)
                    .font(.subheadline.bold())
            }
            .padding(.bottom, 4)

            ForEach(section.questions) { q in
                questionRow(q)
            }
        }
        .padding(.bottom, 24)
    }

    private func questionRow(_ q: InterviewPlan.Question) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(q.text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
            if let fu = q.followUp {
                Text("↳ \(fu)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.leading, 8)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: – Helpers

    private func generatePlan() async {
        isGenerating = true
        errorMessage = nil
        let engine = InterviewPlanEngine(apiKey: apiKey)
        do {
            let plan = try await engine.generatePlan(
                candidateName:  session.candidateName,
                resumeText:     session.resumeText,
                jobDescription: session.jobDescription,
                durationMinutes: session.interviewDuration
            )
            session.interviewPlan = plan
            step = .plan
        } catch {
            errorMessage = error.localizedDescription
        }
        isGenerating = false
    }

    @ViewBuilder
    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
    }

    @ViewBuilder
    private func languagePicker(label: String, selection: Binding<String>, includeNone: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Picker("", selection: selection) {
                if includeNone { Text("—").tag("") }
                ForEach(languages, id: \.code) { Text($0.label).tag($0.code) }
            }
        }
    }
}

private let languages: [(code: String, label: String)] = [
    ("ru", "🇷🇺 Русский"),
    ("en", "🇺🇸 English"),
    ("de", "🇩🇪 Deutsch"),
    ("es", "🇪🇸 Español"),
    ("fr", "🇫🇷 Français"),
]
