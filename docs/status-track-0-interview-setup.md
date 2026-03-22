# Track 0: Interview Setup — Статус

**Трек:** Управление интервью, CV/JD, цели, ключевые слова, SQLite, REST API
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `backend/src/interview-config-db.js` — SQLite schema: candidates, jobs, interviews, sessions, transcript_segments, hints, keywords_detected
- [x] `backend/src/routes/interview-config-routes.js` — REST CRUD: POST/GET candidates, jobs, interviews; PUT goals; POST bind-meet; GET by-meet-url
- [x] `scripts/seed-mock-interviews.js` — сид с тестовыми данными (2 кандидата, 1 вакансия, 1 интервью)
- [x] Подключено в `server.js`: `app.use('/api', interviewConfigRoutes)`

---

## В процессе / Следующее

- [ ] `POST /api/interviews/:id/generate-keywords` — CV+JD → GPT-4o → keywords[] (нужно подключить к claude.js)
- [ ] `POST /api/interviews/:id/activate` — сделать интервью активным для следующего звонка
- [ ] `GET /api/interviews/active` — получить текущее активное интервью (нужен Extension)
- [ ] Auto-bind: проверить что `GET /api/interviews/by-meet-url?url=...` работает из extension
- [ ] Пресеты целей (Screening, Deep Technical, Culture Fit, Leadership, Full) — factory в db.js

---

## Открытые вопросы

- **Пресеты**: отдельный `POST /api/interviews/:id/apply-preset` или через `PUT goals` с preset_name?
- **SQLite migrations**: создаётся при старте — нужны ли версионированные миграции?
- **Goals runtime state**: `addressed`/`addressed_at` хранить в interviews.goals JSON или отдельная таблица?

---

## Зависимости

- Track 2 использует `Goal[]` из этого трека — формат должен быть стабильным
- Track 3 (Extension) делает `GET /api/interviews/active` — endpoint нужен рабочим
- Track 4 (Dashboard) строит wizard на базе этих API

---

## Заметки для других агентов

- SQLite файл: `backend/data/coach.db` (gitignored)
- Запуск: `cd backend && node src/server.js`
- Тест API: `curl http://localhost:3001/api/interviews`
- Seed: `node scripts/seed-mock-interviews.js`
