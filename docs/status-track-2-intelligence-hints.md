# Track 2: Intelligence / Hints — Статус

**Трек:** GPT-4o подсказки, goals engine, keyword detection, goals-aware prompts
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `backend/src/interview-goals-engine.js` — rule-based оценка goals (time_saving, hard_skills check, competitor_research trigger, etc.)
- [x] `backend/src/claude.js` — GPT-4o подсказки (был OpenAI, переименован); базовый goals-aware prompt
- [x] `scripts/simulate-interview-with-goals.js` — end-to-end тест с goals (прогон диалога → подсказки)
- [x] `POST /api/hints/explain` — объяснение ключевого слова по клику

---

## В процессе / Следующее

- [ ] **Goals-aware system prompt**: inject активные цели в system prompt GPT-4o (показывать только релевантные подсказки)
- [ ] **Пресеты целей**: добавить `show_competence` goal type — генерировать фразы демонстрирующие компетентность рекрутера
- [ ] **Auto-check goals**: goals engine автоматически ставит галку когда тема закрыта
- [ ] **Speaker-aware hints**: разные подсказки для реплик рекрутера vs кандидата (когда Track 1 даст speaker labels)
- [ ] **Time tracking**: `time_saving` goal — warn_at_min + max_min → `{ type: 'time_warning' }` события
- [ ] **Competitor detection**: `competitor_research` goal — мгновенный триггер через keyword match
- [ ] **Overemployment detection**: паттерны в транскрипте ("текущий проект", "сейчас параллельно")
- [ ] **Rate limiting подсказок**: не спамить — не чаще 1 подсказки в 20 сек

---

## Открытые вопросы

- **Контекст окно**: сколько сегментов транскрипта кидать в GPT-4o? Последние N сегментов или последние K минут?
- **Goals в prompt**: как лаконично передать список активных целей чтобы не раздувать prompt?
- **Hint типы**: нужен ли отдельный тип `competence_phrase` для show_competence goal?
- **Prioritization**: если несколько целей триггерятся одновременно — показывать одну самую важную или очередь?

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
