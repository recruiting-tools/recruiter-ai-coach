#!/usr/bin/env node
/**
 * Diarize Test — sends a WebM/Opus file to backend WS and checks speaker labels.
 *
 * Usage:
 *   node scripts/test-diarize-webm.js [path-to-webm]
 *
 * Default: test-data/diarize-test-2min.webm
 *
 * What it does:
 *   1. Connects to ws://localhost:3001/ws/audio (same as Chrome Extension)
 *   2. Sends the file in 8KB chunks (simulating 250ms MediaRecorder output)
 *   3. Prints every transcript event with speaker info
 *   4. At the end: summary of speaker detection quality
 *
 * Prerequisites:
 *   - Backend running: cd backend && node src/server.js
 *   - DEEPGRAM_API_KEY in .env
 */

const fs = require('fs');
const path = require('path');
// ws lives in backend/node_modules — resolve from there
const WebSocket = require(path.join(__dirname, '../backend/node_modules/ws'));

const FILE = process.argv[2] || path.join(__dirname, '../test-data/diarize-test-2min.webm');
const WS_URL = process.env.WS_URL || 'ws://localhost:3001/ws/audio?sessionId=diarize_test';
const CHUNK_SIZE = 8000;       // ~8KB per chunk (similar to 250ms WebM/Opus)
const CHUNK_INTERVAL_MS = 250; // send one chunk every 250ms (real-time simulation)

if (!fs.existsSync(FILE)) {
  console.error(`File not found: ${FILE}`);
  console.error('Create it with: ffmpeg -i input.mp4 -vn -t 120 -c:a libopus -b:a 48k -f webm test-data/diarize-test-2min.webm');
  process.exit(1);
}

const audioData = fs.readFileSync(FILE);
console.log(`\n📂 File: ${FILE} (${(audioData.length / 1024).toFixed(0)} KB)`);
console.log(`📡 Connecting to ${WS_URL}...\n`);

// Stats
const stats = {
  transcripts: [],
  speakerCounts: {},   // { "recruiter": 5, "candidate": 3, "unknown": 1 }
  withSpeaker: 0,
  withoutSpeaker: 0,
  hints: [],
};

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected — sending audio chunks...\n');

  let offset = 0;
  let chunkNum = 0;

  const interval = setInterval(() => {
    if (offset >= audioData.length) {
      clearInterval(interval);
      console.log('\n📤 All chunks sent. Waiting 5s for final results...\n');
      // Send stop and wait for remaining transcripts
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'stop' }));
        setTimeout(() => {
          printSummary();
          ws.close();
        }, 3000);
      }, 5000);
      return;
    }

    const chunk = audioData.slice(offset, offset + CHUNK_SIZE);
    ws.send(chunk);
    offset += CHUNK_SIZE;
    chunkNum++;

    if (chunkNum <= 3 || chunkNum % 20 === 0) {
      const progress = ((offset / audioData.length) * 100).toFixed(0);
      process.stdout.write(`  Chunk #${chunkNum} (${progress}%)\r`);
    }
  }, CHUNK_INTERVAL_MS);
});

ws.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'transcript_final') {
      const spk = msg.speaker;
      const role = spk?.role || 'unknown';
      const conf = spk?.confidence ? ` (conf=${spk.confidence})` : '';

      console.log(`  📝 [${role.toUpperCase()}]${conf}: "${msg.text}"`);

      stats.transcripts.push({ text: msg.text, role, confidence: spk?.confidence });
      stats.speakerCounts[role] = (stats.speakerCounts[role] || 0) + 1;

      if (spk && spk.role !== 'unknown') {
        stats.withSpeaker++;
      } else {
        stats.withoutSpeaker++;
      }
    }

    if (msg.type === 'transcript_interim') {
      // Just count, don't print (too noisy)
    }

    if (msg.type === 'hint') {
      console.log(`  💡 HINT: ${msg.hint}`);
      stats.hints.push(msg.hint);
    }

    if (msg.type === 'error') {
      console.error(`  ❌ ERROR: ${msg.error}`);
    }

    if (msg.type === 'deepgram_closed') {
      console.warn('  ⚠️  Deepgram connection closed (will reconnect)');
    }
  } catch {}
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  console.error('Is backend running? cd backend && node src/server.js');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket closed.');
  process.exit(0);
});

function printSummary() {
  console.log('═══════════════════════════════════════════');
  console.log('  DIARIZE TEST SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`  Total final transcripts: ${stats.transcripts.length}`);
  console.log(`  With speaker role:       ${stats.withSpeaker}`);
  console.log(`  Without speaker (null):  ${stats.withoutSpeaker}`);
  console.log(`  Speaker breakdown:       ${JSON.stringify(stats.speakerCounts)}`);
  console.log(`  Hints generated:         ${stats.hints.length}`);

  if (stats.transcripts.length === 0) {
    console.log('\n  ⚠️  No transcripts received!');
    console.log('     - Check DEEPGRAM_API_KEY in .env');
    console.log('     - Check backend logs for errors');
  } else if (stats.withoutSpeaker > stats.withSpeaker) {
    console.log('\n  ⚠️  Most segments have no speaker — diarize may not work with WebM/Opus streaming');
    console.log('     Fallback: convert to PCM before sending, or use Deepgram REST API for diarize');
  } else {
    const pct = ((stats.withSpeaker / stats.transcripts.length) * 100).toFixed(0);
    console.log(`\n  ✅ Diarize working! ${pct}% of segments have speaker labels`);

    // Check if both speakers detected
    const roles = Object.keys(stats.speakerCounts).filter(r => r !== 'unknown');
    if (roles.length >= 2) {
      console.log(`  ✅ Multiple speakers detected: ${roles.join(', ')}`);
    } else if (roles.length === 1) {
      console.log(`  ⚠️  Only one speaker detected: ${roles[0]} — may need longer audio or clearer turn-taking`);
    }
  }

  // Confidence stats
  const confs = stats.transcripts.filter(t => t.confidence != null).map(t => t.confidence);
  if (confs.length > 0) {
    const avg = (confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(2);
    const min = Math.min(...confs).toFixed(2);
    console.log(`  Speaker confidence: avg=${avg}, min=${min}`);
  }

  console.log('═══════════════════════════════════════════\n');
}
