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

---

## В процессе / Следующее

- [ ] **Speaker separation — вариант 1 (простой)**: добавить `diarize=true` в Deepgram params → получить speaker_0/speaker_1 labels бесплатно
- [ ] **Audio gain**: добавить GainNode в offscreen.js — тихий звук от Meet усиливать
- [ ] Добавить `speaker` поле в TranscriptEvent из Deepgram diarization output
- [ ] Проверить: работает ли `diarize=true` с webm/opus потоком (иногда требует pcm/wav)

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
- Есть ли проблема с `diarize=true` при streaming webm/opus через Deepgram?

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
