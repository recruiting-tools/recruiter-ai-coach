# Track 4: Web Dashboard — Статус

**Трек:** React SPA, мастер создания интервью, мобильная версия, live поллинг
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

### Iteration 1 — Scaffold + Live Page ✅ (2026-03-22)
- [x] `dashboard/` — Vite + React (v19) + React Router v7, proxy `/api → http://localhost:3000`
- [x] `GET /live` — страница live-view: мобильная, polling каждые 4 сек
  - Последняя подсказка отображается крупно вверху (20px, зелёный блок)
  - До 2 предыдущих подсказок — серым ниже
  - Последние 5 реплик транскрипта с именем спикера
  - Статус-бейдж: LIVE / connecting / нет сессии / ошибка
- [x] Backend: `GET /api/sessions/current/live` → 3 последних hint + 5 сегментов из последней активной сессии
- [x] Роутер: `*` → redirect на `/live`; структура готова для добавления новых страниц

### Технические решения
- Vite proxy к `:3000` (сервер слушает на `PORT || 3000`, не 3001!)
- React Router v7 через `BrowserRouter` в `main.jsx`
- Polling через `setInterval` в `useEffect`, cleanup при размонтировании
- Endpoint `/api/sessions/current/live` берёт последнюю сессию из `sessions` Map (не требует знать sessionId)

---

## В процессе / Следующее

### Iteration 2 — Home + Interview Wizard с пресетами/методологиями
- [ ] `GET /` → Home: список всех интервью (`GET /api/interviews`)
- [ ] `GET /interviews/new` → Мастер создания интервью (шаги ниже):
  1. **CV + JD** — загрузка/вставка текста резюме и описания вакансии
  2. **Пресет** — выбор пресета (Screening / Deep Technical / Culture Fit / Leadership / Full / Custom)
     - Показать описание и рекомендуемое время
     - При выборе — автозаполнение целей (`POST /api/interviews/:id/apply-preset`)
  3. **Методология** — опциональный выбор (STAR / Behavioral / Situational / Topgrading / Competency-Based / Case)
     - Краткое описание как влияет на подсказки
     - `PUT /api/interviews/:id/methodology`
  4. **Кастомизация целей** — список целей из пресета с чекбоксами:
     - Можно отжать галку у любой цели
     - Можно добавить произвольную цель текстом ("Спросить про опыт с Kafka")
     - `PATCH /api/interviews/:id/goals/:goalId` для toggle
     - `POST /api/interviews/:id/goals/custom` для кастомных целей
  5. **Keywords** — авто-генерация из CV+JD (`POST /api/interviews/:id/generate-keywords`) + ручная правка
  6. **Обзор + Старт** — итоговый экран: кандидат, вакансия, цели, методология → "Активировать"
- [ ] `GET /interviews/:id` → Детали: prep kit, keywords, goals, методология, кнопка "Активировать"
- [ ] Навигация: хедер с ссылками Home / Live

### Iteration 3 — Улучшения Live View
- [ ] WebSocket режим вместо polling (Socket.IO или raw WS)
- [ ] Post-call страница `GET /sessions/:id` — полный транскрипт, timeline
- [ ] Счётчик времени сессии в хедере
- [ ] Auto-scroll транскрипта при новых репликах

---

## UX важные решения

- Dashboard открывается на отдельной вкладке или мониторе
- Mobile live view = второй экран рекрутера (телефон рядом с ноутбуком)
- Тёмная тема — оптимально для разных условий освещения
- Prep kit читается за 5-10 мин перед звонком
- Ссылка на dashboard доступна из popup Extension одной кнопкой

---

## Открытые вопросы

- Аутентификация: пока без auth (localhost), добавить simple token позже
- Деплой: backend на Railway + dashboard как static на Netlify/Vercel?
- Переход на WebSocket вместо polling — когда это станет приоритетом?
- Добавить тост-уведомление при появлении новой подсказки?

---

## Зависимости

- Track 0: все REST API (`/api/candidates`, `/api/jobs`, `/api/interviews`) должны работать — нужно для Iteration 2
- Track 2: `GET /api/sessions/current/live` — добавлен в backend/src/server.js, работает с существующим `hintsBuffer`
- Track 1/2: WebSocket для real-time режима (Iteration 3)

---

## Как запустить

```bash
cd dashboard
npm run dev     # http://localhost:5173/live
```

Backend должен быть запущен на `:3000`:
```bash
cd backend && node src/server.js
```

---

## Заметки для других агентов

- **Track 2**: endpoint `/api/sessions/current/live` добавлен в `backend/src/server.js` (перед `/api/session/:sessionId/hints`). Возвращает последние 3 hint + 5 segments из последней активной сессии. Если `sessions` пустой — 404.
- Dashboard на dev-сервере `:5173`, proxy → `:3000`. В production — собрать `npm run build` и serve static.
