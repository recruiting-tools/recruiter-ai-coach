# Track 2: Intelligence / Hints — Статус

**Трек:** GPT-4o подсказки, goals engine, keyword detection, goals-aware prompts
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `backend/src/interview-goals-engine.js` — rule-based оценка goals (time_saving, hard_skills check, competitor_research trigger, etc.)
- [x] `backend/src/claude.js` — GPT-4o подсказки (был OpenAI, переименован); базовый goals-aware prompt
- [x] `scripts/simulate-interview-with-goals.js` — end-to-end тест с goals (прогон диалога → подсказки)
- [x] `POST /api/hints/explain` — объяснение ключевого слова по клику
- [x] **Goals-aware system prompt**: `generateGoalsAwareHint` автоматически загружает активное интервью из DB (`db.getActiveInterview()`) и инжектирует goals в system prompt — больше не надо передавать явно
- [x] **Keywords injection**: `buildKeywordsSection()` добавляет ключевые слова из CV/JD в system prompt GPT-4o
- [x] **Rate limiting**: 20 сек throttle в `generateHint` и `generateGoalsAwareHint` (через `ctx.lastHintAt`)
- [x] **time_saving warn_at_min**: поддержка `warn_at_min` как алиас для `warn_min` в `evaluateTimeSaving`
- [x] **Auto-check goals**: goals engine автоматически ставит `addressed=true` когда тема закрыта (hard_skills, soft_skills, checklist, competitor_research, overemployment)
- [x] **Competitor detection**: `competitor_research` goal — мгновенный триггер через keyword match
- [x] **Overemployment detection**: паттерны в транскрипте ("параллельно", "фриланс", "на стороне", etc.)
- [x] **`generateHintFromActiveInterview(sessionId, segment, opts)`** — новая primary entry point для реального flow: автозагружает активное интервью, фильтрует enabled goals, передаёт keywords явно
- [x] **`time_management` evaluator alias** — пресеты Track 0 используют тип `time_management`, добавлен как alias к `evaluateTimeSaving` в EVALUATORS
- [x] Проверено `node scripts/simulate-interview-with-goals.js` — все goals корректно триггерятся (2026-03-22)

---

## В процессе / Следующее

- [x] **Speaker-aware hints**: в `GOALS_AWARE_SYSTEM_PROMPT` добавлены инструкции — когда говорит кандидат: ищем red flags, follow-up, компетентность; когда рекрутер: подсказки только если вопрос сформулирован неэффективно. User message явно помечает `[РЕКРУТЕР]` / `[КАНДИДАТ]`
- [ ] **`show_competence` goal auto-check**: сейчас никогда не помечается как addressed — нужна логика
- [ ] **Приоритизация hints**: если несколько goals триггерятся одновременно — показывать самую важную
- [ ] **Rate limiting goals engine**: goals engine сейчас без throttle — возможен спам одинаковыми хинтами; нужен дедуп по `goalId` + cooldown
- [x] **Обновить server.js**: заменить `claude.generateHint` на `claude.generateHintFromActiveInterview` в WebSocket audio handler и `/api/browser-segment` — сделано Track 1 агентом (2026-03-22)

---

## Методологии и пресеты → влияние на подсказки

### Как методология влияет на hint generation

Track 0 сохраняет `methodology` в InterviewConfig. Track 2 инжектирует методологию в system prompt GPT-4o.

**Задача:** `buildGoalsSection()` в `claude.js` должен читать `interview.methodology` и добавлять в system prompt соответствующие инструкции.

Пример инъекции в system prompt:
```
МЕТОДОЛОГИЯ ИНТЕРВЬЮ: STAR (Situation → Task → Action → Result)
- Если кандидат даёт абстрактный ответ — подскажи: "Попроси конкретный пример: опиши ситуацию"
- Если кандидат описал ситуацию но не сказал результат — подскажи: "Какой был результат?"
- Если рекрутер задаёт гипотетический вопрос — подскажи: "Лучше спроси про реальный опыт"
```

### Маппинг методологии → prompt instructions

| Методология | Ключевые инструкции для LLM |
|-------------|----------------------------|
| `star` | Следить за S-T-A-R структурой, напоминать про пропущенные части |
| `behavioral` | Все вопросы должны быть про прошлый опыт, флажить гипотетические ответы |
| `situational` | Гипотетические сценарии ОК, следить за структурой рассуждений |
| `topgrading` | Хронологический порядок, одинаковые вопросы для каждой позиции |
| `competency_based` | После каждого ответа — промпт на оценку по рубрике |
| `case_interview` | Следить за процессом мышления, уточняющими вопросами, альтернативами |

### Custom text goals

Пользователь может добавить цель текстом ("Спросить про опыт с Kafka"). Такие цели попадают в `goals[]` с `type: "custom"` и `custom_text`. LLM учитывает их наравне с типизированными целями.

### Что нужно сделать

- [ ] Добавить `buildMethodologySection(methodology)` в `claude.js` — инъекция методологии в system prompt
- [ ] Обновить `generateHintFromActiveInterview()` — читать `interview.methodology` и передавать в prompt builder
- [ ] Поддержка `type: "custom"` goals в `buildGoalsSection()` — пробрасывать `custom_text` в промпт
- [ ] Тест: `simulate-interview-with-goals.js` с разными методологиями — проверить что подсказки отличаются

---

## Открытые вопросы

- **Контекст окно**: сейчас последние 10 сегментов — достаточно? Может нужно последние K минут?
- **Hint типы**: `competence_phrase` есть в goals engine, но в TranscriptEvent контракте его нет — надо согласовать с Track 3
- **Prioritization**: если несколько goals триггерятся одновременно — показывать одну самую важную или очередь?
- **Дублирование hints**: goals engine и LLM могут оба предложить одно и то же — нужен дедуп на уровне server.js

---

## Зависимости

- Track 0 предоставляет `InterviewConfig` с goals[] — нужен endpoint `GET /api/interviews/active`
- Track 1 предоставляет speaker labels — для speaker-aware hints
- Track 3 (Extension) отображает TranscriptEvent'ы от этого трека

---

## Заметки для других агентов

- GPT-4o API key: в `.env` как `OPENAI_API_KEY`
- Основной файл: `backend/src/claude.js` (название устарело — это OpenAI, не Claude)
- Goals engine: `backend/src/interview-goals-engine.js`
- Simulate test: `node scripts/simulate-interview-with-goals.js`
