import AVFoundation

// Captures microphone input (user's voice) and converts to 16kHz PCM for Deepgram
final class MicCapture {
    private let engine = AVAudioEngine()
    private var converter: AVAudioConverter?
    var onAudioChunk: ((Data) -> Void)?

    private let deepgramFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: 16000,
        channels: 1,
        interleaved: true
    )!

    func start() throws {
        let input = engine.inputNode
        let nativeFormat = input.outputFormat(forBus: 0)

        converter = AVAudioConverter(from: nativeFormat, to: deepgramFormat)

        input.installTap(onBus: 0, bufferSize: 4096, format: nativeFormat) { [weak self] buffer, _ in
            self?.convert(buffer)
        }

        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }

    private func convert(_ inputBuffer: AVAudioPCMBuffer) {
        guard let converter else { return }

        let frameCapacity = AVAudioFrameCount(
            Double(inputBuffer.frameLength) * deepgramFormat.sampleRate / inputBuffer.format.sampleRate
        )
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: deepgramFormat, frameCapacity: frameCapacity) else { return }

        var inputConsumed = false
        converter.convert(to: outputBuffer, error: nil) { _, outStatus in
            if inputConsumed {
                outStatus.pointee = .noDataNow
                return nil
            }
            outStatus.pointee = .haveData
            inputConsumed = true
            return inputBuffer
        }

        guard outputBuffer.frameLength > 0, let channelData = outputBuffer.int16ChannelData else { return }
        let byteCount = Int(outputBuffer.frameLength) * MemoryLayout<Int16>.size
        let data = Data(bytes: channelData[0], count: byteCount)
        onAudioChunk?(data)
    }
}
