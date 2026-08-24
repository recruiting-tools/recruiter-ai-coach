import SwiftUI

struct CandidateSetupView: View {
    @ObservedObject var session: CallSession
    var apiKey: String
    var onStart: () -> Void

    @State private var step: Step = .input
    @State private var isGenerating = false
    @State private var errorMessage: String?

    enum Step { case input, story }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Label("Режим кандидата", systemImage: "person.crop.circle")
                    .font(.headline)
                Spacer()
                if step == .story {
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
                storyView
            }
        }
        .frame(width: 560)
    }

    // MARK: – Input form

    private var inputForm: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                Group {
                    Text("Резюме (твоё)").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $session.resumeText)
                        .frame(height: 140)
                        .font(.system(size: 12, design: .monospaced))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3)))
                        .overlay(alignment: .topLeading) {
                            if session.resumeText.isEmpty {
                                Text("Вставь текст своего резюме...")
                                    .foregroundStyle(.tertiary)
                                    .font(.system(size: 12))
                                    .padding(6)
                                    .allowsHitTesting(false)
                            }
                        }
                }

                Group {
                    Text("Вакансия").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $session.jobDescription)
                        .frame(height: 100)
                        .font(.system(size: 12, design: .monospaced))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.3)))
                        .overlay(alignment: .topLeading) {
                            if session.jobDescription.isEmpty {
                                Text("Текст вакансии на которую идёшь...")
                                    .foregroundStyle(.tertiary)
                                    .font(.system(size: 12))
                                    .padding(6)
                                    .allowsHitTesting(false)
                            }
                        }
                }

                Group {
                    Text("Цель звонка").font(.caption).foregroundStyle(.secondary)
                    TextField("Получить оффер, уточнить условия...", text: $session.myGoal)
                        .textFieldStyle(.roundedBorder)
                }

                Group {
                    Text("Язык").font(.caption).foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Основной").font(.caption).foregroundStyle(.secondary)
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
                }

                if let err = errorMessage {
                    Text(err).foregroundStyle(.red).font(.caption)
                }

                HStack(spacing: 12) {
                    Button("Начать без истории") { onStart() }
                        .buttonStyle(.bordered)

                    Button {
                        Task { await generateStory() }
                    } label: {
                        if isGenerating {
                            HStack(spacing: 8) {
                                ProgressView().controlSize(.small)
                                Text("Генерирую историю...")
                            }
                        } else {
                            Label("Создать мою историю", systemImage: "wand.and.stars")
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

    // MARK: – Story view

    private var storyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Твоя история")
                    .font(.subheadline.bold())
                Text("Проверь, поправь если нужно, и нажми «Начать»")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)

            Divider()

            ScrollView {
                TextEditor(text: $session.candidateStory)
                    .frame(minHeight: 280)
                    .font(.callout)
                    .padding(24)
            }

            Divider()

            HStack {
                Spacer()
                Button(action: onStart) {
                    Label("Начать звонок", systemImage: "mic.fill")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(20)
        }
    }

    // MARK: – Story generation

    private func generateStory() async {
        isGenerating = true
        errorMessage = nil

        let prompt = """
        Ты — карьерный коуч. На основе резюме и вакансии создай "историю кандидата" — связный нарратив от первого лица.

        РЕЗЮМЕ:
        \(session.resumeText.prefix(3000))

        ВАКАНСИЯ:
        \(session.jobDescription.prefix(2000))

        Цель кандидата: \(session.myGoal.isEmpty ? "не указана" : session.myGoal)

        Напиши историю (3-5 абзацев):
        1. Кто я и откуда (краткое intro)
        2. Ключевой опыт и проекты — с привязкой к технологиям из вакансии
        3. Конкретные достижения (числа, масштаб, результаты)
        4. Почему эта роль / компания мне интересна
        5. Что я хочу делать дальше

        История должна быть реалистичной и основанной ТОЛЬКО на фактах из резюме.
        Первое лицо, живой язык. Не бюрократический.
        Язык: \(session.primaryLanguage == "ru" ? "русский" : "english")
        """

        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("call-tips",        forHTTPHeaderField: "X-Title")

        let body: [String: Any] = [
            "model": "google/gemini-2.5-flash-lite",
            "max_tokens": 1000,
            "messages": [["role": "user", "content": prompt]]
        ]

        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, _) = try await URLSession.shared.data(for: req)
            struct R: Decodable {
                let choices: [C]
                struct C: Decodable { let message: M }
                struct M: Decodable { let content: String }
            }
            let r = try JSONDecoder().decode(R.self, from: data)
            session.candidateStory = r.choices.first?.message.content ?? ""
            if !session.candidateStory.isEmpty { step = .story }
        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }
}

private let languages: [(code: String, label: String)] = [
    ("ru", "🇷🇺 Русский"),
    ("en", "🇺🇸 English"),
    ("de", "🇩🇪 Deutsch"),
    ("es", "🇪🇸 Español"),
    ("fr", "🇫🇷 Français"),
]
