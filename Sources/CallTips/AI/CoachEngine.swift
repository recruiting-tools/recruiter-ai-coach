import Foundation

// Generates 3 coaching tips (quickStart / main / clarify) per trigger.
// One API call → JSON with all three fields → avoids 3× latency.
final class CoachEngine {
    private let apiKey: String

    init(apiKey: String) { self.apiKey = apiKey }

    @MainActor
    func requestTips(session: CallSession) async -> [CoachingTip] {
        let prompt = buildPrompt(session: session)
        guard let json = await callOpenRouter(prompt: prompt) else { return [] }
        guard let data = json.data(using: .utf8),
              let resp = try? JSONDecoder().decode(TipsResponse.self, from: data) else { return [] }
        return resp.toTips(callType: session.callType)
    }

    // MARK: – Prompt

    @MainActor
    private func buildPrompt(session: CallSession) -> String {
        switch session.callType {
        case .recruiterInterview:
            return recruiterPrompt(session: session)
        case .candidateInterview:
            return candidatePrompt(session: session)
        default:
            return workCallPrompt(session: session)
        }
    }

    @MainActor
    private func recruiterPrompt(session: CallSession) -> String {
        """
        Ты — AI-ассистент рекрутера на интервью.
        Кандидат: \(session.candidateName.isEmpty ? "не указан" : session.candidateName)
        Вакансия: \(session.jobDescription.prefix(500))
        Длина интервью: \(session.interviewDuration) мин

        \(session.planContext.isEmpty ? "" : "ПЛАН ИНТЕРВЬЮ:\n\(session.planContext)\n")

        ПОСЛЕДНИЕ РЕПЛИКИ (Я = рекрутер, Они = кандидат):
        \(session.recentTranscript)

        Верни ТОЛЬКО JSON:
        {
          "quickStart": "Следующий вопрос из плана или логичный следующий шаг (1 предложение)",
          "main": "Если кандидат упомянул технологию/проект — уточняющий вопрос-проверка глубины. Если нет — пустая строка.",
          "clarify": "Вопрос для уточнения если кандидат ответил размыто или непонятно. Или пустая строка."
        }

        Все ответы на русском. Если подсказка не нужна — пустая строка "".
        """
    }

    @MainActor
    private func candidatePrompt(session: CallSession) -> String {
        let story = session.candidateStory.isEmpty ? "" : "ИСТОРИЯ КАНДИДАТА (утверждённая):\n\(session.candidateStory)\n"
        return """
        Ты — AI-коуч кандидата на собеседовании.
        Цель: \(session.myGoal.isEmpty ? "не указана" : session.myGoal)
        \(story)

        ПОСЛЕДНИЕ РЕПЛИКИ (Я = кандидат, Они = рекрутер):
        \(session.recentTranscript)

        Верни ТОЛЬКО JSON:
        {
          "quickStart": "Первые 6-8 слов чтобы начать ответ (не полный ответ, только старт фразы)",
          "main": "Развёрнутый план ответа 2-3 предложения, используй факты из истории если есть",
          "clarify": "Встречный вопрос если вопрос рекрутера размытый или нужно выиграть время. Или пустая строка."
        }

        Все ответы на русском. Если подсказка не нужна — пустая строка "".
        """
    }

    @MainActor
    private func workCallPrompt(session: CallSession) -> String {
        """
        Ты — реалтайм-коуч на рабочем звонке.
        Цель: \(session.myGoal.isEmpty ? "не указана" : session.myGoal)
        \(session.additionalContext.isEmpty ? "" : "Контекст: \(session.additionalContext)\n")

        ПОСЛЕДНИЕ РЕПЛИКИ:
        \(session.recentTranscript)

        Верни ТОЛЬКО JSON:
        {
          "quickStart": "Краткая реплика или переход (1 предложение)",
          "main": "Развёрнутый ответ или следующий шаг в разговоре",
          "clarify": "Уточняющий вопрос если что-то непонятно. Или пустая строка."
        }

        Все ответы на русском. Если подсказка не нужна — пустая строка "".
        """
    }

    // MARK: – API

    private func callOpenRouter(prompt: String) async -> String? {
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(apiKey)",  forHTTPHeaderField: "Authorization")
        req.setValue("call-tips",         forHTTPHeaderField: "X-Title")

        let body: [String: Any] = [
            "model": "google/gemini-2.5-flash-lite",
            "max_tokens": 300,
            "response_format": ["type": "json_object"],
            "messages": [["role": "user", "content": prompt]]
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        req.httpBody = httpBody

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let response = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            return response.choices.first?.message.content
        } catch {
            print("[CoachEngine] error: \(error)")
            return nil
        }
    }

    private struct OpenRouterResponse: Decodable {
        let choices: [Choice]
        struct Choice: Decodable { let message: Message }
        struct Message: Decodable { let content: String }
    }
}
