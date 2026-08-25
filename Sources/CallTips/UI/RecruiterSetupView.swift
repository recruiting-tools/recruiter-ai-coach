import SwiftUI
import UniformTypeIdentifiers

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
                Button {
                    NSApp.keyWindow?.orderOut(nil)
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Скрыть")
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
        .frame(maxWidth: .infinity)
        .onAppear {
            if session.interviewPlan != nil { step = .plan }
        }
    }

    // MARK: – Input form

    private var inputForm: some View {
        VStack(alignment: .leading, spacing: 12) {

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
                HStack {
                    fieldLabel("Резюме кандидата")
                    Spacer()
                    filePickerButton(target: $session.resumeText)
                }
                DropZoneEditor(text: $session.resumeText, placeholder: "Текст, URL или перетащи файл", height: 90)
            }

            Group {
                HStack {
                    fieldLabel("Описание вакансии")
                    Spacer()
                    filePickerButton(target: $session.jobDescription)
                }
                DropZoneEditor(text: $session.jobDescription, placeholder: "Текст, URL или перетащи файл", height: 75)
            }

            Group {
                fieldLabel("Язык")
                HStack(spacing: 12) {
                    languagePicker(label: "Основной", selection: $session.primaryLanguage)
                    languagePicker(label: "Дополнительный", selection: $session.secondaryLanguage, includeNone: true)
                }
            }

            if let err = errorMessage {
                Text(err).foregroundStyle(.red).font(.caption)
            }

            HStack(spacing: 12) {
                Button("Начать без плана") { onStart() }
                    .buttonStyle(.bordered)

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
        .padding(16)
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
            .frame(minHeight: 420)

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
    private func filePickerButton(target: Binding<String>) -> some View {
        Button {
            let panel = NSOpenPanel()
            panel.allowedContentTypes = [.pdf, .init(filenameExtension: "docx")!, .plainText, .init(filenameExtension: "md")!]
            panel.allowsMultipleSelection = false
            panel.canChooseDirectories = false
            guard panel.runModal() == .OK, let url = panel.url else { return }
            Task.detached(priority: .userInitiated) {
                if let extracted = DocumentExtractor.extract(from: url) {
                    await MainActor.run { target.wrappedValue = extracted }
                }
            }
        } label: {
            Image(systemName: "paperclip")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .help("Выбрать файл (PDF, DOCX, TXT, MD)")
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

// MARK: – Drop zone text editor

private struct DropZoneEditor: View {
    @Binding var text: String
    var placeholder: String
    var height: CGFloat = 100

    @State private var isTargeted = false
    @State private var isFetching = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $text)
                .frame(height: height)
                .font(.system(size: 12))
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .opacity(isFetching ? 0.3 : 1)
                .disabled(isFetching)
                .onChange(of: text) { newValue in
                    maybeLoadURL(newValue)
                }

            if text.isEmpty && !isFetching {
                VStack(alignment: .leading, spacing: 3) {
                    Text(placeholder)
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                    Text("или перетащи PDF · DOCX · TXT · MD · URL")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.secondary.opacity(0.5))
                }
                .padding(6)
                .allowsHitTesting(false)
            }

            if isFetching {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.small)
                    Text("Загружаю страницу...").font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .allowsHitTesting(false)
            }
        }
        .padding(2)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(isTargeted ? Color.accentColor.opacity(0.06) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(isTargeted ? Color.accentColor : Color.secondary.opacity(0.3),
                        lineWidth: isTargeted ? 2 : 1)
        )
        .onDrop(of: [UTType.fileURL], isTargeted: $isTargeted) { providers in
            providers.first?.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                guard let data = item as? Data,
                      let url = URL(dataRepresentation: data, relativeTo: nil),
                      let extracted = DocumentExtractor.extract(from: url) else { return }
                DispatchQueue.main.async { text = extracted }
            }
            return true
        }
    }

    private func maybeLoadURL(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.contains(" "), !trimmed.contains("\n") else { return }

        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            isFetching = true
            Task {
                let result = await DocumentExtractor.fetchURL(trimmed)
                await MainActor.run {
                    isFetching = false
                    if let result { text = result }
                }
            }
        } else if trimmed.hasPrefix("/") {
            // TextEditor intercepts file drops and pastes the path — extract it
            let url = URL(fileURLWithPath: trimmed)
            let ext = url.pathExtension.lowercased()
            guard ["pdf", "docx", "txt", "md", "markdown"].contains(ext) else { return }
            isFetching = true
            Task.detached(priority: .userInitiated) {
                let result = DocumentExtractor.extract(from: url)
                await MainActor.run {
                    isFetching = false
                    if let result { text = result }
                }
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
