import Foundation

// Orchestrates audio capture → transcription → coaching in one place.
@MainActor
final class CallController: ObservableObject {
    private let micCapture = MicCapture()
    private let speakerCapture = SpeakerCapture()
    private var micDeepgram: DeepgramClient?
    private var speakerDeepgram: DeepgramClient?
    private var coachEngine: CoachEngine?

    // Read API keys: env vars take priority, then .env file next to the binary
    private lazy var envVars: [String: String] = loadDotEnv()
    private var deepgramKey: String { ProcessInfo.processInfo.environment["DEEPGRAM_API_KEY"] ?? envVars["DEEPGRAM_API_KEY"] ?? "" }
    private var openrouterKey: String { ProcessInfo.processInfo.environment["OPENROUTER_API_KEY"] ?? envVars["OPENROUTER_API_KEY"] ?? "" }

    private func loadDotEnv() -> [String: String] {
        let candidates = [
            URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent(".env"),
            Bundle.main.resourceURL?.appendingPathComponent(".env"),
            Bundle.main.bundleURL.appendingPathComponent(".env"),
        ].compactMap { $0 }
        for url in candidates {
            guard let content = try? String(contentsOf: url) else { continue }
            var result: [String: String] = [:]
            for line in content.components(separatedBy: .newlines) {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty, !trimmed.hasPrefix("#"), let eq = trimmed.firstIndex(of: "=") else { continue }
                let key = String(trimmed[trimmed.startIndex..<eq])
                let value = String(trimmed[trimmed.index(after: eq)...]).trimmingCharacters(in: .init(charactersIn: "\"'"))
                result[key] = value
            }
            return result
        }
        return [:]
    }

    func startCall(session: CallSession) async {
        session.isRecording = true
        session.log("⏳ Старт...")

        let dg = deepgramKey
        let or = openrouterKey
        session.log("🔑 DG:\(dg.isEmpty ? "❌ нет" : "✅(\(dg.prefix(6))...)") OR:\(or.isEmpty ? "❌ нет" : "✅")")

        coachEngine = CoachEngine(apiKey: or)

        let primary = session.primaryLanguage
        let secondary = session.secondaryLanguage

        // Set up Deepgram for microphone
        micDeepgram = DeepgramClient(apiKey: dg, speaker: .me, primaryLanguage: primary, secondaryLanguage: secondary)
        micDeepgram?.onConnected = { Task { @MainActor in session.log("🎙 mic → DG подключён") } }
        micDeepgram?.onError = { err in Task { @MainActor in session.log("❌ mic DG: \(err)") } }
        micDeepgram?.onTranscript = { [weak session, weak self] text, isFinal in
            guard let session else { return }
            Task { @MainActor in
                if isFinal {
                    session.log("🎙 Я: \(text.prefix(40))")
                    session.addLine(speaker: .me, text: text)
                    await self?.maybeFetchTip(session: session)
                }
            }
        }

        // Set up Deepgram for speakers
        speakerDeepgram = DeepgramClient(apiKey: dg, speaker: .them, primaryLanguage: primary, secondaryLanguage: secondary)
        speakerDeepgram?.onConnected = { Task { @MainActor in session.log("🔊 spk → DG подключён") } }
        speakerDeepgram?.onError = { err in Task { @MainActor in session.log("❌ spk DG: \(err)") } }
        speakerDeepgram?.onTranscript = { [weak session, weak self] text, isFinal in
            guard let session else { return }
            Task { @MainActor in
                if isFinal {
                    session.log("🔊 Они: \(text.prefix(40))")
                    session.addLine(speaker: .them, text: text)
                    await self?.maybeFetchTip(session: session)
                }
            }
        }

        micDeepgram?.connect()
        speakerDeepgram?.connect()

        // Wire audio → Deepgram
        var micChunks = 0
        var spkChunks = 0
        micCapture.onAudioChunk = { [weak self, weak session] data in
            self?.micDeepgram?.send(data)
            micChunks += 1
            if micChunks == 10 {
                Task { @MainActor in session?.log("🎙 mic аудио идёт (\(data.count)b/chunk)") }
            }
        }
        speakerCapture.onAudioChunk = { [weak self, weak session] data in
            self?.speakerDeepgram?.send(data)
            spkChunks += 1
            if spkChunks == 5 {
                Task { @MainActor in session?.log("🔊 spk аудио идёт (\(data.count)b/chunk)") }
            }
        }

        do {
            session.log("🎙 запрос микрофона...")
            try micCapture.start()
            session.log("🔊 запрос screen capture...")
            try await speakerCapture.start()
            session.log("✅ оба потока активны")
        } catch {
            session.log("❌ захват: \(error.localizedDescription)")
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
