# Track 0: Interview Setup — Статус

**Трек:** Управление интервью, CV/JD, цели, ключевые слова, SQLite, REST API
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `backend/src/interview-config-db.js` — SQLite schema: candidates, jobs, interviews, sessions, transcript_segments, hints, keywords_detected
- [x] `backend/src/routes/interview-config-routes.js` — REST CRUD: POST/GET candidates, jobs, interviews; PUT goals; POST bind-meet; GET by-meet-url
- [x] `scripts/seed-mock-interviews.js` — сид с тестовыми данными (2 кандидата, 1 вакансия, 1 интервью)
- [x] Подключено в `server.js`: `app.use('/api', interviewConfigRoutes)`
- [x] `POST /api/interviews/:id/generate-keywords` — CV+JD → GPT-4o → keywords[], сохраняет в БД
- [x] `POST /api/interviews/:id/activate` — сделать интервью активным (deactivates others)
- [x] `GET /api/interviews/active` — текущее активное интервью (для Extension)
- [x] `setActiveInterview` и `getActiveInterview` — в db.js
- [x] `createPreset(type)` factory в `interview-config-db.js` — 5 пресетов: screening, deep_technical, culture_fit, leadership, full
- [x] `POST /api/interviews/:id/apply-preset` — применить пресет к интервью
- [x] `GET /api/presets` — список доступных пресетов с goal_count

---

## В процессе / Следующее

- [ ] Auto-bind: проверить что `GET /api/interviews/by-meet-url?url=...` работает из extension
- [ ] E2E тест: seed → apply-preset → generate-keywords → activate → GET active
- [ ] Dashboard wizard: Track 4 будет использовать эти API для setup-flow

---

## Открытые вопросы

- **SQLite migrations**: создаётся при старте — нужны ли версионированные миграции?
- **Goals runtime state**: `addressed`/`addressed_at` хранить в interviews.goals JSON или отдельная таблица?
- **Preset + custom goals**: нужен ли endpoint для toggle отдельной цели (без перезаписи всех goals)?

---

## API Summary (для других треков)

```
GET    /api/presets                              → список пресетов
POST   /api/interviews/:id/apply-preset         → { preset: "screening" } → Goal[]
POST   /api/interviews/:id/generate-keywords    → keywords[] из CV+JD через GPT-4o
POST   /api/interviews/:id/activate             → делает активным
GET    /api/interviews/active                   → InterviewConfig с goals[] и keywords[]
PUT    /api/interviews/:id/goals                → { goals: Goal[] } → ручная правка целей
```

### Preset types
| Type | Goals |
|------|-------|
| `screening` | proper_opening, assess_hard_skills_screening, assess_motivation, detect_red_flags, collect_logistics, competitor_intel, sell_the_role, time_management(30min), proper_closing |
| `deep_technical` | proper_opening, assess_hard_skills_deep, assess_problem_solving, verify_resume, show_competence, pacing_control, capture_scorecard, time_management(60min), proper_closing |
| `culture_fit` | proper_opening, build_rapport, assess_cultural_fit, assess_soft_skills(STAR), assess_motivation, sell_the_role, candidate_experience, bias_mitigation, time_management(45min), proper_closing |
| `leadership` | proper_opening, assess_leadership, assess_soft_skills(behavioral), assess_problem_solving, assess_motivation, verify_resume, capture_scorecard, time_management(60min), proper_closing |
| `full` | Все цели (21 goal, 90min) |

---

## Зависимости

- Track 2 использует `Goal[]` из этого трека — формат должен быть стабильным
- Track 3 (Extension) делает `GET /api/interviews/active` — endpoint нужен рабочим
- Track 4 (Dashboard) строит wizard на базе этих API

---

## Заметки для других агентов

- SQLite файл: `backend/data/coach.db` (gitignored)
- Запуск: `cd backend && node src/server.js`
- Тест API: `curl http://localhost:3000/api/interviews`
- Seed: `node scripts/seed-mock-interviews.js`

---

## Как тестировать (E2E flow)

```bash
# 1. Запустить backend
cd backend && node src/server.js

# 2. Заполнить тестовые данные (2 кандидата, 1 вакансию, 1 интервью)
node scripts/seed-mock-interviews.js

# 3. Получить список интервью → запомнить ID
curl http://localhost:3000/api/interviews | jq '.[0].id'

# 4. Посмотреть доступные пресеты
curl http://localhost:3000/api/presets | jq .

# 5. Применить пресет (подставить ID из шага 3)
curl -X POST http://localhost:3000/api/interviews/<ID>/apply-preset \
  -H "Content-Type: application/json" \
  -d '{"preset": "screening"}' | jq .

# 6. Сгенерировать keywords из CV+JD (нужен OPENAI_API_KEY)
curl -X POST http://localhost:3000/api/interviews/<ID>/generate-keywords | jq .keywords

# 7. Активировать интервью
curl -X POST http://localhost:3000/api/interviews/<ID>/activate | jq '{id, status, is_active}'

# 8. Получить активное интервью (Extension использует этот endpoint)
curl http://localhost:3000/api/interviews/active | jq '{id, candidate_name, job_title, goals: [.goals[].type], keywords}'

# 9. Ручная правка целей — выключить одну цель
curl -X PUT http://localhost:3000/api/interviews/<ID>/goals \
  -H "Content-Type: application/json" \
  -d '{"goals": [{"type":"assess_hard_skills_screening","enabled":true},{"type":"time_management","enabled":true,"config":{"max_min":30,"warn_min":23}}]}' | jq .goals
```

### Быстрый тест без OpenAI

Шаги 1-5, 7-8 работают без API-ключа. Шаг 6 (generate-keywords) требует `OPENAI_API_KEY` в env.
