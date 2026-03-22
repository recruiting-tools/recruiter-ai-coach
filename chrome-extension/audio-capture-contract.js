/**
 * Audio Capture Layer — Event Contract
 * Track 1 of Recruiter AI Coach pipeline:
 *   [Audio Capture] → Track 2 (Transcription) → Track 3 (Hints UI)
 *
 * This file is the single source of truth for what audio capture emits.
 * Import/include in any layer that produces or consumes audio capture events.
 *
 * FLOW:
 *   offscreen.js → chrome.runtime.sendMessage → background.js → content.js / popup.js
 *
 * STATES:
 *   IDLE → STARTING → CAPTURING → STOPPING → IDLE
 *                                           ↗
 *                    ERROR ────────────────
 */

// ── Capture state machine ─────────────────────────────────────────────────────
const CAPTURE_STATE = {
  IDLE:      'idle',       // not capturing anything
  STARTING:  'starting',   // getting streamId + creating offscreen
  CAPTURING: 'capturing',  // audio is flowing, WS connected
  STOPPING:  'stopping',   // stop requested, draining
  ERROR:     'error',      // unrecoverable error, needs user action
};

// ── Event types emitted by audio capture layer ─────────────────────────────────
const AUDIO_CAPTURE_EVENT = {
  /**
   * State machine transition.
   * Payload: { state: CAPTURE_STATE, tabId?, sessionId?, error? }
   */
  STATE_CHANGE: 'capture_state',

  /**
   * Audio level meter (every 200ms while capturing).
   * Payload: { level: number (0–255 avg), peak: number (0–255 max), silent: boolean }
   */
  AUDIO_LEVEL: 'audio_level',

  /**
   * Audio chunk stats — emitted every 5 seconds while capturing.
   * Payload: { chunksTotal, bytesTotal, durationMs, avgChunkSizeBytes, chunkRatePerSec }
   */
  AUDIO_STATS: 'audio_stats',

  /**
   * No audio detected for SILENCE_ALERT_MS milliseconds.
   * Payload: { durationMs }
   * Use to warn user that microphone/tab audio may be off.
   */
  AUDIO_SILENT: 'audio_silent',

  /**
   * Audio track ended unexpectedly (tab closed, capture lost).
   * Payload: { reason: string }
   */
  TRACK_ENDED: 'track_ended',
};

// ── WebSocket transport events (offscreen → consumer via background) ──────────
const WS_EVENT = {
  /**
   * WS connection state.
   * Payload: { status: 'connecting'|'connected'|'disconnected'|'reconnecting', attempt?, delay? }
   */
  WS_STATUS: 'ws_status',
};

// ── Thresholds ─────────────────────────────────────────────────────────────────
const CAPTURE_THRESHOLDS = {
  SILENCE_LEVEL:     5,      // audio_level.level below this = silence frame
  SILENCE_ALERT_MS:  5000,   // emit AUDIO_SILENT after this much silence
  STATS_INTERVAL_MS: 5000,   // how often to emit AUDIO_STATS
  LEVEL_INTERVAL_MS: 200,    // how often to sample audio level
  HEALTH_PING_MS:    10000,  // background → offscreen health check interval

  WS_BACKOFF_BASE_MS: 500,   // first WS reconnect delay
  WS_BACKOFF_MAX_MS:  30000, // max WS reconnect delay (exponential cap)
  WS_CHUNK_INTERVAL_MS: 250, // MediaRecorder timeslice
};

// ── Mock contract — what mock-tab-audio.js must emit ─────────────────────────
/**
 * A mock audio source MUST simulate:
 *   1. WebSocket connection to ws://localhost:3001/ws/audio?sessionId=...
 *   2. Sending binary blobs (audio/webm;codecs=opus) every CHUNK_INTERVAL_MS
 *   3. Sending JSON { type: 'stop' } on close
 *
 * The mock may optionally send:
 *   JSON { type: 'mock_meta', source: 'file'|'silence', filename?: string }
 *   immediately after WS open, so the backend can log the source.
 */

// Export for both CommonJS (Node scripts) and browser extension (via globalThis)
if (typeof module !== 'undefined') {
  module.exports = { CAPTURE_STATE, AUDIO_CAPTURE_EVENT, WS_EVENT, CAPTURE_THRESHOLDS };
} else {
  globalThis.RAC_AudioContract = { CAPTURE_STATE, AUDIO_CAPTURE_EVENT, WS_EVENT, CAPTURE_THRESHOLDS };
}
