import Foundation

struct InterviewPlan {
    var candidateName: String
    var jobTitle: String
    var durationMinutes: Int
    var sections: [Section]

    var allQuestions: [Question] { sections.flatMap(\.questions) }
    var nextUnasked: Question? { allQuestions.first { !$0.isAsked } }

    struct Section: Identifiable {
        var id: String { category.rawValue }
        var category: Category
        var title: String
        var questions: [Question]

        enum Category: String {
            case technical
            case softSkills
            case managerial

            var icon: String {
                switch self {
                case .technical:  return "⚙️"
                case .softSkills: return "🤝"
                case .managerial: return "🎯"
                }
            }
        }
    }

    struct Question: Identifiable {
        var id = UUID()
        var text: String
        var followUp: String?
        var isAsked = false
    }
}

// MARK: - Decodable from OpenRouter JSON response

extension InterviewPlan {
    init?(json: String, candidateName: String, jobTitle: String, durationMinutes: Int) {
        guard let data = json.data(using: .utf8),
              let raw = try? JSONDecoder().decode(PlanResponse.self, from: data) else { return nil }

        self.candidateName = candidateName
        self.jobTitle = jobTitle
        self.durationMinutes = durationMinutes
        self.sections = raw.sections.map { s in
            let cat = Section.Category(rawValue: s.category) ?? .technical
            let qs = s.questions.map { q in Question(text: q.text, followUp: q.followUp) }
            return Section(category: cat, title: s.title, questions: qs)
        }
    }

    private struct PlanResponse: Decodable {
        let sections: [RawSection]

        struct RawSection: Decodable {
            let category: String
            let title: String
            let questions: [RawQuestion]
        }

        struct RawQuestion: Decodable {
            let text: String
            let followUp: String?
        }
    }
}
