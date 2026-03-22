#!/usr/bin/env node
/**
 * Mock Tab Audio Client — Track 1 test tool
 *
 * Simulates what offscreen.js sends to the backend WebSocket.
 * Use this to test Track 2 (Transcription) and Track 3 (Hints) WITHOUT
 * a real Chrome tab or Google Meet session.
 *
 * Usage:
 *   node scripts/mock-tab-audio.js                          # send silence
 *   node scripts/mock-tab-audio.js --file debug-audio.webm  # replay a recorded file
 *   node scripts/mock-tab-audio.js --file audio.webm --loop # loop the file
 *   node scripts/mock-tab-audio.js --session my-test-1      # custom sessionId
 *
 * What it does:
 *   1. Connects to ws://localhost:3001/ws/audio?sessionId=...
 *   2. Sends binary audio chunks every 250ms (same as MediaRecorder timeslice)
 *   3. Receives and prints transcript/hint events from the backend
 *   4. Sends { type: 'stop' } on Ctrl+C
 *
 * Expected contract (mirrors offscreen.js → backend protocol):
 *   → binary Blob (audio/webm;codecs=opus), 250ms chunks
 *   → JSON { type: 'stop' } on close
 *   ← JSON { type: 'transcript_interim', text }
 *   ← JSON { type: 'transcript_final', text, speaker, speechFinal }
 *   ← JSON { type: 'hint', hint }
 *   ← JSON { type: 'error', error }
 */

const path = require('path');
const fs   = require('fs');
const WebSocket = require(path.join(__dirname, '../backend/node_modules/ws'));

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}
const hasFlag = (flag) => args.includes(flag);

const WS_URL    = getArg('--url') || 'ws://localhost:3001/ws/audio';
const AUDIO_FILE = getArg('--file') || null;
const SESSION_ID = getArg('--session') || ('mock_' + Date.now());
const LOOP       = hasFlag('--loop');
const CHUNK_MS   = parseInt(getArg('--chunk-ms') || '250', 10);

// ── State ─────────────────────────────────────────────────────────────────────
let ws = null;
let chunksSent = 0;
let bytesSent  = 0;
let startedAt  = null;
let sendTimer  = null;
let retryCount = 0;
const MAX_RETRIES = 5;

// ── Audio source ──────────────────────────────────────────────────────────────
let audioChunks  = null;   // array of Buffer chunks (file mode)
let chunkIndex   = 0;

function loadAudioChunks() {
  if (!AUDIO_FILE) return null;
  const filePath = path.resolve(process.cwd(), AUDIO_FILE);
  if (!fs.existsSync(filePath)) {
    console.error('[Mock] File not found:', filePath);
    process.exit(1);
  }
  const fileData = fs.readFileSync(filePath);
  console.log(`[Mock] Loaded ${AUDIO_FILE} — ${(fileData.length / 1024).toFixed(1)} KB`);
  // Split into CHUNK_MS-sized pieces (approximate by byte size)
  // Assume ~24 KB/s for opus audio at 250ms intervals → ~6 KB per chunk
  const chunkSize = Math.ceil(fileData.length / Math.ceil(fileData.length / 6000));
  const chunks = [];
  for (let i = 0; i < fileData.length; i += chunkSize) {
    chunks.push(fileData.slice(i, i + chunkSize));
  }
  console.log(`[Mock] Split into ${chunks.length} chunks (~${Math.round(chunkSize/1024)}KB each)`);
  return chunks;
}

function nextChunk() {
  // File mode
  if (audioChunks) {
    if (chunkIndex >= audioChunks.length) {
      if (LOOP) {
        chunkIndex = 0;
        console.log('[Mock] Looping audio file...');
      } else {
        return null; // end of file
      }
    }
    return audioChunks[chunkIndex++];
  }

  // Silence mode — 6KB of zeros (opus silence approximation)
  return Buffer.alloc(6000, 0);
}

// ── Connect ───────────────────────────────────────────────────────────────────
function connect() {
  const url = `${WS_URL}?sessionId=${encodeURIComponent(SESSION_ID)}`;
  console.log(`[Mock] Connecting to ${url}`);

  ws = new WebSocket(url);

  ws.on('open', () => {
    retryCount = 0;
    startedAt  = Date.now();
    console.log(`[Mock] Connected! SessionId: ${SESSION_ID}`);
    console.log(`[Mock] Mode: ${AUDIO_FILE ? `file (${AUDIO_FILE})${LOOP ? ' +loop' : ''}` : 'silence'}`);
    console.log('[Mock] Press Ctrl+C to stop\n');

    // Announce mock source to backend (optional, backend may log it)
    ws.send(JSON.stringify({
      type:     'mock_meta',
      source:   AUDIO_FILE ? 'file' : 'silence',
      filename: AUDIO_FILE || null,
      sessionId: SESSION_ID,
    }));

    startSending();
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'transcript_interim':
          process.stdout.write(`\r[transcript interim] ${msg.text.slice(0, 80).padEnd(80)}`);
          break;
        case 'transcript_final':
          const speaker = msg.speaker ? `[spk${msg.speaker.id}]` : '';
          console.log(`\n[transcript FINAL] ${speaker} ${msg.text}`);
          break;
        case 'hint':
          console.log(`\n[HINT] ${msg.hint}`);
          break;
        case 'error':
          console.error('\n[ERROR from backend]', msg.error);
          break;
        default:
          console.log('\n[msg]', msg);
      }
    } catch {
      console.log('[msg binary]', data.length, 'bytes');
    }
  });

  ws.on('error', (err) => {
    console.error('[Mock] WS error:', err.message);
  });

  ws.on('close', (code) => {
    clearInterval(sendTimer);
    sendTimer = null;
    console.log(`\n[Mock] Disconnected (code=${code})`);
    printStats();

    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(500 * Math.pow(2, retryCount), 15000);
      retryCount++;
      console.log(`[Mock] Reconnecting in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})...`);
      setTimeout(connect, delay);
    } else {
      console.log('[Mock] Max retries reached. Exiting.');
      process.exit(0);
    }
  });
}

function startSending() {
  clearInterval(sendTimer);

  sendTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const chunk = nextChunk();
    if (chunk === null) {
      // End of file (no loop)
      console.log('\n[Mock] End of audio file. Stopping...');
      shutdown();
      return;
    }

    ws.send(chunk);
    chunksSent++;
    bytesSent += chunk.length;

    // Progress line every 4 seconds (every 16 chunks at 250ms)
    if (chunksSent % 16 === 0) {
      const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const kb = (bytesSent / 1024).toFixed(0);
      process.stdout.write(`\r[Mock] ${durationSec}s | ${chunksSent} chunks | ${kb} KB sent   `);
    }
  }, CHUNK_MS);
}

function printStats() {
  if (!startedAt) return;
  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[Mock] Stats: ${durationSec}s | ${chunksSent} chunks | ${(bytesSent/1024).toFixed(1)} KB`);
}

function shutdown() {
  clearInterval(sendTimer);
  sendTimer = null;
  printStats();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'stop' }));
    ws.close();
  }
  setTimeout(() => process.exit(0), 500);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[Mock] Ctrl+C — shutting down...');
  shutdown();
});

audioChunks = loadAudioChunks();
connect();
