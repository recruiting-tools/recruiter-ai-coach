import Foundation

// Sends recent transcript + call context to OpenRouter and returns a coaching tip.
// Called after each finalized utterance from either speaker.
final class CoachEngine {
    private let apiKey: String

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    @MainActor
    func requestTip(session: CallSession) async -> String? {
        let prompt = buildPrompt(session: session)
        return await callOpenRouter(prompt: prompt)
    }

    // MARK: - Prompt construction (customize here for different call types)

    @MainActor
    private func buildPrompt(session: CallSession) -> String {
        """
        Ты — реальтайм-коуч на звонке. Тип звонка: \(session.callType.rawValue).
        Цель пользователя: \(session.myGoal.isEmpty ? "не указана" : session.myGoal)
        \(session.additionalContext.isEmpty ? "" : "Контекст: \(session.additionalContext)\n")

        Последние реплики (Я = пользователь, Они = собеседник):
        \(session.recentTranscript)

        ---
        Если нужна подсказка — напиши одну короткую фразу (1-2 предложения максимум).
        Если всё хорошо и подсказка не нужна — ответь пустой строкой.
        Подсказки на русском языке. Никаких преамбул, только сам совет.
        """
        // TODO: настроить промпты под каждый CallType и конкретные сценарии:
        // - рекрутер: подсказывай вопросы про опыт, стоп-слова
        // - кандидат: подсказывай как отвечать на каверзные вопросы
        // - рабочий звонок: подсказывай action items, резюмируй решения
    }

    // MARK: - OpenRouter API call (OpenAI-compatible)

    private func callOpenRouter(prompt: String) async -> String? {
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("call-tips", forHTTPHeaderField: "X-Title")

        let body: [String: Any] = [
            "model": "google/gemini-2.5-flash-lite",
            "max_tokens": 150,
            "messages": [["role": "user", "content": prompt]]
        ]

        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        request.httpBody = httpBody

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
            let text = response.choices.first?.message.content ?? ""
            return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : text
        } catch {
            print("[CoachEngine] OpenRouter error: \(error)")
            return nil
        }
    }
}

// MARK: - OpenRouter response model

private struct OpenRouterResponse: Decodable {
    let choices: [Choice]

    struct Choice: Decodable {
        let message: Message
    }

    struct Message: Decodable {
        let content: String
    }
}
