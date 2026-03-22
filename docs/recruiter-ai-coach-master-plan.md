# Recruiter AI Coach — Master Plan

## Цель продукта

Real-time AI-ассистент для рекрутеров во время Google Meet звонков.
Chrome Extension слушает звонок → транскрибирует → анализирует цели → выдаёт подсказки прямо в оверлее поверх Meet.

**Ключевые принципы:**
- Latency < 2 сек от слова до подсказки
- Работает без сторонних сервисов типа Fireflies (всё через Chrome Extension + local backend)
- Offline-first: SQLite, no cloud dependencies для core flow
- Параллельная разработка: 5 независимых треков

---

## Архитектура (текущая, рабочая)

```
Chrome Extension
  └── background.js        → tabCapture API → захват аудио вкладки Meet
  └── offscreen.js         → MediaRecorder → WebSocket → backend (GainNode x2)
  └── content.js           → overlay UI поверх Meet (транскрипт, sticky hints, keywords, goals)
  └── popup.js             → статус, attach interview, ссылка на dashboard

      │ WebSocket ws://localhost:3000/ws/audio   (offscreen.js → Deepgram)
      │ WebSocket ws://localhost:3000/ws/events  (content.js ← hints/goals) [НЕ РЕАЛИЗОВАН]
      │ REST API http://localhost:3000/api/*

Node.js Backend (Express + WS + Socket.IO)
  └── server.js            → роутер, WS handler, Socket.IO
  └── deepgram-stream.js   → Deepgram nova-2, потоковая транскрипция + diarize
  └── claude.js            → GPT-4o (подсказки, prep kit, keyword explain) + auto-load active interview
  └── interview-goals-engine.js → rule-based оценка целей (7 evaluators + time_management alias)
  └── interview-config-db.js    → SQLite: interviews, candidates, jobs, sessions + 5 presets
  └── routes/interview-config-routes.js → REST CRUD + presets API
  └── telegram.js          → Telegram бот (доставка подсказок)

Web Dashboard (Vite + React 19)
  └── dashboard/src/pages/LivePage.jsx → mobile live view (polling /api/sessions/current/live)
```

---

## Data Contracts (shared между треками)

### InterviewConfig
```json
{
  "id": "uuid",
  "candidate": { "name": "string", "cv_text": "string", "cv_summary": "string?" },
  "job": { "title": "string", "jd_text": "string", "jd_summary": "string?" },
  "meet_url": "string?",
  "goals": "Goal[]",
  "keywords": "string[]",
  "language": "ru|en|ar"
}
```

### TranscriptEvent (backend → extension)
```json
{ "type": "transcript_final", "text": "...", "speaker": { "id": "recruiter|candidate" } }
{ "type": "hint", "hint": "...", "hint_type": "llm|goal_check|time_warning" }
{ "type": "keyword_detected", "keyword": "...", "confidence": 0.95 }
{ "type": "goal_update", "goalId": "...", "addressed": true }
{ "type": "audio_level", "level": 42 }
```

---

## 5 Треков разработки

| Трек | Что | Статус-файл |
|------|-----|------------|
| **Track 0** | Interview Setup: CV/JD/goals/keywords, SQLite, REST API | [status-track-0-interview-setup.md](status-track-0-interview-setup.md) |
| **Track 1** | Audio: tabCapture, Deepgram, speaker separation, Vosk | [status-track-1-audio-capture.md](status-track-1-audio-capture.md) |
| **Track 2** | Intelligence: GPT-4o hints, goals engine, keywords | [status-track-2-intelligence-hints.md](status-track-2-intelligence-hints.md) |
| **Track 3** | Chrome Extension UI: overlay, popup, goals checklist | [status-track-3-chrome-extension-ui.md](status-track-3-chrome-extension-ui.md) |
| **Track 4** | Web Dashboard: React SPA, interview wizard, mobile live | [status-track-4-web-dashboard.md](status-track-4-web-dashboard.md) |

---

## Goals System (ключевая фича)

Рекрутер выбирает **методологию или пресет** перед звонком, или собирает цели вручную.

### Пресеты
| Пресет | Цели |
|--------|------|
| **Screening** | Hard skills (surface) + Red flags + Time control (30 min) |
| **Deep Technical** | Hard skills (deep) + Problem solving + Verify resume |
| **Culture Fit** | Soft skills + Cultural fit + Motivation |
| **Leadership** | Leadership + Soft skills + Behavioral |
| **Full** | Всё включено |

### Отдельные цели (можно включать/выключать в процессе)
- `assess_hard_skills_deep` / `assess_hard_skills_screening`
- `assess_soft_skills` (STAR / behavioral)
- `assess_cultural_fit`
- `assess_motivation`
- `assess_leadership`
- `verify_resume`
- `detect_red_flags` (overemployment, contradictions, job-hopping)
- `competitor_research` — мгновенный триггер при упоминании конкурентов
- `time_saving` — таймер + предупреждения "осталось 10 мин"
- `show_competence` — фразочки показывающие что рекрутер шарит
- `checklist` — произвольные пункты

### UX целей в overlay
- Активные подсказки **прилипают к верху** overlay
- Выполненные / устаревшие цели **отлипают** вниз или скрываются
- Рекрутер может включить/выключить любую цель в реальном времени кликом
- Контроль интервью: "договориться что перебивать — это норм" → универсальные фразы в начале

---

## Два потока аудио (целевая архитектура)

| Поток | Источник | Задача | Latency |
|-------|----------|--------|---------|
| **Транскрипция** | Deepgram nova-2 | Полный текст → контекст для LLM | 300-500ms |
| **Ключевики** | Vosk (офлайн) | Мгновенный детект слов из CV/JD | <100ms |

```
audio chunk (250ms WebM/Opus)
  ├── → Deepgram → transcript → GPT-4o hint
  └── → ffmpeg → PCM 16kHz → Vosk → keyword hit
```

---

## Критические баги и блокеры (2026-03-22)

### 1. Port mismatch — content.js ходит на несуществующий порт
- `server.js` слушает на `:3000` (или `$PORT`)
- `content.js` подключается к `ws://localhost:3001/ws/events` — **порт 3001 неправильный**
- Нужно: исправить на `:3000` в content.js

### 2. `ws/events` endpoint не существует
- `content.js` подключается к `ws://localhost:3000/ws/events` — но такого endpoint нет в `server.js`
- Есть только `/ws/audio` (для аудио стрима от offscreen.js)
- **Нужно**: добавить `/ws/events` endpoint в server.js для push-канала TranscriptEvent → content.js
- Или: content.js может получать hints/keywords через background.js message passing (уже работает для audio flow)

### 3. 15 goal types из пресетов без evaluator-а
Пресеты (screening, deep_technical, etc.) используют эти goal types, но в `EVALUATORS` их нет:
- `proper_opening`, `proper_closing` — структурные фразы начала/конца
- `assess_hard_skills_screening`, `assess_hard_skills_deep` — отличаются от `hard_skills`
- `assess_motivation`, `assess_problem_solving`, `assess_leadership`, `assess_communication`
- `assess_cultural_fit`, `assess_soft_skills` — отличается от `soft_skills`
- `verify_resume`, `detect_red_flags`, `collect_logistics`
- `competitor_intel` — отличается от `competitor_research`
- `sell_the_role`, `pacing_control`, `capture_scorecard`
- `build_rapport`, `understand_current_situation`, `candidate_experience`, `bias_mitigation`

**Решение**: добавить evaluators или маппить через alias (как `time_management → evaluateTimeSaving`)

---

## Что работает end-to-end сейчас

- [x] Seed данных + создание интервью через API
- [x] Пресеты: применить screening/deep_technical/etc. к интервью
- [x] Активация интервью → `GET /api/interviews/active`
- [x] tabCapture → Deepgram → транскрипция с speaker mapping (recruiter/candidate)
- [x] Goals engine: time_warning, hard_skills, soft_skills, competitor_research, overemployment, show_competence, checklist
- [x] LLM hints: goals-aware + keywords-aware system prompt
- [x] Overlay: sticky hints, транскрипт, keywords
- [x] Dashboard LivePage: polling последних hints/segments
- [x] Rate limiting: 20 сек throttle на LLM подсказки

## Что НЕ работает (нужно чинить до демо)

- [ ] **content.js → ws/events**: endpoint не существует, порт неправильный
- [ ] **Popup "Attach Interview"**: нет UI для выбора интервью перед звонком
- [ ] **Dashboard Interview List/Wizard**: только LivePage сделана, создание интервью — только через curl
- [ ] **15 goal types без evaluator**: пресеты применяются но не оцениваются

---

## Что ещё нужно (открытые вопросы)

- [ ] Воск keyword spotter: нужна ли немецкая/английская модель или только ru?
- [ ] recruiter-assistant.com интеграция — отложено до стабилизации core
- [ ] Деплой backend: Railway / Cloud Run / localtunnel для dev

---

## Важные файлы

| Файл | Назначение |
|------|-----------|
| `docs/recruiter-ai-coach-product-architecture.md` | Детальная архитектура, data model, API endpoints |
| `docs/recruiter-ai-coach-parallel-build-plan.md` | Data contracts, детали по трекам и итерациям |
| `docs/interview-goals-comprehensive-catalog.md` | Полный каталог целей интервью |
| `docs/VOSK-KEYWORD-SPOTTER-TZ.md` | ТЗ на Vosk keyword spotter |
| `docs/speaker-separation-research.md` | Исследование разделения спикеров |
| `chrome-extension/audio-capture-contract.js` | Contract: что extension отправляет на backend |
