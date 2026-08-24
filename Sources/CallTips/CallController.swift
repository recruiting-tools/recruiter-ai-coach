import Foundation

// Orchestrates audio capture → transcription → coaching in one place.
@MainActor
final class CallController: ObservableObject {
    private let micCapture = MicCapture()
    private let speakerCapture = SpeakerCapture()
    private var micDeepgram: DeepgramClient?
    private var speakerDeepgram: DeepgramClient?
    private var coachEngine: CoachEngine?

    // Read API keys from environment or config
    private var deepgramKey: String { ProcessInfo.processInfo.environment["DEEPGRAM_API_KEY"] ?? "" }
    private var claudeKey: String { ProcessInfo.processInfo.environment["CLAUDE_API_KEY"] ?? "" }

    func startCall(session: CallSession) async {
        session.isRecording = true

        coachEngine = CoachEngine(apiKey: claudeKey)

        // Set up Deepgram for microphone
        micDeepgram = DeepgramClient(apiKey: deepgramKey, speaker: .me)
        micDeepgram?.onTranscript = { [weak session, weak self] text, isFinal in
            guard isFinal, let session else { return }
            Task { @MainActor in
                session.addLine(speaker: .me, text: text)
                await self?.maybeFetchTip(session: session)
            }
        }

        // Set up Deepgram for speakers
        speakerDeepgram = DeepgramClient(apiKey: deepgramKey, speaker: .them)
        speakerDeepgram?.onTranscript = { [weak session, weak self] text, isFinal in
            guard isFinal, let session else { return }
            Task { @MainActor in
                session.addLine(speaker: .them, text: text)
                await self?.maybeFetchTip(session: session)
            }
        }

        micDeepgram?.connect()
        speakerDeepgram?.connect()

        // Wire audio → Deepgram
        micCapture.onAudioChunk = { [weak self] data in
            self?.micDeepgram?.send(data)
        }
        speakerCapture.onAudioChunk = { [weak self] data in
            self?.speakerDeepgram?.send(data)
        }

        do {
            try micCapture.start()
            try await speakerCapture.start()
        } catch {
            print("[CallController] Failed to start capture: \(error)")
        }
    }

    func stopCall() async {
        micCapture.stop()
        speakerCapture.stop()
        micDeepgram?.disconnect()
        speakerDeepgram?.disconnect()
        micDeepgram = nil
        speakerDeepgram = nil
    }

    // Throttle: only ask Claude after every 3 final utterances to avoid spam
    private var utterancesSinceLastTip = 0

    private func maybeFetchTip(session: CallSession) async {
        utterancesSinceLastTip += 1
        guard utterancesSinceLastTip >= 3 else { return }
        utterancesSinceLastTip = 0

        if let tip = await coachEngine?.requestTip(session: session) {
            session.addTip(tip)
        }
    }
}
