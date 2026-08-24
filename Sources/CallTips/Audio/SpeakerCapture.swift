import ScreenCaptureKit
import CoreMedia

// Captures system audio (other participants' voices) via ScreenCaptureKit.
// Requires Screen Recording permission in System Settings → Privacy & Security.
final class SpeakerCapture: NSObject {
    private var stream: SCStream?
    var onAudioChunk: ((Data) -> Void)?

    func start() async throws {
        let content = try await SCShareableContent.current
        guard let display = content.displays.first else {
            throw CaptureError.noDisplay
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.sampleRate = 16000
        config.channelCount = 1

        // We don't need video frames, minimize impact
        config.width = 2
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)  // 1 fps - effectively disabled
        config.showsCursor = false

        stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global(qos: .userInteractive))
        try await stream?.startCapture()
    }

    func stop() {
        Task { try? await stream?.stopCapture() }
        stream = nil
    }

    enum CaptureError: Error {
        case noDisplay
    }
}

extension SpeakerCapture: SCStreamOutput {
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        guard let data = audioData(from: sampleBuffer) else { return }
        onAudioChunk?(data)
    }

    private func audioData(from sampleBuffer: CMSampleBuffer) -> Data? {
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return nil }
        var length = 0
        var dataPointer: UnsafeMutablePointer<CChar>? = nil
        CMBlockBufferGetDataPointer(blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)
        guard let pointer = dataPointer, length > 0 else { return nil }
        return Data(bytes: pointer, count: length)
    }
}

extension SpeakerCapture: SCStreamDelegate {
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("[SpeakerCapture] stream stopped: \(error)")
    }
}
