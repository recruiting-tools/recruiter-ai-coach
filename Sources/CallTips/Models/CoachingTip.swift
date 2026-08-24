import Foundation

struct CoachingTip: Identifiable {
    let id = UUID()
    let type: TipType
    let text: String
    let timestamp: Date

    enum TipType {
        case quickStart    // ⚡ первые слова / следующий вопрос
        case main          // 📝 полный ответ / углублённый вопрос
        case clarify       // ❓ уточнение

        var icon: String {
            switch self {
            case .quickStart: return "⚡"
            case .main:       return "📝"
            case .clarify:    return "❓"
            }
        }

        func label(for callType: CallType) -> String {
            switch (self, callType) {
            case (.quickStart, .recruiterInterview): return "Следующий вопрос"
            case (.quickStart, _):                   return "Быстрый старт"
            case (.main, .recruiterInterview):       return "Углубить"
            case (.main, _):                         return "Полный ответ"
            case (.clarify, _):                      return "Уточнение"
            }
        }
    }
}

// MARK: - Decodable response from AI

struct TipsResponse: Decodable {
    let quickStart: String
    let main: String
    let clarify: String

    func toTips(callType: CallType) -> [CoachingTip] {
        let now = Date()
        var result: [CoachingTip] = []
        if !quickStart.trimmingCharacters(in: .whitespaces).isEmpty {
            result.append(CoachingTip(type: .quickStart, text: quickStart, timestamp: now))
        }
        if !main.trimmingCharacters(in: .whitespaces).isEmpty {
            result.append(CoachingTip(type: .main, text: main, timestamp: now))
        }
        if !clarify.trimmingCharacters(in: .whitespaces).isEmpty {
            result.append(CoachingTip(type: .clarify, text: clarify, timestamp: now))
        }
        return result
    }
}
