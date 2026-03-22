## Naming Convention

Называй файлы предметно и конкретно — длинные понятные имена лучше коротких абстрактных. Например:
- `recruiter-ai-coach-product-architecture.md` вместо `ARCHITECTURE.md`
- `vosk-keyword-spotter-tz.md` вместо `TZ.md`
- `interview-goals-engine.js` вместо `goals.js`

---

## Multi-Agent Workflow

Над этим проектом параллельно работают 4-6 агентов. Каждый агент отвечает за свой трек.

### Структура документов

```
docs/
  recruiter-ai-coach-master-plan.md        ← общий план, цель, архитектура (не редактировать часто)
  status-track-0-interview-setup.md        ← Track 0: SQLite, REST API, Goals config
  status-track-1-audio-capture.md          ← Track 1: Chrome tabCapture, Deepgram, Vosk
  status-track-2-intelligence-hints.md     ← Track 2: GPT-4o hints, Goals engine
  status-track-3-chrome-extension-ui.md   ← Track 3: Overlay UI, popup, extension
  status-track-4-web-dashboard.md          ← Track 4: React SPA, mobile live view
```

### Правило работы агента

**В начале итерации:**
1. Прочитай `docs/recruiter-ai-coach-master-plan.md` — понять общую картину
2. Прочитай свой status-файл — понять где остановился предыдущий агент
3. Прочитай status-файлы смежных треков — проверить что изменилось у "соседей", нет ли блокеров или новых данных от них

**Во время работы:**
- Пиши только в свой трек (свои файлы в backend/src/, chrome-extension/, dashboard/)
- Не трогай файлы другого трека без явной необходимости
- Если нужно что-то от другого трека — пиши вопрос/блокер в свой status-файл

**В конце итерации:**
1. Обнови свой status-файл: перенеси завершённые задачи в "Сделано", обнови "Следующее", добавь новые открытые вопросы
2. Если сделал что-то что влияет на соседний трек — добавь заметку в конец его status-файла

### Data contracts между треками

Все треки обмениваются через типизированные структуры. Контракты в: `docs/recruiter-ai-coach-parallel-build-plan.md`
- `InterviewConfig` — Track 0 → Track 2, 3
- `AudioFrame` — Track 1 → Track 2
- `TranscriptEvent` — Track 2 → Track 3, 4

### Моки для независимой работы

Каждый трек может работать с моками пока другой не готов:
- Track 3 без Track 2: использовать `chrome-extension/mock-transcript-stream.js`
- Track 2 без реального аудио: `node scripts/simulate-interview-with-goals.js`
- Track 4 без реальных данных: `node scripts/seed-mock-interviews.js` + polling mock endpoint

<!-- teamhub:siblings:start -->
## Related Projects (recruiting)

These projects are part of the same pipeline. Check them when your changes may affect these systems:

- **candidate-routing** (`/Users/vova/Documents/GitHub/candidate-routing`) — Email маршрутизация кандидатов, Cloudflare Worker, admin UI
- **interview-engine** (`/Users/vova/Documents/GitHub/interview-engine`) — Видео-интервью, оценка кандидатов, AI scoring
- **job-creation** (`/Users/vova/Documents/GitHub/job-creation`) — Создание вакансий, текст для hh.ru и LinkedIn, FAQ для кандидатов
- **candidate-bot** (`/Users/vova/Documents/GitHub/candidate-bot`) — Telegram бот для кандидатов, переписка, определение намерений
- **skillset-candidate-bot** (`/Users/vova/Documents/GitHub/skillset-candidate-bot`) — Синтетический кандидат для тестирования видео-интервью через Daily.co
- **skillset-prompts** (`/Users/vova/Documents/GitHub/skillset-prompts`) — Коллекция промптов core API: оценка CV, поиск, нормализация
- **job_posting** (`/Users/vova/Documents/GitHub/job_posting`) — Публикация вакансий на hh.ru через API
- **linkedin-messenger** (`/Users/vova/Documents/GitHub/linkedin-messenger`) — Программный доступ к LinkedIn-сообщениям через Chrome DevTools
- **linkedin-job-posting-prompts** (`/Users/vova/Documents/GitHub/linkedin-job-posting-prompts`) — Гайды и промпты для публикации вакансий на LinkedIn
- **inbox-processing** (`/Users/vova/Documents/GitHub/inbox-processing`) — Обработка входящих сообщений из Telegram через AI
- **enrichment-api-research** (`/Users/vova/Documents/GitHub/enrichment-api-research`) — Исследование API обогащения контактов: Explee, Lusha
- **generate-video-questions-for-candidates** (`/Users/vova/Documents/GitHub/generate-video-questions-for-candidates`) — Генерация видео-вопросов для интервью с TTS и lip-sync
- **skillset-apply-job-bff** (`/Users/vova/Documents/GitHub/skillset-apply-job-bff`) — BFF-сервер для страницы подачи заявки на вакансию
- **skillset-apply-job** (`/Users/vova/Documents/GitHub/skillset-apply-job`) — Фронтенд страницы подачи заявки кандидатом на вакансию

<!-- teamhub:siblings:end -->
