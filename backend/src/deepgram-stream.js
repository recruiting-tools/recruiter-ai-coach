// Deepgram Streaming WebSocket client
const WebSocket = require('ws');

class DeepgramStream {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.ws = null;
    this.keepaliveInterval = null;
    this.ready = false;
    this.buffer = [];

    this.params = {
      model: 'nova-2',
      language: options.language || 'multi',
      smart_format: 'true',
      interim_results: 'true',
      endpointing: '300',
      diarize: 'true',
      ...options.params,
    };

    this.onTranscript = null;
    this.onUtteranceEnd = null;
    this.onOpen = null;
    this.onClose = null;
    this.onError = null;
  }

  connect() {
    const qs = new URLSearchParams(this.params).toString();
    const url = `wss://api.deepgram.com/v1/listen?${qs}`;

    console.log('[Deepgram] Connecting via ws lib...');

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    this.ws.on('open', () => {
      console.log('[Deepgram] Connected! Flushing', this.buffer.length, 'buffered chunks');
      this.ready = true;
      this.onOpen?.();

      for (const chunk of this.buffer) {
        this.ws.send(chunk);
      }
      this.buffer = [];

      this.keepaliveInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 8000);
    });

    this.ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'Results') {
          const alt = msg.channel?.alternatives?.[0];
          const transcript = alt?.transcript || '';
          if (transcript) {
            // Extract speaker info from diarization (words[].speaker)
            const speaker = this._extractSpeaker(alt?.words);

            this.onTranscript?.({
              transcript,
              confidence: alt?.confidence || 0,
              isFinal: msg.is_final,
              speechFinal: msg.speech_final,
              start: msg.start,
              duration: msg.duration,
              words: alt?.words,
              speaker,
            });
          }
        }

        if (msg.type === 'UtteranceEnd') {
          this.onUtteranceEnd?.();
        }

        if (msg.type === 'Metadata') {
          console.log('[Deepgram] Ready, request:', msg.request_id);
        }
      } catch (err) {
        console.error('[Deepgram] Parse error:', err.message);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[Deepgram] Error:', err.message);
      this.onError?.(err);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[Deepgram] Disconnected (${code})`);
      this.ready = false;
      clearInterval(this.keepaliveInterval);
      this.onClose?.(code, reason);
    });
  }

  /**
   * Extract dominant speaker from Deepgram diarization word data.
   * Returns { id: number, confidence: number } or null if no diarization data.
   */
  _extractSpeaker(words) {
    if (!words || words.length === 0) return null;

    // Count words per speaker and accumulate confidence
    const speakers = {};
    for (const w of words) {
      if (w.speaker == null) continue;
      if (!speakers[w.speaker]) {
        speakers[w.speaker] = { count: 0, totalConfidence: 0 };
      }
      speakers[w.speaker].count++;
      speakers[w.speaker].totalConfidence += (w.speaker_confidence || 0);
    }

    const entries = Object.entries(speakers);
    if (entries.length === 0) return null;

    // Pick the speaker with the most words in this segment
    entries.sort((a, b) => b[1].count - a[1].count);
    const [speakerId, data] = entries[0];

    return {
      id: parseInt(speakerId, 10),
      confidence: data.count > 0
        ? Math.round((data.totalConfidence / data.count) * 100) / 100
        : 0,
    };
  }

  sendAudio(data) {
    if (this.ready && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.buffer.push(data);
      if (this.buffer.length > 200) this.buffer.shift();
    }
  }

  close() {
    this.ready = false;
    this.buffer = [];
    clearInterval(this.keepaliveInterval);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
    }
    this.ws?.close();
    this.ws = null;
  }
}

module.exports = DeepgramStream;
