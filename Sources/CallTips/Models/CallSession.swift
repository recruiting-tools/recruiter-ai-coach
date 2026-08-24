import Foundation

enum CallType: String, CaseIterable, Identifiable {
    case recruiterInterview = "Я рекрутер"
    case candidateInterview = "Я кандидат"
    case workCall           = "Рабочий звонок"
    case other              = "Другое"

    var id: String { rawValue }
}

enum Speaker { case me, them }

struct TranscriptLine: Identifiable {
    let id = UUID()
    let speaker: Speaker
    let text: String
    let timestamp: Date
}

// Legacy tip kept for backwards compat within session
struct Tip: Identifiable {
    let id = UUID()
    let text: String
    let timestamp: Date
}

@MainActor
final class CallSession: ObservableObject {

    // MARK: – Pre-call config (common)
    @Published var callType: CallType = .workCall
    @Published var myGoal: String = ""
    @Published var additionalContext: String = ""
    @Published var primaryLanguage: String = "ru"
    @Published var secondaryLanguage: String = "en"

    // MARK: – Recruiter mode
    @Published var candidateName: String = ""
    @Published var resumeText: String = ""
    @Published var jobDescription: String = ""
    @Published var interviewDuration: Int = 30   // 15 / 30 / 60 min
    @Published var interviewPlan: InterviewPlan?

    // MARK: – Candidate mode
    @Published var candidateStory: String = ""   // generated + approved story

    // MARK: – Live session
    @Published var transcript: [TranscriptLine] = []
    @Published var latestTips: [CoachingTip] = []   // current set, up to 3
    @Published var allTips: [CoachingTip] = []
    @Published var isRecording = false
    @Published var debugLog: [String] = []

    // MARK: – Logging
    func log(_ msg: String) {
        let ts = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        debugLog.append("[\(ts)] \(msg)")
        if debugLog.count > 12 { debugLog.removeFirst() }
    }

    // MARK: – Transcript
    func addLine(speaker: Speaker, text: String) {
        transcript.append(TranscriptLine(speaker: speaker, text: text, timestamp: Date()))
    }

    // MARK: – Tips
    func setTips(_ tips: [CoachingTip]) {
        latestTips = tips
        allTips.append(contentsOf: tips)
    }

    // MARK: – Interview plan helpers
    func markQuestionAsked(_ id: UUID) {
        guard var plan = interviewPlan else { return }
        for si in plan.sections.indices {
            for qi in plan.sections[si].questions.indices {
                if plan.sections[si].questions[qi].id == id {
                    plan.sections[si].questions[qi].isAsked = true
                }
            }
        }
        interviewPlan = plan
    }

    // MARK: – Transcript context for AI
    var recentTranscript: String {
        transcript.suffix(20)
            .map { "\($0.speaker == .me ? "Я" : "Они"): \($0.text)" }
            .joined(separator: "\n")
    }

    var planContext: String {
        guard let plan = interviewPlan else { return "" }
        let asked = plan.allQuestions.filter(\.isAsked).map(\.text)
        let pending = plan.allQuestions.filter { !$0.isAsked }.map(\.text)
        var parts: [String] = []
        if !asked.isEmpty {
            parts.append("Уже спросили:\n" + asked.map { "• \($0)" }.joined(separator: "\n"))
        }
        if !pending.isEmpty {
            parts.append("Ещё не спрашивали:\n" + pending.map { "• \($0)" }.joined(separator: "\n"))
        }
        return parts.joined(separator: "\n\n")
    }
}
