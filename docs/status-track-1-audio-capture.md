# Track 1: Audio Capture — Статус

**Трек:** Chrome Extension tabCapture, Deepgram streaming, speaker separation, Vosk
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `chrome-extension/background.js` — tabCapture API, захват аудио вкладки Meet
- [x] `chrome-extension/offscreen.js` — MediaRecorder → WebSocket → backend (ws://localhost:3001/ws/audio)
- [x] `chrome-extension/audio-capture-contract.js` — типизированный контракт данных
- [x] `backend/src/deepgram-stream.js` — Deepgram nova-2, streaming транскрипция через WebSocket
- [x] Базовое подключение работает: audio chunk → Deepgram → transcript
- [x] `debug-audio.webm` тестировался (файл удалён, был debug артефакт)
- [x] **Diarize**: `diarize: 'true'` в Deepgram params, `_extractSpeaker()` в deepgram-stream.js, `speaker: { id, confidence }` в TranscriptEvent
- [x] **Speaker label в TranscriptEvent**: server.js прокидывает `speaker` в `transcript_final`/`transcript_interim` сообщения extension
- [x] **GainNode fix**: offscreen.js теперь создаёт `MediaStreamDestination` и подключает gainNode к нему — MediaRecorder записывает усиленный (x2) поток, а не сырой
- [x] **Speaker mapping**: в server.js — первый детектированный спикер = recruiter, остальные = candidate. TranscriptEvent теперь содержит `speaker: { id, role: "recruiter"|"candidate", confidence }`
- [x] **`generateHintFromActiveInterview`**: server.js WebSocket audio handler и `/api/browser-segment` теперь используют goals-aware функцию — hints учитывают активное интервью, goals[], keywords[]

---

## В процессе / Следующее

- [ ] **Diarize + WebM/Opus**: проверить на реальном звонке — данные по совместимости в Открытых вопросах
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

- Аудио идёт через WebSocket: `ws://localhost:3001/ws/audio`
- Формат: WebM/Opus chunks ~250ms
- Deepgram API key: в `.env` как `DEEPGRAM_API_KEY`
- Мок аудио для тестов: `scripts/mock-tab-audio.js`
