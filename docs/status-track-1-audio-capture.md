# Track 1: Audio Capture — Статус

**Трек:** Chrome Extension tabCapture, Deepgram streaming, speaker separation, Vosk
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `chrome-extension/background.js` — tabCapture API, захват аудио вкладки Meet
- [x] `chrome-extension/offscreen.js` — State machine (IDLE→STARTING→CAPTURING→STOPPING→ERROR), exponential WS backoff, silence detection, stats каждые 5s
- [x] `chrome-extension/background.js` — Tab close/navigate detection, health ping каждые 10s, auto-stop при закрытии Meet вкладки
- [x] `chrome-extension/audio-capture-contract.js` — типизированный контракт данных (states, events, thresholds, mock protocol)
- [x] `chrome-extension/popup.js` — обработка capture_state events + backward compat с legacy status events
- [x] `scripts/mock-tab-audio.js` — мок для тестирования Track 2 без Chrome (file/silence/loop режимы)
- [x] `backend/src/deepgram-stream.js` — Deepgram nova-2, streaming транскрипция через WebSocket
- [x] Базовое подключение работает: audio chunk → Deepgram → transcript
- [x] **Diarize**: `diarize: 'true'` в Deepgram params, `_extractSpeaker()` в deepgram-stream.js, `speaker: { id, confidence }` в TranscriptEvent
- [x] **Speaker label в TranscriptEvent**: server.js прокидывает `speaker` в `transcript_final`/`transcript_interim` сообщения extension
- [x] **GainNode fix**: offscreen.js создаёт `MediaStreamDestination` — MediaRecorder записывает усиленный (x2) поток, НЕ подключён к destination (нет эха)
- [x] **Speaker mapping**: в server.js — первый детектированный спикер = recruiter, остальные = candidate. `speaker: { id, role: "recruiter"|"candidate", confidence }`
- [x] **`generateHintFromActiveInterview`**: server.js WebSocket audio handler и `/api/browser-segment` используют goals-aware функцию
- [x] **Port fix**: все компоненты переведены на порт 3000 (было 3001)

---

## В процессе / Следующее

- [x] **Diarize + WebM/Opus — VERIFIED** (2026-03-23): работает через streaming. 15 сегментов, 100% с speaker labels, recruiter/candidate корректно разделены. Ключевой фикс: `language=multi` вместо `language=ru` — иначе non-RU аудио не транскрибируется. Тест: `node scripts/test-diarize-webm.js`
- [ ] **Vosk keyword spotter**: параллельный канал, PCM 16kHz → офлайн детект ключевых слов из CV/JD

---

## Варианты speaker separation (в порядке приоритета)

1. **Deepgram diarize=true** — простейший, уже в облаке, никаких изменений в extension
2. **Mic рекрутера отдельно** — `getUserMedia({audio:true})` + tabCapture → два потока → mic=recruiter, tab=candidate (точнее)
3. **Deepgram multichannel** — два канала в один stream с `channels=2&multichannel=true`

**Решение**: начать с (1), если качество устроит — оставить. Иначе делать (2).

---

## Открытые вопросы

- Воск: нужна ли русская модель (vosk-model-ru) или small-en достаточно?
- Нужен ли Audio Worklet для real-time PCM или ffmpeg pipe достаточно?
- **Diarize + WebM/Opus**: Deepgram поддерживает diarize со streaming WebM/Opus — параметр принимается без ошибок. Однако diarize на streaming может давать `speaker: null` для interim results и заполнять спикера только на final/speech_final сегментах. Рекомендация: читать `speaker` только из `isFinal=true` событий (что уже сделано в server.js через `lastSpeaker`). Полная верификация — при первом реальном звонке.

---

## Зависимости

- Track 2 получает AudioFrame с `speaker` полем от этого трека
- Track 3 (Extension) показывает audio level bar — `audioLevel` из AudioFrame

---

## Заметки для других агентов

- Аудио идёт через WebSocket: `ws://localhost:3000/ws/audio`
- Формат: WebM/Opus chunks ~250ms
- Deepgram API key: в `.env` как `DEEPGRAM_API_KEY`
- Мок аудио для тестов: `node scripts/mock-tab-audio.js` (silence/file/loop)
- **ws/events endpoint**: создан в server.js — `ws://localhost:3000/ws/events` broadcastит transcript/hint всем подключённым клиентам
- **Порт**: 3000 (не 3001!), настроен через `PORT` env var
