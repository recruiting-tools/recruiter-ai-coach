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
        if secondaryLanguage.isEmpty {
            queryItems.append(.init(name: "language", value: primaryLanguage))
        } else {
            // detect_language picks from the provided list; list primary first
            queryItems.append(.init(name: "detect_language", value: "true"))
            queryItems.append(.init(name: "language", value: primaryLanguage))
            queryItems.append(.init(name: "language", value: secondaryLanguage))
        }
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
            switch result {
            case .success(let message):
                if case .string(let json) = message {
                    self?.parseResponse(json)
                }
                self?.receiveLoop()
            case .failure(let error):
                print("[Deepgram:\(self?.speaker == .me ? "mic" : "speakers")] error: \(error)")
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
        print("[Deepgram:\(speaker == .me ? "mic" : "speakers")] connected")
        onConnected?()
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
