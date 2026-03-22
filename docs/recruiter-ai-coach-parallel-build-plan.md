# Параллельный Build Plan — 4 трека

## Принцип

4 трека развиваются **параллельно и независимо**. Между ними — **data contracts** (типизированные JSON-структуры). Каждый трек может работать с моками пока другой трек ещё не готов. На каждой итерации все 4 трека делают прогресс.

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Track 0     │    │ Track 1      │    │ Track 2      │    │ Track 3      │
│ SETUP       │    │ AUDIO        │    │ INTELLIGENCE │    │ UI/UX        │
│             │    │              │    │              │    │              │
│ Interview   │◄──►│ Capture +    │◄──►│ Transcript + │◄──►│ Extension +  │
│ config,     │    │ Speaker      │    │ Hints +      │    │ Dashboard +  │
│ goals,      │    │ separation   │    │ Keywords     │    │ Mobile       │
│ CV/JD       │    │              │    │              │    │              │
└──────┬──────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                  │                   │                   │
       └──────────────────┴───────────────────┴───────────────────┘
                          DATA CONTRACTS (shared types)
```

---

## Data Contracts

Все треки обмениваются данными через эти структуры. Каждый трек может использовать моки.

### Contract 1: InterviewConfig (Track 0 → Track 2, 3)

```typescript
interface InterviewConfig {
  id: string
  candidate: {
    name: string
    cv_text: string
    cv_summary?: string   // generated
  }
  job: {
    title: string
    jd_text: string
    jd_summary?: string   // generated
  }
  meet_url?: string        // привязка к Google Meet
  preset?: PresetType      // выбранный пресет (если есть)
  methodology?: Methodology // выбранная методология (если есть)
  goals: Goal[]
  keywords: string[]       // generated from CV+JD
  language: 'ru' | 'en' | 'ar'
  created_at: number
}

type PresetType = 'screening' | 'deep_technical' | 'culture_fit' | 'leadership' | 'full'

// Методология определяет КАК коучить (формат вопросов/подсказок)
type Methodology = 'star' | 'behavioral' | 'situational' | 'topgrading' | 'competency_based' | 'case_interview'

interface Goal {
  id: string
  type: string            // один из ~30 типов из каталога (assess_hard_skills_deep, time_management, etc.)
  label?: string          // human-readable название (авто или custom)
  enabled: boolean
  config: Record<string, any>
  custom_text?: string    // если пользователь добавил цель текстом
  // runtime:
  addressed?: boolean      // галка поставлена (вручную или автоматом)
  addressed_at?: number
}
```

**Goal types (основные, полный каталог в `docs/interview-goals-comprehensive-catalog.md`):**

| type | description | config | runtime behavior |
|------|-------------|--------|-----------------|
| `assess_hard_skills_deep` | Глубокая проверка тех. навыков | `{ topics: string[] }` | Подсказки "не спросили про X", follow-up |
| `assess_hard_skills_screening` | Поверхностная проверка стека | `{ topics: string[], max_min_per_topic: 3 }` | Флаг если углубляется слишком |
| `assess_soft_skills` | Поведенческие вопросы | `{ style: 'STAR' \| 'behavioral' \| 'situational' }` | Подсказки про формат вопросов |
| `assess_motivation` | Мотивация и намерения | `{ role_offers: string[] }` | Детект мисматча мотивация↔роль |
| `assess_leadership` | Лидерские качества | `{ topics: string[] }` | Подсказки про делегирование, конфликты |
| `assess_cultural_fit` | Культурное соответствие | `{ values: string[] }` | Напоминание если культура не обсуждалась |
| `verify_resume` | Проверка заявлений из CV | `{ claims_to_verify: string[] }` | Вопросы-ловушки по CV |
| `detect_red_flags` | Red flags | `{ watch: string[] }` | Overemployment, job-hopping, противоречия |
| `competitor_intel` | Упоминания конкурентов | `{ competitors: string[] }` | Мгновенный триггер при упоминании |
| `time_management` | Контроль времени | `{ max_min: 45, warn_min: 35 }` | Таймер + подсказки "пора завершать" |
| `show_competence` | Демонстрация компетентности | `{ topics: string[] }` | Фразочки показывающие что рекрутер шарит |
| `collect_logistics` | Зарплата, notice period, etc. | `{ items: string[] }` | Напоминание если не спросили |
| `sell_the_role` | Продать позицию кандидату | `{ selling_points: string[] }` | Напоминание вставить selling point |
| `proper_opening` / `proper_closing` | Структура начала/конца | `{ checklist: string[] }` | Чеклист при начале/конце звонка |
| `custom` | Произвольный текст от пользователя | `{ text: string }` | LLM учитывает в подсказках |

**Методология** инжектируется в system prompt GPT-4o и влияет на стиль подсказок:
- `star` → подсказки вида "Попроси конкретный пример (Situation → Task → Action → Result)"
- `behavioral` → "Расскажите о ситуации когда...", "Дайте пример из прошлого опыта"
- `topgrading` → "Что вас наняли делать?", "Что бы сказал ваш руководитель?"
- и т.д. (полный список в каталоге)

### Contract 2: AudioFrame (Track 1 → Track 2)

```typescript
interface AudioFrame {
  sessionId: string
  chunk: Buffer              // WebM/Opus raw bytes
  chunkIndex: number
  timestamp: number
  audioLevel: number         // 0-100, from AnalyserNode
  speaker?: SpeakerInfo      // when speaker separation is ready
}

interface SpeakerInfo {
  id: 'recruiter' | 'candidate' | 'unknown'
  confidence: number
}
```

**Мок для Track 2 пока Track 1 не готов:**
```javascript
// Mock AudioFrame — simulate conversation
const mockFrames = [
  { speaker: { id: 'candidate' }, text: 'Я работал с Kubernetes в продакшене' },
  { speaker: { id: 'recruiter' }, text: 'А какой оркестратор использовали?' },
]
```

### Contract 3: TranscriptEvent (Track 2 → Track 3)

```typescript
// Все события которые Track 2 генерирует и Track 3 отображает
type TranscriptEvent =
  | { type: 'transcript_interim', text: string }
  | { type: 'transcript_final', text: string, speaker?: SpeakerInfo, speechFinal?: boolean }
  | { type: 'hint', hint: string, hint_type: 'llm' | 'goal_check' | 'time_warning' | 'competence_phrase' }
  | { type: 'keyword_detected', keyword: string, confidence: number }
  | { type: 'goal_update', goalId: string, addressed: boolean }
  | { type: 'audio_level', level: number }
  | { type: 'speaker_changed', speaker: SpeakerInfo }
  | { type: 'status', status: 'listening' | 'stopped' | 'error', error?: string }
```

**Мок для Track 3 пока Track 2 не готов:**
```javascript
// Mock transcript stream for UI development
const mockEvents = [
  { type: 'audio_level', level: 35 },
  { type: 'transcript_final', text: 'Расскажите про ваш опыт с React', speaker: { id: 'recruiter' } },
  { type: 'transcript_final', text: 'Я работал с React три года, делал SPA для финтеха', speaker: { id: 'candidate' } },
  { type: 'keyword_detected', keyword: 'React', confidence: 0.95 },
  { type: 'keyword_detected', keyword: 'финтех', confidence: 0.80 },
  { type: 'hint', hint: '❓ Уточни, какую версию React — class components или hooks?', hint_type: 'llm' },
  { type: 'goal_update', goalId: 'hard_react', addressed: true },
]
```

### Contract 4: UIState (Track 3 internal + Track 0)

```typescript
interface UIState {
  // Extension overlay
  overlay: {
    audioLevel: number
    transcript: TranscriptLine[]
    keywords: KeywordChip[]
    activeHint: string | null
    goals: GoalCheckItem[]
    timer: { elapsed_sec: number, max_sec?: number }
  }

  // Dashboard
  dashboard: {
    interviews: InterviewConfig[]
    activeSession: SessionState | null
    liveTranscript: TranscriptLine[]   // for mobile polling
  }
}

interface TranscriptLine {
  text: string
  speaker?: 'recruiter' | 'candidate' | 'unknown'
  timestamp: number
  isFinal: boolean
}

interface KeywordChip {
  keyword: string
  isNew: boolean       // подсветка первые 3 сек
  count: number        // сколько раз упомянули
  firstSeen: number
}

interface GoalCheckItem {
  id: string
  label: string
  type: string
  checked: boolean     // можно ставить вручную кликом
  autoChecked: boolean // система поставила
}
```

---

## Track 0: SETUP (Interview Configuration)

### Что делает
Подготовка к интервью: загрузка CV/JD, привязка к Meet, выбор целей, генерация ключевых слов.

### Компоненты
- **Extension popup** → кнопка "Attach Interview" → выбор из списка или создание нового
- **REST API** → CRUD для candidates, jobs, interviews
- **SQLite** → persistence
- **Auto-bind** → если Meet URL совпадает с сохранённым → автоматически подгружает конфиг

### Iteration 1 (можно делать сейчас)
- [ ] `backend/src/interview-config-db.js` — SQLite schema + queries
- [ ] `POST /api/interviews` — создать из CV text + JD text
- [ ] `POST /api/interviews/:id/generate-keywords` — CV+JD → GPT-4o → keywords[]
- [ ] `PUT /api/interviews/:id/goals` — сохранить/обновить goals
- [ ] `POST /api/interviews/:id/bind-meet` — привязать Meet URL
- [ ] `GET /api/interviews/by-meet-url?url=...` — найти по Meet URL (для auto-bind)
- [ ] Mock data: 2-3 готовых InterviewConfig для тестирования Track 2 и 3

### Iteration 2
- [ ] Extension popup: "Attach Interview" UI
- [ ] Auto-detect Meet URL из вкладки → auto-bind
- [ ] Goals чеклист в overlay с ручными галками (toggle в реальном времени)

### Вопрос: связка с recruiter-assistant.com
**Решение: пока НЕ связывать.** Причины:
- recruiter-assistant.com — это отдельный продакшн сервис с своей БД и API
- Связка добавит зависимость и замедлит итерации
- Когда базовый продукт стабилен → добавить API интеграцию: import candidates/jobs из recruiter-assistant.com
- На этом этапе: standalone SQLite, можно синхронизировать позже через REST API

---

## Track 1: AUDIO (Capture + Speaker Separation)

### Что делает
Захват аудио с Google Meet, усиление, определение кто говорит (рекрутер vs кандидат).

### Текущее состояние
- tabCapture работает, MediaRecorder → WebSocket → backend ✓
- Deepgram подключён и стабилен ✓
- Проблема: аудио иногда тихое, speaker separation отсутствует

### Research: Speaker Separation
Варианты:
1. **Deepgram diarization** — `diarize=true` в параметрах. Deepgram сам разделяет спикеров. Простейший вариант, но привязан к Deepgram.
2. **Микрофон рекрутера отдельно** — захватить mic через `getUserMedia()` параллельно с tabCapture. Микрофон = рекрутер, tab audio = кандидат. Точнее всего.
3. **Client-side VAD** — Voice Activity Detection на стороне расширения, определить кто говорит по энергии/паттерну.
4. **Deepgram multichannel** — два канала (mic + tab) в один Deepgram stream с `multichannel=true`.

**Рекомендация: вариант 2+4.** Захват mic отдельно + отправка двух каналов в Deepgram.

### Iteration 1 (можно делать сейчас)
- [ ] Добавить `diarize=true` в Deepgram params — получить speaker labels бесплатно
- [ ] Audio gain node в offscreen.js — усиление тихого сигнала
- [ ] Добавить `speaker` поле в TranscriptEvent из Deepgram diarization
- [ ] Research: проверить работает ли diarize с webm/opus streaming

### Iteration 2
- [ ] Захват микрофона рекрутера через `getUserMedia({ audio: true })` в offscreen
- [ ] Два MediaRecorder: один для tab (кандидат), один для mic (рекрутер)
- [ ] Deepgram multichannel: `channels=2&multichannel=true`
- [ ] Или два отдельных Deepgram stream (проще, но 2x стоимость)

### Iteration 3
- [ ] Audio preprocessing: noise gate, compressor, gain normalization
- [ ] Vosk keyword spotter (параллельный канал, по ТЗ)

### Data Contract output
```javascript
// Track 1 produces AudioFrame for Track 2:
{ sessionId, chunk, chunkIndex, timestamp, audioLevel, speaker: { id: 'candidate', confidence: 0.9 } }
```

---

## Track 2: INTELLIGENCE (Transcript + Hints + Keywords)

### Что делает
Обработка аудио → транскрипция → генерация подсказок с учётом целей → ключевые слова.

### Компоненты
- **Deepgram** → полная транскрипция
- **Vosk** → ключевые слова (будущее)
- **GPT-4o** → подсказки с учётом целей интервью
- **Goals Engine** → rule-based оценка целей

### Iteration 1 (можно делать сейчас, с моками от Track 1)
- [ ] `backend/src/interview-goals-engine.js` — evaluate goals vs transcript
- [ ] Обновить `claude.js` — goals-aware prompt: inject active goals в system prompt
- [ ] Новый goal type `show_competence` — генерация фраз демонстрирующих компетентность
- [ ] `POST /api/hints/explain` — объяснение ключевого слова по клику
- [ ] Mock test: `scripts/simulate-interview-with-goals.js` — прогнать диалог с goals

### Iteration 2
- [ ] Использовать speaker info от Track 1 — разные подсказки для реплик рекрутера vs кандидата
- [ ] Goals engine: auto-check goals когда тема обсуждена
- [ ] Time tracking: warn_at_min + max_min из goal config

### Iteration 3
- [ ] Vosk keyword spotter integration
- [ ] Competitor detection через keywords + Vosk
- [ ] Overemployment detection patterns

### Data Contract output
```javascript
// Track 2 produces TranscriptEvent for Track 3:
{ type: 'transcript_final', text: '...', speaker: { id: 'candidate' } }
{ type: 'hint', hint: '❓ Уточни...', hint_type: 'llm' }
{ type: 'keyword_detected', keyword: 'kubernetes', confidence: 0.95 }
{ type: 'goal_update', goalId: 'hard_k8s', addressed: true }
```

---

## Track 3: UI/UX (Extension + Dashboard + Mobile)

### Что делает
Отображение всего — overlay на Meet, web dashboard для подготовки, мобильная версия.

### Компоненты
- **Chrome Extension overlay** (content.js) — виджет на Meet
- **Extension popup** (popup.js) — быстрый статус + attach
- **Web Dashboard** (React SPA) — полный контроль
- **Mobile view** — responsive dashboard для телефона

### Iteration 1 (можно делать сейчас, с моками от Track 2)
- [ ] `chrome-extension/mock-transcript-stream.js` — генератор mock TranscriptEvent для UI разработки
- [ ] Обновить content.js: секция keywords (теги/чипсы), секция goals (чеклист с ручными галками)
- [ ] Красивый layout: speaker labels (рекрутер синий, кандидат зелёный)
- [ ] Dashboard скелет: Vite + React, страница Home + Interview Detail

### Iteration 2
- [ ] Dashboard: мастер создания интервью (CV → JD → goals → keywords)
- [ ] Popup: "Attach Interview" dropdown
- [ ] Mobile responsive layout
- [ ] Keyword tap → объяснение (popup внутри overlay)

### Iteration 3
- [ ] Post-call review page (timeline транскрипта + подсказок)
- [ ] Export
- [ ] Live polling для mobile

---

## Матрица итераций

| | Track 0: Setup | Track 1: Audio | Track 2: Intelligence | Track 3: UI |
|---|---|---|---|---|
| **Iter 1** | SQLite + CRUD API + mock interviews | diarize=true + gain node | goals engine + goals-aware hints + simulate script | keywords/goals в overlay + mock stream |
| **Iter 2** | popup attach + auto-bind Meet URL | mic capture + multichannel | speaker-aware hints + auto-check goals | dashboard wizard + mobile |
| **Iter 3** | recruiter-assistant.com sync (опционально) | Vosk + noise gate | competitor/overemployment detection | post-call review + export |

### Правило работы
1. В начале каждой итерации — обновить data contracts если нужно
2. Каждый трек может работать с моками от других треков
3. Когда реальные данные готовы — заменить моки на реальные вызовы
4. Commit после каждого завершённого трека в итерации

---

## Файлы для Iteration 1

```
backend/src/
  interview-config-db.js          (Track 0: SQLite)
  interview-goals-engine.js       (Track 2: goals evaluation)
  routes/
    interview-config-routes.js    (Track 0: REST API)

scripts/
  simulate-interview-with-goals.js (Track 2: mock test)

chrome-extension/
  mock-transcript-stream.js       (Track 3: UI development helper)
  content.js                      (Track 3: updated overlay)
  lib/
    keyword-renderer.js           (Track 3: keyword chips)
    goal-renderer.js              (Track 3: goals checklist)

docs/
  data-contracts.md               (shared types reference)
```
