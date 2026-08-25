import Foundation

struct CoachingTip: Identifiable {
    let id = UUID()
    let type: TipType
    let text: String
    let timestamp: Date

    enum TipType {
        case quickStart   // ⚡ следующий вопрос из плана
        case main         // 📝 углублённый вопрос-проверка
        case clarify      // ❓ уточнение

        var icon: String {
            switch self { case .quickStart: "⚡"; case .main: "📝"; case .clarify: "❓" }
        }
        var label: String {
            switch self {
            case .quickStart: return "Следующий вопрос"
            case .main:       return "Углубить"
            case .clarify:    return "Уточнить"
            }
        }
        var color: String {  // used in SwiftUI via extension
            switch self { case .quickStart: "green"; case .main: "orange"; case .clarify: "blue" }
        }
    }
}

struct TipsResponse: Decodable {
    let quickStart: String
    let main: String
    let clarify: String

    func toTips() -> [CoachingTip] {
        let now = Date()
        return [
            ("quickStart", CoachingTip.TipType.quickStart, quickStart),
            ("main",       .main,       main),
            ("clarify",    .clarify,    clarify),
        ]
        .filter { !$2.trimmingCharacters(in: .whitespaces).isEmpty }
        .map    { CoachingTip(type: $1, text: $2, timestamp: now) }
    }
}
