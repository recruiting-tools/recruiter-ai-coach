import Foundation

// Generates 3 recruiter coaching tips per trigger via a single API call.
final class CoachEngine {
    private let apiKey: String
    init(apiKey: String) { self.apiKey = apiKey }

    @MainActor
    func requestTips(session: CallSession) async -> [CoachingTip] {
        let prompt = buildPrompt(session: session)
        guard let json = await callOpenRouter(prompt: prompt) else { return [] }
        guard let data = json.data(using: .utf8),
              let resp = try? JSONDecoder().decode(TipsResponse.self, from: data) else { return [] }
        return resp.toTips()
    }

    @MainActor
    private func buildPrompt(session: CallSession) -> String {
        """
        Ты — AI-ассистент технического рекрутера, который ведёт интервью прямо сейчас.
        Кандидат: \(session.candidateName.isEmpty ? "не указан" : session.candidateName)
        Вакансия: \(session.jobDescription.prefix(400))
        Длина интервью: \(session.interviewDuration) мин

        \(session.planContext.isEmpty ? "" : "ПЛАН ИНТЕРВЬЮ:\n\(session.planContext)\n")

        ПОСЛЕДНИЕ РЕПЛИКИ (Я = рекрутер, Они = кандидат):
        \(session.recentTranscript)

        Верни ТОЛЬКО JSON без обёртки:
        {
          "quickStart": "Следующий вопрос из плана или логичный следующий шаг — 1 предложение",
          "main": "Если кандидат упомянул технологию из вакансии — точечный вопрос-проверка глубины. Иначе — пустая строка.",
          "clarify": "Вопрос для уточнения если кандидат ответил размыто. Иначе — пустая строка."
        }

        Все строки на русском. Пустая строка "" если подсказка не нужна.
        """
    }

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
            let r = try JSONDecoder().decode(ORouterResp.self, from: data)
            return r.choices.first?.message.content
        } catch { return nil }
    }

    private struct ORouterResp: Decodable {
        let choices: [C]; struct C: Decodable { let message: M }; struct M: Decodable { let content: String }
    }
}
