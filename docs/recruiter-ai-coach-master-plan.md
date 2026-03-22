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

### UX Flow: от пресета к подсказкам

```
Шаг 1: Выбор пресета и/или методологии
┌─────────────────────────────────────────────────────┐
│  Пресет (ЧТО оценивать)    Методология (КАК)       │
│  ○ Screening (30 мин)      ○ STAR                   │
│  ● Deep Technical (60 мин) ● Behavioral             │
│  ○ Culture Fit (45 мин)    ○ Situational             │
│  ○ Leadership (60 мин)     ○ Topgrading              │
│  ○ Full (90 мин)           ○ Competency-Based        │
│  ○ Custom (собрать вручную)○ Case Interview           │
└─────────────────────────────────────────────────────┘
        ↓
Шаг 2: Кастомизация целей
┌─────────────────────────────────────────────────────┐
│  ☑ assess_hard_skills_deep     ← из пресета         │
│  ☑ assess_problem_solving      ← из пресета         │
│  ☑ verify_resume               ← из пресета         │
│  ☐ detect_red_flags            ← отжал галку        │
│  ☑ competitor_intel            ← добавил сам        │
│  ☑ time_management (60 мин)    ← из пресета         │
│  ┌──────────────────────────────────────┐            │
│  │ + Добавить цель текстом...          │            │
│  │   "Спросить про опыт с Kafka"       │            │
│  └──────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
        ↓
Шаг 3: Во время звонка → подсказки с учётом целей + методологии
```

**Пресет** определяет КАКИЕ цели включены (что оценивать).
**Методология** определяет КАК коучить рекрутера (формат вопросов, подсказок).
Можно выбрать оба, один, или собрать цели вручную.

### Пресеты (что оценивать)

| Пресет | Цели | Время |
|--------|------|-------|
| **Screening** | Hard skills (surface) + Motivation + Red flags + Logistics + Sell role | 30 мин |
| **Deep Technical** | Hard skills (deep) + Problem solving + Verify resume + Scorecard | 60 мин |
| **Culture Fit** | Soft skills (STAR) + Cultural fit + Motivation + Rapport + Bias check | 45 мин |
| **Leadership** | Leadership + Soft skills (behavioral) + Problem solving + Scorecard | 60 мин |
| **Full** | Все 21 цель | 90 мин |

### Методологии (как коучить)

| Методология | Суть | Как влияет на подсказки |
|-------------|------|------------------------|
| **STAR** | Situation → Task → Action → Result | Подсказки: "Попроси конкретный пример", "Какой был результат?" |
| **Behavioral** | Прошлый опыт предсказывает будущее | Подсказки: "Расскажите о ситуации когда...", "Дайте пример..." |
| **Situational** | Гипотетические сценарии | Подсказки: "Что бы вы сделали если...", "Как бы вы поступили..." |
| **Topgrading** | Хронологический разбор каждой позиции | Подсказки: "Что вас наняли делать?", "Что скажет ваш руководитель?" |
| **Competency-Based** | Вопросы по компетенциям с рубрикой | Подсказки: оценочные якоря после каждого ответа |
| **Case Interview** | Бизнес/технический кейс | Подсказки: "Задал ли уточняющие вопросы?", "Рассмотрел альтернативы?" |

Полный каталог целей и методологий: [`docs/interview-goals-comprehensive-catalog.md`](interview-goals-comprehensive-catalog.md)

### Цели (можно включать/выключать в процессе)

**Assessment (что оценивать):**
- `assess_hard_skills_deep` / `assess_hard_skills_screening`
- `assess_soft_skills` (STAR / behavioral / situational)
- `assess_cultural_fit`
- `assess_motivation`
- `assess_leadership`
- `assess_problem_solving`
- `assess_communication`
- `verify_resume`
- `detect_red_flags` (overemployment, contradictions, job-hopping)

**Process (как вести):**
- `time_management` — таймер + предупреждения "осталось 10 мин"
- `pacing_control` — не застревать на одной теме
- `proper_opening` / `proper_closing` — структура начала/конца
- `structured_format` — следовать плану интервью
- `capture_scorecard` — оценки по секциям

**Relationship (впечатление):**
- `show_competence` — фразочки показывающие что рекрутер шарит
- `sell_the_role` — продать позицию кандидату
- `build_rapport` — установить контакт
- `candidate_experience` — позитивный опыт кандидата

**Information gathering:**
- `collect_logistics` — зарплата, notice period, формат работы
- `competitor_intel` — мгновенный триггер при упоминании конкурентов
- `understand_current_situation` — текущая роль, причины ухода

**Custom:**
- Произвольный текст — "Спросить про опыт с Kafka", "Уточнить gap в резюме 2023-2024"

### UX целей в overlay

- Активные подсказки **прилипают к верху** overlay
- Выполненные / устаревшие подсказки **отлипают** вниз или скрываются
- Рекрутер может включить/выключить любую цель в реальном времени кликом
- Контроль интервью: "договориться что перебивать — это норм" → универсальные фразы в начале
- Подсказки зависят от выбранной методологии: STAR → "Какой был результат?", Behavioral → "Дайте конкретный пример"

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

### ~~1. Port mismatch~~ — FIXED
- Extension files (content.js, offscreen.js, background.js, manifest.json) обновлены на `:3000`

### ~~2. `ws/events` endpoint~~ — FIXED
- `wssEvents` WebSocket server добавлен в server.js
- `broadcastEvent()` отправляет transcript_final и hints на все подключённые ws/events клиенты
- content.js подключается к `ws://localhost:3000/ws/events`

### 3. 15 goal types из пресетов без evaluator-а
Пресеты (screening, deep_technical, etc.) используют эти goal types, но в `EVALUATORS` нет evaluator'ов:
- `proper_opening`, `proper_closing` — структурные фразы начала/конца
- `assess_hard_skills_screening`, `assess_hard_skills_deep` — отличаются от `hard_skills`
- `assess_motivation`, `assess_problem_solving`, `assess_leadership`, `assess_communication`
- `assess_cultural_fit`, `assess_soft_skills` — отличается от `soft_skills`
- `verify_resume`, `detect_red_flags`, `collect_logistics`
- `competitor_intel` — отличается от `competitor_research`
- `sell_the_role`, `pacing_control`, `capture_scorecard`
- `build_rapport`, `understand_current_situation`, `candidate_experience`, `bias_mitigation`

**Решение**: эти цели уже попадают в system prompt GPT-4o через `buildGoalsSection()` — LLM учитывает их при генерации подсказок. Rule-based evaluator'ы добавлять по мере необходимости, начиная с `assess_hard_skills_*` как alias к `hard_skills`.

---

## Что работает end-to-end сейчас

- [x] Seed данных + создание интервью через API
- [x] Пресеты: применить screening/deep_technical/etc. к интервью
- [x] Активация интервью → `GET /api/interviews/active`
- [x] tabCapture → Deepgram → транскрипция с speaker mapping (recruiter/candidate)
- [x] Goals engine: time_warning/time_management, hard_skills, soft_skills, competitor_research, overemployment, show_competence, checklist
- [x] LLM hints: goals-aware + keywords-aware system prompt
- [x] Overlay: sticky hints, транскрипт, keywords
- [x] Dashboard LivePage: polling последних hints/segments
- [x] Rate limiting: 20 сек throttle на LLM подсказки
- [x] ws/events endpoint: push-канал transcript + hints → content.js
- [x] Port alignment: extension → :3000

## Что НЕ работает (нужно чинить до демо)

- [ ] **Popup "Attach Interview"**: нет UI для выбора интервью перед звонком
- [ ] **Dashboard Interview List/Wizard**: только LivePage сделана, создание интервью — только через curl
- [ ] **Goals engine evaluators**: 15 goal types из пресетов без rule-based evaluator'а (LLM их учитывает, но нет auto-check)

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
