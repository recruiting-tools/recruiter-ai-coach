require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');

const fireflies = require('./fireflies');
const claude = require('./claude');
const { initBot } = require('./telegram');
const DeepgramStream = require('./deepgram-stream');
const interviewConfigRoutes = require('./routes/interview-config-routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Interview config routes (candidates, jobs, interviews CRUD)
app.use('/api', interviewConfigRoutes);

// Session manager
const sessions = new Map(); // sessionId → { transcriptId, realtimeConnection, clients: Set }

function addSession(sessionId, meta) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { ...meta, clients: new Set() });
  }
}

// ──────────────────────────────────────────────────
// REST API
// ──────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', sessions: sessions.size }));

// Список активных митингов из Fireflies
app.get('/api/meetings/active', async (req, res) => {
  try {
    const meetings = await fireflies.getActiveMeetings();
    res.json({ meetings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Последние транскрипты
app.get('/api/meetings/recent', async (req, res) => {
  try {
    const transcripts = await fireflies.getRecentTranscripts(10);
    res.json({ transcripts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Начать сессию мониторинга
app.post('/api/session/start', async (req, res) => {
  const { transcriptId, prepContext } = req.body;
  if (!transcriptId) {
    return res.status(400).json({ error: 'transcriptId required' });
  }

  const sessionId = `session_${transcriptId}`;

  // Если сессия уже есть — переподключаемся
  if (sessions.has(sessionId)) {
    return res.json({ sessionId, status: 'already_active' });
  }

  if (prepContext) {
    claude.setPrepContext(sessionId, prepContext);
  }

  const connection = fireflies.connectRealtime(
    transcriptId,
    async (segment) => {
      claude.addToContext(sessionId, segment);

      // Отправляем сегмент всем WebSocket клиентам этой сессии
      io.to(sessionId).emit('transcription', segment);

      // Буферизуем сегмент для polling (Chrome Extension)
      const sess = sessions.get(sessionId);
      if (sess) {
        sess.segmentsBuffer.push({ ...segment, timestamp: new Date().toISOString() });
        if (sess.segmentsBuffer.length > 50) sess.segmentsBuffer.shift();
      }

      // Генерируем подсказку
      const hint = await claude.generateHint(sessionId, segment);
      if (hint) {
        const hintObj = { hint, timestamp: new Date().toISOString() };
        console.log(`[Session ${sessionId}] Hint: ${hint}`);
        io.to(sessionId).emit('hint', hintObj);
        // Буферизуем для polling
        if (sess) {
          sess.hintsBuffer.push(hintObj);
          if (sess.hintsBuffer.length > 20) sess.hintsBuffer.shift();
        }
      }
    },
    (status) => {
      io.to(sessionId).emit('status', { status });
    }
  );

  sessions.set(sessionId, {
    transcriptId,
    realtimeConnection: connection,
    clients: new Set(),
    hintsBuffer: [],   // для polling от Chrome Extension
    segmentsBuffer: [],
  });
  addSession(sessionId, { transcriptId });

  res.json({ sessionId, status: 'started' });
});

// Остановить сессию
app.post('/api/session/stop', (req, res) => {
  const { sessionId } = req.body;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  session.realtimeConnection?.disconnect();
  claude.clearSession(sessionId);
  sessions.delete(sessionId);
  res.json({ status: 'stopped' });
});

// Браузерный сегмент речи (из Chrome Extension Web Speech API)
app.post('/api/browser-segment', async (req, res) => {
  const { sessionId, text, speaker } = req.body;
  if (!text) return res.json({ hint: null });

  const segment = { chunkId: `browser_${Date.now()}`, text, speaker: speaker || 'Speaker', timestamp: new Date().toISOString() };
  claude.addToContext(sessionId, segment);

  const hint = await claude.generateHintFromActiveInterview(sessionId, segment);

  // Отправить в Telegram тоже
  if (hint) {
    const { sendHint } = require('./telegram');
    sendHint(process.env.TELEGRAM_CHAT_ID, hint).catch(() => {});
  }

  res.json({ hint });
});

// Отправить подсказку напрямую в Telegram (из content script)
app.post('/api/hint-to-telegram', async (req, res) => {
  const { hint } = req.body;
  if (hint) {
    const { sendHint } = require('./telegram');
    await sendHint(process.env.TELEGRAM_CHAT_ID, hint).catch(() => {});
  }
  res.json({ ok: true });
});

// Pre-interview подготовка
app.post('/api/prepare', async (req, res) => {
  const { candidateCV, jobDescription, role } = req.body;
  if (!candidateCV || !jobDescription || !role) {
    return res.status(400).json({ error: 'candidateCV, jobDescription, role required' });
  }

  try {
    const prepKit = await claude.generatePrepKit(candidateCV, jobDescription, role);
    res.json({ prepKit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live view для Web Dashboard — последние 3 подсказки + 5 сегментов транскрипта
app.get('/api/sessions/current/live', (req, res) => {
  if (sessions.size === 0) {
    return res.status(404).json({ error: 'No active session' });
  }
  // Берём последнюю добавленную сессию
  let session;
  for (const s of sessions.values()) session = s;

  res.json({
    hints: (session.hintsBuffer || []).slice(-3),
    segments: (session.segmentsBuffer || []).slice(-5),
    sessionId: session.transcriptId || null,
  });
});

// Polling endpoint для Chrome Extension (hints + segments since timestamp)
app.get('/api/session/:sessionId/hints', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const since = req.query.since || null;
  const hints = since
    ? session.hintsBuffer.filter((h) => h.timestamp > since)
    : session.hintsBuffer.slice(-5);
  const segments = since
    ? session.segmentsBuffer.filter((s) => s.timestamp > since)
    : session.segmentsBuffer.slice(-10);

  res.json({ hints, segments });
});

// Тест-симуляция: прогоняем диалог через Claude и отправляем подсказки в Telegram
app.post('/api/test/simulate', async (req, res) => {
  const sessionId = 'test_session';
  claude.clearSession(sessionId);

  const { sendHint } = require('./telegram');
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  await sendHint(CHAT_ID, '🎬 *Симуляция интервью запущена!*\nСейчас пойдут реплики кандидата...');

  const dialogue = [
    { speaker: 'Recruiter', text: 'Расскажи про свой опыт с фронтенд-фреймворками' },
    { speaker: 'Candidate', text: 'Ну я работал с реактом, вюшкой, в общем со всем понемножку' },
    { speaker: 'Recruiter', text: 'Понятно. А какой стейт-менеджмент использовал?' },
    { speaker: 'Candidate', text: 'Редакс в основном, ну там всякое разное' },
    { speaker: 'Recruiter', text: 'Хорошо. Расскажи про последний проект' },
    { speaker: 'Candidate', text: 'Делал интернет-магазин, там были компоненты, апи, база данных, в общем всё стандартное' },
    { speaker: 'Recruiter', text: 'А как у тебя с TypeScript?' },
    { speaker: 'Candidate', text: 'Да, использовал TypeScript, знаю его хорошо, типы там и всё такое' },
    { speaker: 'Recruiter', text: 'Как вы деплоили проект?' },
    { speaker: 'Candidate', text: 'Через докер, CI/CD было настроено, в облако деплоили' },
  ];

  res.json({ status: 'started', segments: dialogue.length });

  // Прогоняем диалог с задержками
  for (const seg of dialogue) {
    await new Promise((r) => setTimeout(r, 1500));
    await sendHint(CHAT_ID, `💬 *${seg.speaker}:* ${seg.text}`);
    claude.addToContext(sessionId, seg);

    // Сбрасываем throttle для теста (каждые 3 реплики)
    const ctx = claude.getContext ? claude.getContext(sessionId) : null;

    const hint = await claude.generateHint(sessionId, seg, { noThrottle: true });
    if (hint) {
      await new Promise((r) => setTimeout(r, 500));
      await sendHint(CHAT_ID, hint);
    }
  }

  await sendHint(CHAT_ID, '✅ *Симуляция завершена!*');
});

// Получить транскрипт из Fireflies
app.get('/api/transcript/:id', async (req, res) => {
  try {
    const transcript = await fireflies.getTranscript(req.params.id);
    res.json({ transcript });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────
// WebSocket (для Chrome Extension)
// ──────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[WS] Client connected:', socket.id);

  // Клиент подписывается на сессию
  socket.on('join_session', ({ sessionId }) => {
    socket.join(sessionId);
    console.log(`[WS] Client ${socket.id} joined session ${sessionId}`);

    const session = sessions.get(sessionId);
    if (session) {
      socket.emit('status', { status: 'joined' });
    } else {
      socket.emit('status', { status: 'session_not_found' });
    }
  });

  socket.on('disconnect', () => {
    console.log('[WS] Client disconnected:', socket.id);
  });
});

// ──────────────────────────────────────────────────
// WebSocket Audio Streaming (Chrome Extension → Deepgram)
// ──────────────────────────────────────────────────

const wss = new WebSocket.Server({ noServer: true });
const wssEvents = new WebSocket.Server({ noServer: true });

// Broadcast to all connected ws/events clients
function broadcastEvent(event) {
  const msg = JSON.stringify(event);
  for (const client of wssEvents.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wssEvents.on('connection', (ws) => {
  console.log(`[Events WS] Client connected (${wssEvents.clients.size} total)`);
  ws.on('close', () => {
    console.log(`[Events WS] Client disconnected (${wssEvents.clients.size} total)`);
  });
});

// MUST use prependListener — Socket.IO's Engine.IO destroys sockets for non-matching paths.
// Without prepend, Engine.IO's handler fires first and kills /ws/audio connections.
server.prependListener('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws/audio')) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else if (req.url.startsWith('/ws/events')) {
    wssEvents.handleUpgrade(req, socket, head, (ws) => {
      wssEvents.emit('connection', ws, req);
    });
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId') || `audio_${Date.now()}`;

  console.log(`\n[Audio WS] Client connected, session: ${sessionId}`);

  if (!process.env.DEEPGRAM_API_KEY) {
    ws.send(JSON.stringify({ type: 'error', error: 'DEEPGRAM_API_KEY not configured' }));
    ws.close();
    return;
  }

  // Create Deepgram streaming connection
  const dg = new DeepgramStream(process.env.DEEPGRAM_API_KEY);

  let finalBuffer = '';
  let segmentCount = 0;

  let lastSpeaker = null;    // latest diarization result
  let firstSpeakerId = null; // first detected speaker → recruiter

  // Map Deepgram speaker id → role. First detected speaker = recruiter.
  function resolveRole(spk) {
    if (!spk) return 'unknown';
    if (firstSpeakerId === null) firstSpeakerId = spk.id;
    return spk.id === firstSpeakerId ? 'recruiter' : 'candidate';
  }

  dg.onTranscript = async ({ transcript, isFinal, speechFinal, speaker }) => {
    if (speaker) lastSpeaker = speaker;

    // Send transcript to Chrome Extension (with speaker info)
    ws.send(JSON.stringify({
      type: isFinal ? 'transcript_final' : 'transcript_interim',
      text: transcript,
      speaker: speaker ? { id: speaker.id, role: resolveRole(speaker), confidence: speaker.confidence } : null,
      isFinal,
      speechFinal,
    }));

    if (isFinal && transcript.trim()) {
      finalBuffer += transcript + ' ';
    }

    // On speech boundary — process buffered text for hints
    if (speechFinal && finalBuffer.trim()) {
      const text = finalBuffer.trim();
      finalBuffer = '';
      segmentCount++;

      const role = resolveRole(lastSpeaker);
      const segment = {
        chunkId: `dg_${Date.now()}`,
        text,
        speaker: role,
        speakerInfo: lastSpeaker || null,
        timestamp: new Date().toISOString(),
      };

      lastSpeaker = null; // reset after consuming

      console.log(`[Audio WS] Segment #${segmentCount} [${role}]: "${text.slice(0, 80)}"`);

      claude.addToContext(sessionId, segment);

      // Broadcast transcript to ws/events + Socket.IO
      broadcastEvent({ type: 'transcript_final', text, speaker: { id: role, role }, timestamp: segment.timestamp });
      io.to(sessionId).emit('transcription', segment);

      const hint = await claude.generateHintFromActiveInterview(sessionId, segment);
      if (hint) {
        console.log(`[Audio WS] Hint: ${hint.slice(0, 80)}`);
        ws.send(JSON.stringify({ type: 'hint', hint }));
        broadcastEvent({ type: 'hint', hint, hint_type: 'llm', timestamp: new Date().toISOString() });
        io.to(sessionId).emit('hint', { hint, timestamp: new Date().toISOString() });

        // Send to Telegram
        const { sendHint } = require('./telegram');
        sendHint(process.env.TELEGRAM_CHAT_ID, hint).catch(() => {});
      }
    }
  };

  dg.onUtteranceEnd = () => {
    // Flush any remaining buffered text
    if (finalBuffer.trim()) {
      const text = finalBuffer.trim();
      finalBuffer = '';

      const segment = {
        chunkId: `dg_utt_${Date.now()}`,
        text,
        speaker: 'Auto',
        timestamp: new Date().toISOString(),
      };

      claude.addToContext(sessionId, segment);
      console.log(`[Audio WS] Utterance end flush: "${text.slice(0, 80)}"`);
    }
  };

  dg.onError = (err) => {
    ws.send(JSON.stringify({ type: 'error', error: `Deepgram: ${err.message}` }));
  };

  dg.onClose = (code) => {
    console.log(`[Audio WS] Deepgram closed (${code}), reconnecting...`);
    ws.send(JSON.stringify({ type: 'deepgram_closed' }));
    // Auto-reconnect Deepgram if client is still connected
    if (ws.readyState === 1) {
      setTimeout(() => {
        console.log('[Audio WS] Reconnecting Deepgram...');
        dg.connect();
      }, 1000);
    }
  };

  dg.connect();

  // Receive audio chunks from Chrome Extension
  let audioChunkCount = 0;
  const debugChunks = []; // save first chunks for debugging
  ws.on('message', (data, isBinary) => {
    if (isBinary || Buffer.isBuffer(data)) {
      audioChunkCount++;
      if (audioChunkCount <= 5 || audioChunkCount % 40 === 0) {
        console.log(`[Audio WS] Chunk #${audioChunkCount}, ${data.length} bytes, dg.ready=${dg.ready}`);
      }
      // Save first 40 chunks (~10 sec) to file for debugging
      if (audioChunkCount <= 40) {
        debugChunks.push(Buffer.from(data));
        if (audioChunkCount === 40) {
          const fs = require('fs');
          const path = require('path').join(__dirname, '../../debug-audio.webm');
          fs.writeFileSync(path, Buffer.concat(debugChunks));
          console.log(`[Debug] Saved 40 chunks to ${path}`);
        }
      }
      dg.sendAudio(data);
    } else {
      // Text = JSON control message
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'stop') {
          dg.close();
        }
      } catch {}
    }
  });

  ws.on('close', () => {
    console.log(`[Audio WS] Client disconnected, session: ${sessionId}`);
    dg.close();
    claude.clearSession(sessionId);
  });
});

// ──────────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`\n🚀 Recruiter AI Coach backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Active meetings: http://localhost:${PORT}/api/meetings/active`);
  console.log('');

  // Инициализируем Telegram бота
  initBot({ addSession });
});
