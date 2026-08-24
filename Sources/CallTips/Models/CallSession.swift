import Foundation

enum CallType: String, CaseIterable, Identifiable {
    case recruiterInterview = "Я рекрутер"
    case candidateInterview = "Я кандидат"
    case workCall = "Рабочий звонок"
    case other = "Другое"

    var id: String { rawValue }
}

enum Speaker {
    case me
    case them
}

struct TranscriptLine: Identifiable {
    let id = UUID()
    let speaker: Speaker
    let text: String
    let timestamp: Date
}

struct Tip: Identifiable {
    let id = UUID()
    let text: String
    let timestamp: Date
    var isRead = false
}

@MainActor
final class CallSession: ObservableObject {
    // Pre-call config
    @Published var callType: CallType = .workCall
    @Published var myGoal: String = ""
    @Published var additionalContext: String = ""

    // Live session
    @Published var transcript: [TranscriptLine] = []
    @Published var tips: [Tip] = []
    @Published var isRecording = false
    @Published var latestTip: Tip?

    func addLine(speaker: Speaker, text: String) {
        transcript.append(TranscriptLine(speaker: speaker, text: text, timestamp: Date()))
    }

    func addTip(_ text: String) {
        let tip = Tip(text: text, timestamp: Date())
        tips.append(tip)
        latestTip = tip
    }

    var recentTranscript: String {
        transcript.suffix(20)
            .map { "\($0.speaker == .me ? "Я" : "Они"): \($0.text)" }
            .joined(separator: "\n")
    }
}
