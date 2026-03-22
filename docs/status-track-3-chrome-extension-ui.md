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

### Итерация 2 (2026-03-22)

- [x] **WebSocket к `ws://localhost:3001/ws/events`** в content.js — получение TranscriptEvent от бэкенда напрямую в content script
  - Экспоненциальный backoff при реконнекте (500ms → 30s)
  - WS dot-индикатор в заголовке overlay (серый/жёлтый/зелёный)
  - keyword_detected, goal_update, hint, timer_update теперь работают
- [x] **Sticky hints UX** — активная подсказка прилипает к верху overlay
  - Новая подсказка анимированно появляется сверху (slide-in)
  - Старая уходит с exit-анимацией (slide-out)
  - Кнопка ✕ для ручного dismiss
  - Авто-dismiss через 15 секунд
  - Цветовые типы: llm (фиолетовый), goal_check (синий), competence_phrase (зелёный), time_warning (жёлтый)
- [x] **Mock mode** — переключён на `window.__RAC_MockStream.startMockStream()` (loop mode)
  - Больше не дублирует события inline в content.js
  - Использует готовый модуль из `mock-transcript-stream.js`

---

## Архитектура событий (итерация 2)

```
Два потока событий в content.js:

1. background.js → chrome.runtime.onMessage
   (audio_level, transcript_interim, transcript_final, hint)
   — из offscreen.js через ws/audio ответы

2. ws://localhost:3001/ws/events → WebSocket onmessage
   (hint, keyword_detected, goal_update, timer_update, transcript_*)
   — прямой push-канал от бэкенда

Потенциальное дублирование transcript/hint через оба канала —
зависит от реализации бэкенда. Если нужно, можно дедуплицировать
по timestamp+type в handleEvent().
```

---

## В процессе / Следующее

- [ ] **Goals toggle в overlay** — клик на цель включает/выключает её в реальном времени (POST к API)
- [ ] **Speaker labels**: рекрутер синий, кандидат зелёный в транскрипте (UI готов, нужны данные от Track 1)
- [ ] **Popup "Attach Interview"** — dropdown со списком интервью из `GET /api/interviews`, выбор активного
- [ ] **Auto-attach по Meet URL** — при старте захвата popup проверяет URL вкладки → находит интервью → подгружает goals + keywords
- [ ] **Ссылка на web dashboard** в popup
- [ ] **Drag & drop overlay** — перемещение виджета по экрану (базовый drag уже есть)
- [ ] **Дедупликация событий** — если бэкенд шлёт события на оба канала (ws/audio + ws/events)
- [ ] **Анимация появления keywords** — уже есть glow, возможно добавить счётчик появлений

---

## UX важные решения

- **Sticky hint зона**: `position: sticky; top: 0` внутри `#rac-body` — hint виден всегда при скролле
- **Пресеты в popup**: выбор методологии (Screening / Deep Technical / Culture Fit / Leadership / Full) перед звонком
- **Начало звонка**: отдельная подсказка "Договоритесь что перебивать — это норм" как универсальный старт
- **Конкуренты**: мгновенно появляется подсказка при упоминании конкурента (competitor_research goal)
- **Таймер**: если включён time_saving goal — таймер виден в overlay всегда

---

## Открытые вопросы

- Нужен ли `ws/events` endpoint на бэкенде или бэкенд шлёт всё через `ws/audio`? (влияет на Track 2)
- Overlay размер: фиксированный или resizable?
- Сколько hints показывать одновременно максимум? (сейчас: 1 active + exit animation)
- Нужен ли collapse/expand overlay (кнопка свернуть)?

---

## Зависимости

- Track 0: `GET /api/interviews`, `GET /api/interviews/active` — для popup attach
- Track 2: TranscriptEvent поток через WebSocket — hints, keywords, goal_update
  - **Нужно уточнить**: реализован ли endpoint `ws://localhost:3001/ws/events` на бэкенде?
- Track 1: audio_level события для progress bar

---

## Заметки для других агентов

- Extension загружается через `chrome://extensions` → Load unpacked → `chrome-extension/`
- Mock режим: добавь `?mock` к URL любой страницы Meet ИЛИ открой test HTML с `window.__RAC_MOCK = true`
- Manifest V3, offscreen API для MediaRecorder
- `chrome-extension/audio-capture-contract.js` — не менять без согласования с Track 1
- **Track 2**: content.js ожидает `ws://localhost:3001/ws/events` с TranscriptEvent — нужно создать этот WS endpoint на бэкенде если его ещё нет
