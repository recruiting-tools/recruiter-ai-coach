import Foundation

// One DeepgramClient instance per audio stream (mic or speakers).
// Streams raw PCM audio over WebSocket and fires onTranscript on each recognized phrase.
final class DeepgramClient: NSObject {
    private var webSocketTask: URLSessionWebSocketTask?
    private lazy var urlSession = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
    private let speaker: Speaker
    private let apiKey: String

    var onTranscript: ((String, Bool) -> Void)?  // (text, isFinal)
    var onConnected: (() -> Void)?
    var onError: ((String) -> Void)?

    enum Speaker { case me, them }

    private let primaryLanguage: String
    private let secondaryLanguage: String

    init(apiKey: String, speaker: Speaker, primaryLanguage: String = "ru", secondaryLanguage: String = "en") {
        self.apiKey = apiKey
        self.speaker = speaker
        self.primaryLanguage = primaryLanguage
        self.secondaryLanguage = secondaryLanguage
    }

    func connect() {
        var components = URLComponents()
        components.scheme = "wss"
        components.host = "api.deepgram.com"
        components.path = "/v1/listen"

        // If there's a secondary language, use detect_language so Deepgram switches automatically.
        // Primary language is always listed first — Deepgram uses it as the default.
        var queryItems: [URLQueryItem] = [
            .init(name: "model", value: "nova-2"),
            .init(name: "smart_format", value: "true"),
            .init(name: "interim_results", value: "true"),
            .init(name: "encoding", value: "linear16"),
            .init(name: "sample_rate", value: "16000"),
            .init(name: "channels", value: "1"),
            .init(name: "endpointing", value: "500"),
        ]
        // Use primary language explicitly — most reliable for streaming.
        // detect_language causes buffering delays and is unreliable on WebSocket.
        queryItems.append(.init(name: "language", value: primaryLanguage))
        components.queryItems = queryItems

        var request = URLRequest(url: components.url!)
        request.setValue("Token \(apiKey)", forHTTPHeaderField: "Authorization")

        webSocketTask = urlSession.webSocketTask(with: request)
        webSocketTask?.resume()
        receiveLoop()
    }

    func send(_ audioData: Data) {
        webSocketTask?.send(.data(audioData)) { _ in }
    }

    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
    }

    private func receiveLoop() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                if case .string(let json) = message {
                    print("[Deepgram:\(self.speaker == .me ? "mic" : "spk")] ← \(json.prefix(200))")
                    self.parseResponse(json)
                }
                self.receiveLoop()
            case .failure(let error):
                print("[Deepgram:\(self.speaker == .me ? "mic" : "spk")] WS error: \(error)")
                self.onError?("WS: \(error.localizedDescription)")
            }
        }
    }

    private func parseResponse(_ json: String) {
        guard let data = json.data(using: .utf8),
              let response = try? JSONDecoder().decode(DeepgramResponse.self, from: data) else { return }

        let text = response.channel.alternatives.first?.transcript ?? ""
        guard !text.isEmpty else { return }

        let isFinal = response.isFinal
        onTranscript?(text, isFinal)
    }
}

extension DeepgramClient: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                    didOpenWithProtocol protocol: String?) {
        onConnected?()
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        let msg = reason.flatMap { String(data: $0, encoding: .utf8) } ?? "code=\(closeCode.rawValue)"
        onError?("WS closed: \(msg)")
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didCompleteWithError error: Error?) {
        if let error {
            let http = (task.response as? HTTPURLResponse).map { " HTTP \($0.statusCode)" } ?? ""
            onError?("task error\(http): \(error.localizedDescription)")
        }
    }
}

// MARK: - Deepgram response models

private struct DeepgramResponse: Decodable {
    let isFinal: Bool
    let channel: Channel

    enum CodingKeys: String, CodingKey {
        case isFinal = "is_final"
        case channel
    }

    struct Channel: Decodable {
        let alternatives: [Alternative]
    }

    struct Alternative: Decodable {
        let transcript: String
    }
}
