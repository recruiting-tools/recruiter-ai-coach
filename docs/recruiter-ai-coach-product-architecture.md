# Recruiter AI Coach — Product Architecture

## Обзор продукта

AI-коуч для рекрутеров в реальном времени. Слушает Google Meet звонок, транскрибирует, ловит ключевые слова из CV/JD, даёт подсказки.

**Два интерфейса:**
- **Chrome Extension overlay** — маленький виджет поверх Meet (drag-and-drop), для быстрых подглядываний во время звонка
- **Web Dashboard** — полная страница для подготовки к интервью, настройки целей, пост-call review. Открывается на отдельной вкладке или телефоне

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension                             │
│                                                                  │
│  popup.js ──► background.js ──► offscreen.js                    │
│  (Start/Stop)   (tabCapture)     (MediaRecorder → WebSocket)    │
│                                                                  │
│  content.js ─── Overlay на Meet ─── транскрипт, ключевики,      │
│                                      подсказки, чек-лист целей  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ WebSocket (ws://localhost:3001/ws/audio)
                       │ + REST API (http://localhost:3001/api/*)
┌──────────────────────▼──────────────────────────────────────────┐
│                     Node.js Backend                              │
│                                                                  │
│  server.js ─── Express + Socket.IO + raw WS                     │
│      │                                                           │
│      ├── deepgram-stream.js ──► Deepgram nova-2 (полный текст)  │
│      ├── audio-converter.js ──► ffmpeg ──► PCM 16kHz            │
│      │       └── vosk-spotter.js ──► Vosk (ключевики <100ms)   │
│      ├── claude.js ──► GPT-4o (подсказки + prep kit)            │
│      ├── goals-engine.js ──► оценка целей (rule-based)          │
│      ├── interviews.js ──► подготовка к интервью                │
│      ├── db.js ──► SQLite (better-sqlite3)                      │
│      └── session-manager.js ──► управление сессиями             │
│                                                                  │
│  /dashboard/* ──► React SPA (Vite)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model (SQLite)

```sql
-- Кандидаты
candidates (id, name, raw_cv, cv_summary, created_at)

-- Вакансии
jobs (id, title, raw_jd, jd_summary, created_at)

-- Интервью = кандидат + вакансия + подготовка
interviews (id, candidate_id, job_id, scheduled_at, status, goals JSON, prep_kit, keywords JSON, created_at)

-- Сессия = один звонок
sessions (id, interview_id, started_at, ended_at, duration_sec)

-- Сегменты транскрипции
transcript_segments (id, session_id, speaker, text, timestamp, source)

-- Подсказки
hints (id, session_id, hint_type, content, triggered_by, timestamp, dismissed)

-- Обнаруженные ключевики
keywords_detected (id, session_id, keyword, confidence, timestamp)
```

---

## Цели интервью (Goals)

Рекрутер выбирает цели перед звонком. Каждая цель влияет на подсказки.

| Тип | Что делает | Пример подсказки |
|-----|-----------|-----------------|
| **hard_skills** (shallow/deep) | Проверка тех. навыков по темам из JD | "Ещё не спросили про TypeScript — 15 мин прошло" |
| **soft_skills** (STAR/behavioral) | Поведенческие вопросы | "Попросите привести конкретный пример ситуации" |
| **competitor_research** | Реагирует на упоминание конкурентов | "Кандидат упомянул Яндекс — спросите про масштаб команды" |
| **time_saving** | Контроль времени | "35 мин — пора завершать, осталось 2 темы" |
| **overemployment** | Детект параллельной работы | "Кандидат упомянул текущий проект в другой компании" |
| **show_competence** | Фразы демонстрирующие компетентность | "Скажи: 'В моей практике обычно K8s + Helm для таких кейсов'" |
| **checklist** | Произвольные пункты | "Не обсудили: ожидания по зарплате" |

Goals хранятся как JSON в `interviews.goals`:
```json
[
  { "id": "hard_deep", "type": "hard_skills", "depth": "deep", "enabled": true, "config": { "topics": ["React", "TypeScript"] } },
  { "id": "time", "type": "time_saving", "enabled": true, "config": { "max_duration_min": 45, "warn_at_min": 35 } }
]
```

Система автоматически считает ожидаемое время интервью по сумме включённых целей.

---

## Два потока аудио

| Поток | Источник | Формат | Задача | Латенси | Стоимость |
|-------|----------|--------|--------|---------|-----------|
| Транскрипция | Deepgram nova-2 | WebM/Opus → Deepgram напрямую | Полный текст → контекст для LLM → умные подсказки | 300-500ms | ~$0.004/мин |
| Ключевики | Vosk (офлайн) | WebM → ffmpeg → PCM 16kHz | Мгновенный детект слов из CV/JD → теги в UI | <100ms | бесплатно |

```
audio chunk (250ms WebM/Opus)
    ├── dg.sendAudio(chunk)        → Deepgram → transcript → GPT-4o hint
    └── converter.feed(chunk)      → ffmpeg → PCM → Vosk → keyword hit
```

---

## API Endpoints

### Существующие (без изменений)
- `GET /health`
- `POST /api/browser-segment`
- `POST /api/test/simulate`
- `GET /api/session/:sessionId/hints`

### Новые: Кандидаты и вакансии
- `POST /api/candidates` — создать (name, raw_cv)
- `GET /api/candidates` — список
- `POST /api/jobs` — создать (title, raw_jd)
- `GET /api/jobs` — список

### Новые: Интервью
- `POST /api/interviews` — создать (candidate_id, job_id) → запускает генерацию prep kit
- `GET /api/interviews` — список
- `GET /api/interviews/:id` — полная информация + prep_kit + keywords
- `PUT /api/interviews/:id/goals` — обновить цели
- `POST /api/interviews/:id/activate` — сделать активным для следующего звонка
- `GET /api/interviews/active` — получить текущее активное интервью
- `POST /api/interviews/:id/keywords/prepare` — CV+JD → GPT-4o → список ключей
- `POST /api/interviews/:id/bind-meet` — привязать Meet URL
- `GET /api/interviews/by-meet-url?url=...` — auto-bind по URL вкладки

### Новые: Сессии
- `GET /api/sessions/:id` — полный транскрипт + hints + keywords из SQLite
- `GET /api/sessions/current/live` — последние 3 подсказки + 5 сегментов (для mobile polling)
- `GET /api/interviews/:id/export` — экспорт в JSON

### Новые: Подсказки
- `POST /api/hints/explain` — `{ keyword, role, jd_summary }` → объяснение + вопрос

---

## Chrome Extension Overlay

```
┌───────────────────────────────────┐
│ 🎯 AI Coach              ●  −    │  ← header (drag)
├───────────────────────────────────┤
│ ▓▓▓▓▓▓░░░░░░░░░  Audio: 28      │  ← уровень звука
├───────────────────────────────────┤
│ Транскрипция:                     │
│ "...рассказывал про опыт в        │
│ компании где мы делали            │
│ микросервисную архитектуру..."     │
├───────────────────────────────────┤
│ 🏷 Ключевики:                     │
│ [kubernetes] [Docker] [CI/CD]     │
│ [team lead] [микросервисы]        │
│                                   │
│ Клик по тегу → объяснение         │
├───────────────────────────────────┤
│ 💡 Подсказка:                     │
│ ❓ Уточни, какой оркестратор      │
│ использовали — K8s или Swarm?     │
│                               ✕   │
├───────────────────────────────────┤
│ ✅ Checklist:                     │
│ ☑ React experience                │
│ ☑ System design                   │
│ ☐ TypeScript generics             │
│ ☐ Salary expectations             │
│ ⏱ 28 мин / 45 мин               │
└───────────────────────────────────┘
```

---

## Web Dashboard (React SPA)

### Страницы

| URL | Назначение |
|-----|-----------|
| `/dashboard` | Главная: список интервью, активная сессия |
| `/dashboard/interviews/new` | Мастер создания: CV → JD → цели → keywords |
| `/dashboard/interviews/:id` | Детали: prep kit, keywords, goals, "Активировать" |
| `/dashboard/sessions/:id` | Post-call: полный транскрипт, timeline подсказок |
| `/dashboard/candidates` | CRUD кандидатов |
| `/dashboard/jobs` | CRUD вакансий |

### Mobile view
Та же страница `/dashboard/sessions/:id` — адаптивная верстка для телефона:
- Prep kit в аккордеонах
- Ключевики как крупные кнопки
- Чек-лист целей
- "Live" режим — поллинг каждые 5 сек, последняя подсказка наверху

---

## Файловая структура

```
recruiter-ai-coach/
├── backend/
│   ├── package.json
│   ├── models/              (Vosk, gitignored)
│   ├── data/                (SQLite, gitignored)
│   └── src/
│       ├── server.js        (изменён: новые роуты + vosk интеграция)
│       ├── db.js            (NEW: SQLite)
│       ├── session-manager.js (NEW: извлечён из server.js)
│       ├── interviews.js    (NEW: prep pipeline)
│       ├── goals-engine.js  (NEW: оценка целей)
│       ├── audio-converter.js (NEW: WebM→PCM)
│       ├── vosk-spotter.js  (NEW: Vosk subprocess)
│       ├── claude.js        (изменён: goals-aware prompts)
│       ├── deepgram-stream.js (без изменений)
│       ├── fireflies.js     (без изменений)
│       ├── telegram.js      (без изменений)
│       ├── routes/
│       │   ├── candidates.js
│       │   ├── jobs.js
│       │   ├── interviews.js
│       │   └── sessions.js
│       └── public/dashboard/ (React build output)
│
├── chrome-extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js           (+ keywords + goals секции)
│   ├── offscreen.js
│   ├── popup.html / popup.js (упрощён: статус + ссылка на dashboard)
│   ├── overlay.css
│   └── lib/
│       ├── keyword-renderer.js
│       └── goal-renderer.js
│
├── dashboard/               (Vite + React)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── pages/
│       └── components/
│
└── vosk_worker.py           (Python, stdin/stdout JSON lines)
```

---

## Ключевые решения

### Auto-bind Meet URL
Расширение при старте захвата определяет URL вкладки Meet. Если этот URL привязан к интервью (`interviews.meet_url`) — автоматически загружает конфиг, goals, keywords. Привязка делается через кнопку "Attach" в popup расширения или через dashboard.

### Goals — живой чеклист
Goals не только rule-based автоматика, но и **ручной чеклист** прямо в overlay. Рекрутер может:
- Поставить/убрать галку в любой момент
- Включить `time_saving` если кол затягивается
- Включить `show_competence` чтобы получать фразочки
- Включить `competitor_research` если кандидат заговорил про конкурентов

### Speaker separation (Track 1)
Приоритетный research: разделение рекрутера и кандидата. Варианты:
1. Deepgram `diarize=true` (простейший)
2. Mic рекрутера отдельно через `getUserMedia` (точнее)
3. Deepgram `multichannel=true` с двумя каналами

### recruiter-assistant.com
Пока НЕ связываем. Standalone SQLite. Интеграция через REST API позже когда продукт стабилен.

### Параллельная разработка
4 трека с data contracts — см. [parallel build plan](recruiter-ai-coach-parallel-build-plan.md)

---

## Порядок реализации

### Phase 1: Persistence (SQLite)
- `db.js` — схема, миграции, typed queries
- Сохранение сегментов и подсказок в БД
- `session-manager.js` — извлечь из server.js

### Phase 2: Interview Prep Pipeline
- `interviews.js` — создание интервью из CV + JD
- Обновить `claude.js` — structured prep kit, generateKeywords, explainKeyword
- REST routes: candidates, jobs, interviews

### Phase 3: Goals Engine
- `goals-engine.js` — 6 типов целей, rule-based evaluation
- Интеграция в audio WS handler
- Goals-aware промпты для GPT-4o

### Phase 4: Vosk Keyword Spotter
- `vosk_worker.py` + скачать модели
- `audio-converter.js` — ffmpeg pipe
- `vosk-spotter.js` — subprocess manager
- Интеграция в аудио пайплайн параллельно с Deepgram

### Phase 5: Extension UI Upgrade
- Секция ключевиков (теги с подсветкой)
- Секция целей (чек-лист)
- Обновить popup → статус + "Open Dashboard"

### Phase 6: Web Dashboard
- Vite + React проект
- Мастер создания интервью
- Post-call review с timeline
- Mobile responsive

### Phase 7: Polish
- Export в JSON/PDF
- Mobile live polling
- Тестовый звонок end-to-end
- Промпт-тюнинг
