import Foundation

// Generates a structured interview plan from resume + job description.
final class InterviewPlanEngine {
    private let apiKey: String

    init(apiKey: String) { self.apiKey = apiKey }

    func generatePlan(
        candidateName: String,
        resumeText: String,
        jobDescription: String,
        durationMinutes: Int
    ) async throws -> InterviewPlan {
        let questionCount: Int
        switch durationMinutes {
        case ..<20: questionCount = 4
        case ..<45: questionCount = 8
        default:    questionCount = 14
        }

        let prompt = """
        Ты опытный технический рекрутер. Составь план интервью на \(durationMinutes) минут.

        Кандидат: \(candidateName.isEmpty ? "не указан" : candidateName)

        РЕЗЮМЕ КАНДИДАТА:
        \(resumeText.prefix(3000))

        ВАКАНСИЯ:
        \(jobDescription.prefix(2000))

        Сгенерируй примерно \(questionCount) вопросов, распределённых по трём блокам.
        Для каждого вопроса — необязательный уточняющий followUp (проверить глубину знаний).

        Верни ТОЛЬКО JSON, никакого текста вокруг:
        {
          "sections": [
            {
              "category": "technical",
              "title": "Технические вопросы",
              "questions": [
                { "text": "Вопрос...", "followUp": "Уточняющий вопрос если кандидат ответил поверхностно..." }
              ]
            },
            {
              "category": "softSkills",
              "title": "Soft Skills",
              "questions": [
                { "text": "Вопрос..." }
              ]
            },
            {
              "category": "managerial",
              "title": "Опыт и мотивация",
              "questions": [
                { "text": "Вопрос..." }
              ]
            }
          ]
        }

        Вопросы на русском. Учти стек из вакансии и опыт из резюме. Технические вопросы — конкретные, по технологиям.
        """

        let json = try await callOpenRouter(prompt: prompt)

        guard let plan = InterviewPlan(
            json: json,
            candidateName: candidateName,
            jobTitle: extractJobTitle(from: jobDescription),
            durationMinutes: durationMinutes
        ) else {
            throw PlanError.parseError(json)
        }
        return plan
    }

    private func extractJobTitle(from jd: String) -> String {
        jd.components(separatedBy: .newlines).first?.trimmingCharacters(in: .whitespaces) ?? "Позиция"
    }

    private func callOpenRouter(prompt: String) async throws -> String {
        guard let url = URL(string: "https://openrouter.ai/api/v1/chat/completions") else {
            throw PlanError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json",        forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(apiKey)",        forHTTPHeaderField: "Authorization")
        req.setValue("call-tips",               forHTTPHeaderField: "X-Title")

        let body: [String: Any] = [
            "model": "google/gemini-2.5-flash-lite",
            "max_tokens": 2000,
            "response_format": ["type": "json_object"],
            "messages": [["role": "user", "content": prompt]]
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse, http.statusCode != 200 {
            throw PlanError.httpError(http.statusCode, String(data: data, encoding: .utf8) ?? "")
        }
        let decoded = try JSONDecoder().decode(OpenRouterResponse.self, from: data)
        return decoded.choices.first?.message.content ?? ""
    }

    enum PlanError: Error, LocalizedError {
        case invalidURL
        case httpError(Int, String)
        case parseError(String)

        var errorDescription: String? {
            switch self {
            case .invalidURL:         return "Неверный URL"
            case .httpError(let c, _): return "Ошибка API: HTTP \(c)"
            case .parseError:         return "Не удалось разобрать ответ AI"
            }
        }
    }

    private struct OpenRouterResponse: Decodable {
        let choices: [Choice]
        struct Choice: Decodable {
            let message: Message
        }
        struct Message: Decodable {
            let content: String
        }
    }
}
