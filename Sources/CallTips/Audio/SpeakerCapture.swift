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

    func stop() async {
        onAudioChunk = nil
        let s = stream
        stream = nil
        try? await s?.stopCapture()
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

    // ScreenCaptureKit delivers Float32 PCM; Deepgram needs Int16 (linear16).
    private func audioData(from sampleBuffer: CMSampleBuffer) -> Data? {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer) else { return nil }
        let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription)?.pointee

        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return nil }
        var length = 0
        var dataPointer: UnsafeMutablePointer<CChar>?
        CMBlockBufferGetDataPointer(blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)
        guard let pointer = dataPointer, length > 0 else { return nil }

        // If format is Float32, convert sample-by-sample to Int16
        let isFloat = asbd.map { $0.mFormatFlags & kAudioFormatFlagIsFloat != 0 } ?? true
        if isFloat {
            let frameCount = length / MemoryLayout<Float32>.size
            let floats = UnsafeBufferPointer(start: UnsafeRawPointer(pointer).assumingMemoryBound(to: Float32.self), count: frameCount)
            var result = Data(count: frameCount * MemoryLayout<Int16>.size)
            result.withUnsafeMutableBytes { raw in
                let out = raw.baseAddress!.assumingMemoryBound(to: Int16.self)
                for i in 0..<frameCount {
                    let clamped = max(-1.0, min(1.0, floats[i]))
                    out[i] = Int16(clamped * Float32(Int16.max))
                }
            }
            return result
        }

        return Data(bytes: pointer, count: length)
    }
}

extension SpeakerCapture: SCStreamDelegate {
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("[SpeakerCapture] stream stopped: \(error)")
    }
}
