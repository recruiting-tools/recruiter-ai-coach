import Foundation

// Sends recent transcript + call context to Claude and returns a coaching tip.
// Called after each finalized utterance from either speaker.
final class CoachEngine {
    private let apiKey: String

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    @MainActor
    func requestTip(session: CallSession) async -> String? {
        let prompt = buildPrompt(session: session)
        return await callClaude(prompt: prompt)
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

    // MARK: - Claude API call

    private func callClaude(prompt: String) async -> String? {
        guard let url = URL(string: "https://api.anthropic.com/v1/messages") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-5-20250514",
            "max_tokens": 150,
            "messages": [["role": "user", "content": prompt]]
        ]

        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        request.httpBody = httpBody

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(ClaudeResponse.self, from: data)
            let text = response.content.first?.text ?? ""
            return text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : text
        } catch {
            print("[CoachEngine] Claude API error: \(error)")
            return nil
        }
    }
}

// MARK: - Claude response model

private struct ClaudeResponse: Decodable {
    let content: [ContentBlock]

    struct ContentBlock: Decodable {
        let text: String
    }
}
