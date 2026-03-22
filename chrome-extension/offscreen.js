/**
 * Offscreen Document — Audio Capture Layer (Track 1)
 * Runs hidden in the background, invisible to the user.
 *
 * Responsibilities:
 *   1. Receive streamId from background.js
 *   2. Capture tab audio via getUserMedia (chromeMediaSource: 'tab')
 *   3. Monitor audio level + silence detection
 *   4. Stream audio chunks to backend via WebSocket
 *   5. Emit state events back to background.js via chrome.runtime.sendMessage
 *
 * Does NOT do: transcription, hints, UI updates. Those are Track 2 & 3.
 *
 * State machine: IDLE → STARTING → CAPTURING → STOPPING → IDLE
 *                                                        ↗
 *                              ERROR ──────────────────
 */

const BACKEND_WS = 'ws://localhost:3001/ws/audio';

// ── State machine ─────────────────────────────────────────────────────────────
const STATE = {
  IDLE:      'idle',
  STARTING:  'starting',
  CAPTURING: 'capturing',
  STOPPING:  'stopping',
  ERROR:     'error',
};

let state = STATE.IDLE;

// ── Runtime handles ───────────────────────────────────────────────────────────
let sessionId    = null;
let stream       = null;
let gainedStream = null;  // amplified MediaStream from AudioContext gain node
let audioCtx     = null;
let mediaRecorder = null;
let ws           = null;

// ── Timers ────────────────────────────────────────────────────────────────────
let levelIntervalId = null;
let statsIntervalId = null;

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = { chunksTotal: 0, bytesTotal: 0, startedAt: null };

// ── Silence detection ─────────────────────────────────────────────────────────
const SILENCE_LEVEL     = 5;      // avg frequency amplitude below this = silence
const SILENCE_ALERT_MS  = 5000;   // alert after this much consecutive silence
const LEVEL_INTERVAL_MS = 200;
let silenceStart = null;          // timestamp when silence began (null = sound present)

// ── WS reconnect (exponential backoff) ───────────────────────────────────────
const WS_BACKOFF_BASE = 500;
const WS_BACKOFF_MAX  = 30000;
let wsRetryCount = 0;
let wsRetryTimer = null;

function wsDelay() {
  return Math.min(WS_BACKOFF_BASE * Math.pow(2, wsRetryCount), WS_BACKOFF_MAX);
}

// ─────────────────────────────────────────────────────────────────────────────
// Message handler (receives commands from background.js)
// ─────────────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;

  if (msg.type === 'start_capture') {
    startCapture(msg.streamId, msg.sessionId);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'stop_capture') {
    stopCapture('user_request');
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'health_ping') {
    sendResponse({ ok: true, state, sessionId });
    return;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// State transitions
// ─────────────────────────────────────────────────────────────────────────────
function transition(newState, extra = {}) {
  const prev = state;
  state = newState;
  console.log(`[Offscreen] ${prev} → ${newState}`, extra);
  emit('capture_state', { state: newState, sessionId, ...extra });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main capture lifecycle
// ─────────────────────────────────────────────────────────────────────────────
async function startCapture(streamId, sid) {
  if (state !== STATE.IDLE) {
    console.warn('[Offscreen] startCapture called in state:', state, '— stopping first');
    await stopCapture('restart');
  }

  transition(STATE.STARTING);
  sessionId = sid || ('tab_' + Date.now());
  stats.chunksTotal = 0;
  stats.bytesTotal  = 0;
  stats.startedAt   = Date.now();
  wsRetryCount      = 0;
  silenceStart      = null;

  // 1. Capture the tab audio stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource:   'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });
  } catch (err) {
    console.error('[Offscreen] getUserMedia error:', err);
    transition(STATE.ERROR, { error: err.message });
    return;
  }

  const track = stream.getAudioTracks()[0];
  if (!track) {
    transition(STATE.ERROR, { error: 'No audio track in stream' });
    return;
  }

  console.log('[Offscreen] Audio track ready:', track.label, '/ state:', track.readyState);

  // Track lifecycle events
  track.onended = () => {
    console.warn('[Offscreen] Audio track ended — tab closed or capture lost');
    emit('track_ended', { reason: 'track_ended' });
    if (state === STATE.CAPTURING) {
      handleCaptureError('Audio track ended');
    }
  };
  track.onmute   = () => console.log('[Offscreen] Track muted');
  track.onunmute = () => console.log('[Offscreen] Track unmuted');

  // 2. Set up AudioContext for level monitoring
  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  audioCtx.onstatechange = () => {
    console.log('[Offscreen] AudioContext state:', audioCtx.state);
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  };

  const source   = audioCtx.createMediaStreamSource(stream);
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 2.0; // amplify quiet tab audio

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  const levelData = new Uint8Array(analyser.frequencyBinCount);

  // Route: source → gain → analyser (level meter) + gainDest (recording)
  // NOTE: gainNode intentionally NOT connected to audioCtx.destination — no playback/echo
  const gainDest = audioCtx.createMediaStreamDestination();
  source.connect(gainNode);
  gainNode.connect(analyser);
  gainNode.connect(gainDest);
  gainedStream = gainDest.stream; // MediaRecorder uses this — gets amplified audio

  // 3. Level monitor + silence detection
  levelIntervalId = setInterval(() => {
    if (track.readyState !== 'live') return;

    analyser.getByteFrequencyData(levelData);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < levelData.length; i++) {
      sum += levelData[i];
      if (levelData[i] > peak) peak = levelData[i];
    }
    const level  = Math.round(sum / levelData.length);
    const silent = level < SILENCE_LEVEL;

    emit('audio_level', { level, peak, silent });

    // Silence detection
    if (silent) {
      if (silenceStart === null) silenceStart = Date.now();
      const silenceDuration = Date.now() - silenceStart;
      if (silenceDuration >= SILENCE_ALERT_MS) {
        emit('audio_silent', { durationMs: silenceDuration });
        // Reset so we don't spam — next alert fires after another SILENCE_ALERT_MS
        silenceStart = Date.now();
      }
    } else {
      silenceStart = null;
    }
  }, LEVEL_INTERVAL_MS);

  // 4. Stats timer
  statsIntervalId = setInterval(() => {
    if (state !== STATE.CAPTURING) return;
    const durationMs = Date.now() - stats.startedAt;
    emit('audio_stats', {
      chunksTotal:      stats.chunksTotal,
      bytesTotal:       stats.bytesTotal,
      durationMs,
      avgChunkSizeBytes: stats.chunksTotal > 0
        ? Math.round(stats.bytesTotal / stats.chunksTotal)
        : 0,
      chunkRatePerSec: stats.chunksTotal > 0
        ? Math.round((stats.chunksTotal / durationMs) * 1000 * 10) / 10
        : 0,
    });
  }, 5000);

  // 5. Connect WebSocket (will start MediaRecorder on open)
  connectWebSocket();
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket — connection + MediaRecorder
// ─────────────────────────────────────────────────────────────────────────────
function connectWebSocket() {
  if (!stream || stream.getAudioTracks()[0]?.readyState !== 'live') {
    console.warn('[Offscreen] Stream dead, skipping WS connect');
    return;
  }
  if (state === STATE.STOPPING || state === STATE.IDLE) return;

  clearTimeout(wsRetryTimer);
  wsRetryTimer = null;

  const url = `${BACKEND_WS}?sessionId=${encodeURIComponent(sessionId)}`;
  const attempt = wsRetryCount + 1;
  console.log(`[Offscreen] WS connecting (attempt ${attempt})...`);
  emit('ws_status', { status: 'connecting', attempt });

  try {
    ws = new WebSocket(url);
  } catch (err) {
    scheduleWsReconnect();
    return;
  }

  ws.onopen = () => {
    wsRetryCount = 0;
    console.log('[Offscreen] WS connected');
    emit('ws_status', { status: 'connected' });

    // Start MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    mediaRecorder = new MediaRecorder(gainedStream || stream, { mimeType: 'audio/webm;codecs=opus' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      stats.chunksTotal++;
      stats.bytesTotal += e.data.size;

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }

      // Log first 3 chunks + periodic
      if (stats.chunksTotal <= 3 || stats.chunksTotal % 40 === 0) {
        console.log(`[Offscreen] Chunk #${stats.chunksTotal}, ${e.data.size}B`);
      }
    };

    mediaRecorder.onerror = (e) => {
      console.error('[Offscreen] MediaRecorder error:', e.error?.message || e.type);
    };

    mediaRecorder.start(250); // 250ms chunks

    if (state === STATE.STARTING) {
      transition(STATE.CAPTURING);
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // Forward transcript/hint events up to background.js
      if (['transcript_interim', 'transcript_final', 'hint', 'error'].includes(msg.type)) {
        chrome.runtime.sendMessage(msg).catch(() => {});
      }
    } catch {}
  };

  ws.onerror = (e) => {
    console.warn('[Offscreen] WS error');
  };

  ws.onclose = (e) => {
    ws = null;
    console.log(`[Offscreen] WS closed (code=${e.code})`);
    emit('ws_status', { status: 'disconnected', code: e.code });

    if (state === STATE.CAPTURING) {
      scheduleWsReconnect();
    }
  };
}

function scheduleWsReconnect() {
  if (state === STATE.STOPPING || state === STATE.IDLE || state === STATE.ERROR) return;

  const delay = wsDelay();
  wsRetryCount++;
  console.log(`[Offscreen] WS reconnect in ${delay}ms (attempt ${wsRetryCount})`);
  emit('ws_status', { status: 'reconnecting', attempt: wsRetryCount, delay });

  wsRetryTimer = setTimeout(() => connectWebSocket(), delay);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop capture
// ─────────────────────────────────────────────────────────────────────────────
function stopCapture(reason = 'user_request') {
  if (state === STATE.IDLE) return;
  console.log(`[Offscreen] stopCapture (reason=${reason})`);
  transition(STATE.STOPPING);

  clearTimeout(wsRetryTimer);
  wsRetryTimer = null;
  clearInterval(levelIntervalId);
  levelIntervalId = null;
  clearInterval(statsIntervalId);
  statsIntervalId = null;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;

  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
    }
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  if (gainedStream) {
    gainedStream.getTracks().forEach((t) => t.stop());
    gainedStream = null;
  }

  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  sessionId = null;
  transition(STATE.IDLE, { reason });
}

// ─────────────────────────────────────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────────────────────────────────────
function handleCaptureError(error) {
  console.error('[Offscreen] Capture error:', error);
  stopCapture('error');
  // Re-emit as error state after IDLE transition
  setTimeout(() => {
    state = STATE.ERROR;
    emit('capture_state', { state: STATE.ERROR, error, sessionId: null });
  }, 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function emit(type, payload = {}) {
  chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
}
