# Speaker Separation Research — Recruiter AI Coach

## Problem

During a Google Meet call, the Chrome extension captures a single audio stream via `tabCapture`. This stream contains both the recruiter's voice and the candidate's voice mixed together. To provide useful coaching hints, the system must know **who is speaking** — the recruiter or the candidate.

---

## Option 1: Deepgram Diarization (streaming)

**How it works:**
- Add `diarize=true` to the Deepgram WebSocket connection params.
- Deepgram labels each word with `speaker: 0` or `speaker: 1` and a `speaker_confidence` score.
- Works with the existing single-stream pipeline — no changes to audio capture needed.
- Diarization is supported on Deepgram's streaming (real-time) WebSocket API with Nova-2 model.

**Deepgram response format with diarization:**
```json
{
  "type": "Results",
  "channel": {
    "alternatives": [{
      "transcript": "Tell me about your experience",
      "words": [
        { "word": "tell", "start": 0.0, "end": 0.2, "speaker": 0, "speaker_confidence": 0.85 },
        { "word": "me", "start": 0.2, "end": 0.3, "speaker": 0, "speaker_confidence": 0.85 }
      ]
    }]
  },
  "is_final": true,
  "speech_final": false
}
```

**Pros:**
- Zero additional capture complexity — works with existing single stream
- No permission prompts to the user (no mic access needed)
- Single Deepgram connection, no extra cost
- Already implemented in Iteration 1

**Cons:**
- Speaker IDs are anonymous (0, 1) — must map to recruiter/candidate heuristically
- Accuracy varies: works well with clear turn-taking, less reliable with overlapping speech
- Latency: diarization adds ~200-500ms to transcript results
- Cannot distinguish speakers if they have similar voice characteristics
- Speaker numbering can change across Deepgram reconnections

**Mapping speakers to roles:**
The system doesn't know which Deepgram speaker ID maps to "recruiter" vs "candidate". Heuristic approaches:
1. Assume the first speaker is the recruiter (recruiters usually open the call)
2. Use microphone capture (Option 2) to fingerprint the recruiter's voice
3. Let the user manually tag after first few utterances

---

## Option 2: Separate Microphone Capture via getUserMedia

**How it works:**
- In the offscreen document, call `navigator.mediaDevices.getUserMedia({ audio: true })` to capture the recruiter's microphone.
- Now you have two streams:
  - **Tab stream** (tabCapture): contains both speakers (mixed from Google Meet)
  - **Mic stream** (getUserMedia): contains only the recruiter's voice
- Send both streams to the backend.
- The backend can detect when the mic stream has speech = recruiter is talking; when only tab stream has speech = candidate is talking.

**Implementation sketch:**
```javascript
// In offscreen.js
const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const micRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' });

// Send mic audio on a separate WS or tag chunks
micRecorder.ondataavailable = (e) => {
  ws.send(JSON.stringify({ type: 'mic_chunk', data: arrayBufferToBase64(e.data) }));
};
```

**Pros:**
- Deterministic: mic = recruiter, always
- No ambiguity in speaker identification
- Can run VAD (Voice Activity Detection) on mic stream to know exactly when recruiter speaks
- Works regardless of Deepgram diarization quality

**Cons:**
- Requires microphone permission — Chrome will show a permission prompt
- Offscreen documents may have limited `getUserMedia` capabilities (needs testing)
- Echo: mic captures the recruiter but may also pick up speaker output (candidate's voice through speakers)
- Two streams = more bandwidth to backend
- More complex state management (two MediaRecorders, sync issues)

**Echo mitigation:**
- Use `echoCancellation: true` in getUserMedia constraints
- Apply a noise gate to the mic stream
- Cross-correlate: if tab and mic have similar audio, it's echo not a second speaker

---

## Option 3: Deepgram Multichannel

**How it works:**
- Combine mic + tab into a stereo (2-channel) audio stream.
- Send to Deepgram with `multichannel=true&channels=2`.
- Deepgram transcribes each channel independently, labeling them channel 0 and channel 1.
- Channel 0 = mic = recruiter, Channel 1 = tab = mixed (but primarily candidate).

**Implementation sketch:**
```javascript
// In offscreen.js — mix two mono streams into one stereo stream
const audioCtx = new AudioContext();
const micSource = audioCtx.createMediaStreamSource(micStream);
const tabSource = audioCtx.createMediaStreamSource(tabStream);

const merger = audioCtx.createChannelMerger(2);
micSource.connect(merger, 0, 0); // mic → left channel
tabSource.connect(merger, 0, 1); // tab → right channel

const dest = audioCtx.createMediaStreamDestination();
merger.connect(dest);

// Record dest.stream — stereo WebM/Opus
const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
```

**Deepgram params:** `multichannel=true&channels=2&model=nova-2&language=ru`

**Pros:**
- Single Deepgram connection (not 2x cost)
- Clean channel separation: channel 0 = recruiter, channel 1 = everyone
- Deepgram transcribes each channel independently — best accuracy
- No heuristic speaker mapping needed

**Cons:**
- Requires microphone permission (same as Option 2)
- WebM/Opus stereo encoding in MediaRecorder may have quirks
- Tab channel still has recruiter's voice mixed in (echo from Google Meet)
- ChannelMerger + MediaStreamDestination adds complexity in AudioContext
- Not all Deepgram models support multichannel streaming equally well

---

## Option 4: Client-side VAD (not recommended)

**How it works:**
- Run Voice Activity Detection on the tab audio in the extension.
- Detect speech segments by energy/frequency patterns.
- Cannot distinguish speakers — only knows "someone is talking".

**Verdict:** Not useful alone. Could supplement other approaches for latency optimization.

---

## Comparison Matrix

| Criteria | Diarization | Mic Separate | Multichannel |
|----------|------------|-------------|-------------|
| Accuracy | Medium | High | Highest |
| Latency added | ~200-500ms | ~0 (VAD is local) | ~0 (channel-based) |
| Permissions needed | None | Mic access | Mic access |
| Implementation effort | Low (done) | Medium | High |
| Deepgram cost | 1x | 2x (two streams) | 1x |
| Speaker role mapping | Heuristic | Deterministic | Deterministic |
| Works with overlapping speech | Poor | Good | Good |

---

## Recommendation for Iteration 2

**Approach: Option 2 (Mic Separate) as primary, with Option 1 (Diarization) as fallback.**

Rationale:
1. **Start with mic capture in offscreen.js** — `getUserMedia({ audio: true, echoCancellation: true })`. This gives us deterministic recruiter identification.
2. **Send mic audio as a separate tagged stream** to the backend (or on the same WebSocket with a type prefix).
3. **Backend runs simple VAD** on mic audio: when mic has speech, the transcript segment is from the recruiter. When only tab has speech, it's the candidate.
4. **Keep Deepgram diarization enabled** as a supplementary signal — helps when mic VAD is ambiguous.
5. **Defer multichannel (Option 3)** to Iteration 3 — it's the most accurate but most complex. Only worth it if Option 2 accuracy is insufficient.

**Step-by-step for Iteration 2:**
1. Add `getUserMedia({ audio: true })` to offscreen.js — test that it works alongside tabCapture
2. Create a second MediaRecorder for mic stream, send chunks to backend tagged as `mic`
3. Backend: simple energy-based VAD on mic chunks — detect recruiter speech windows
4. Correlate: if recruiter mic is active during a transcript segment → speaker=recruiter
5. Test with a real Google Meet call, measure accuracy

**Future (Iteration 3):**
- If mic+VAD works well, optionally upgrade to multichannel for even better accuracy
- Add Vosk keyword spotter on the recruiter channel specifically
