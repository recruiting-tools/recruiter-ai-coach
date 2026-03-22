# Track 4: Web Dashboard — Статус

**Трек:** React SPA, мастер создания интервью, мобильная версия, live поллинг
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [ ] Ничего ещё не сделано — трек не начат

---

## В процессе / Следующее

### Iteration 1 — Скелет
- [ ] Инициализация: `dashboard/` — Vite + React + React Router
- [ ] `GET /dashboard` → Home: список интервью, кнопка "+ Новое"
- [ ] `GET /dashboard/interviews/new` → Мастер создания (шаги: CV → JD → Goals → Keywords)
- [ ] `GET /dashboard/interviews/:id` → Детали: prep kit, keywords, goals, кнопка "Активировать"
- [ ] Подключение к backend REST API (`http://localhost:3001/api/*`)

### Iteration 2 — Подготовка
- [ ] **Goals wizard**: выбор пресета (Screening / Deep Technical / Culture Fit / Leadership / Full) → или ручная сборка целей из каталога
- [ ] **Keywords**: отображение сгенерированных ключевых слов, возможность добавить/убрать вручную
- [ ] **Prep kit**: структурированный вывод от GPT-4o: вопросы по секциям, на что обратить внимание
- [ ] **Привязка Meet URL**: поле для ввода или автодетект

### Iteration 3 — Live & Mobile
- [ ] **Live страница** `GET /dashboard/sessions/current` — streaming подсказок во время звонка (для второго экрана или телефона)
  - Поллинг каждые 5 сек: `GET /api/sessions/current/live`
  - Последняя подсказка наверху крупно
  - Транскрипт последних 5 реплик
- [ ] **Post-call review** `GET /dashboard/sessions/:id` — полный транскрипт, timeline hints, статистика
- [ ] **Mobile responsive** — адаптивная верстка для телефона
- [ ] **Export** сессии в JSON/PDF

---

## UX важные решения

- Dashboard открывается на отдельной вкладке или мониторе
- Mobile live view = второй экран рекрутера (телефон рядом с ноутбуком)
- Prep kit читается за 5-10 мин перед звонком
- Ссылка на dashboard доступна из popup Extension одной кнопкой

---

## Открытые вопросы

- Нужен ли mobile web view прямо сейчас или это Iteration 3+?
- Аутентификация: пока без auth (localhost), или добавить simple token?
- Деплой: backend на Railway + dashboard как static на Netlify/Vercel?
- Стек UI: plain React или добавить TailwindCSS?

---

## Зависимости

- Track 0: все REST API (`/api/candidates`, `/api/jobs`, `/api/interviews`) должны работать
- Track 2: `GET /api/sessions/current/live` для live поллинга
- Track 1/2: WebSocket для real-time режима (если делаем WS вместо поллинга)

---

## Заметки для других агентов

- Dashboard пока не существует — начинать с нуля
- Backend уже serve'ит `/api/*` — dashboard будет на том же порту через `/dashboard`
- Или отдельный dev server Vite на :5173 с proxy к :3001
- Не трогать `backend/src/` — это территория Track 0/1/2
