# Track 3: Chrome Extension UI — Статус

**Трек:** Overlay поверх Meet, popup, goals checklist, keywords chips, mock stream
**Агент пишет сюда:** обновления прогресса, решения, блокеры

---

## Что сделано

- [x] `chrome-extension/content.js` — overlay на Google Meet, транскрипт, базовые hints
- [x] `chrome-extension/background.js` — tabCapture, relay событий
- [x] `chrome-extension/popup.js` / `popup.html` — Start/Stop кнопка, статус
- [x] `chrome-extension/offscreen.js` — MediaRecorder, WebSocket к backend
- [x] `chrome-extension/lib/goals-checklist-renderer.js` — рендер goals как чеклиста
- [x] `chrome-extension/lib/keyword-chips-renderer.js` — рендер ключевиков как тегов
- [x] `chrome-extension/mock-transcript-stream.js` — генератор mock TranscriptEvent для UI разработки без backend
- [x] `chrome-extension/overlay.css` — базовые стили

---

## В процессе / Следующее

- [ ] **Активные подсказки прилипают к верху** — hints стекаются вверху overlay, устаревшие/выполненные уходят вниз или скрываются
- [ ] **Анимация появления hints** — плавный fade-in/slide при новой подсказке
- [ ] **Goals toggle в overlay** — клик на цель включает/выключает её в реальном времени (POST к API)
- [ ] **Speaker labels**: рекрутер синий, кандидат зелёный в транскрипте
- [ ] **Popup "Attach Interview"** — dropdown со списком интервью из `GET /api/interviews`, выбор активного
- [ ] **Auto-attach по Meet URL** — при старте захвата popup проверяет URL вкладки → находит интервью → подгружает goals + keywords
- [ ] **Ссылка на web dashboard** в popup
- [ ] **Drag & drop overlay** — перемещение виджета по экрану

---

## UX важные решения

- **Пресеты в popup**: выбор методологии (Screening / Deep Technical / Culture Fit / Leadership / Full) перед звонком
- **Начало звонка**: отдельная подсказка "Договоритесь что перебивать — это норм" как универсальный старт
- **Конкуренты**: мгновенно появляется подсказка при упоминании конкурента (competitor_research goal)
- **Таймер**: если включён time_saving goal — таймер виден в overlay всегда

---

## Открытые вопросы

- Overlay размер: фиксированный или resizable?
- На каком углу overlay по умолчанию (правый нижний или правый верхний)?
- Сколько hints показывать одновременно максимум?
- Нужен ли collapse/expand overlay (кнопка свернуть)?

---

## Зависимости

- Track 0: `GET /api/interviews`, `GET /api/interviews/active` — для popup attach
- Track 2: TranscriptEvent поток через WebSocket — hints, keywords, goal_update
- Track 1: audio_level события для progress bar

---

## Заметки для других агентов

- Extension загружается через `chrome://extensions` → Load unpacked → `chrome-extension/`
- Mock режим: в content.js переключить на `mock-transcript-stream.js` для тестов без backend
- Manifest V3, offscreen API для MediaRecorder
- `chrome-extension/audio-capture-contract.js` — не менять без согласования с Track 1
