# ТЗ: Vosk Keyword Spotter — мгновенное распознавание ключевиков

## Цель

Добавить параллельный канал распознавания речи через **Vosk** (офлайн, бесплатно) для мгновенного детекта ключевых слов из резюме и вакансии. Работает рядом с Deepgram, не заменяет его.

## Архитектура

```
Chrome Extension (без изменений в захвате аудио)
        ↓ WebSocket (аудио чанки, как сейчас)
Node.js сервер
        ├→ Deepgram (полная транскрипция, как сейчас)
        └→ Vosk (keyword spotting, НОВОЕ)
                ↓
        Оба отправляют результаты обратно в расширение
```

### Два независимых потока данных:

| Поток | Источник | Что делает | Латенси | Стоимость |
|-------|----------|------------|---------|-----------|
| **Транскрипция** | Deepgram | Полный текст речи → контекст для LLM → подсказки | 300-500ms | платно |
| **Ключевики** | Vosk | Ловит слова из заданного списка → мгновенный триггер | <100ms | бесплатно |

## Что нужно сделать

### 1. Подготовка ключевиков (новый endpoint)

**`POST /api/session/prepare-keywords`**

Вход:
```json
{
  "candidateCV": "текст резюме или ссылка",
  "jobDescription": "текст вакансии",
  "language": "ru"  // ru | en | ar
}
```

Логика:
- Отправить CV + JD в OpenAI (gpt-4o)
- Промпт: "Извлеки 30-50 ключевых слов и коротких фраз которые кандидат может произнести на собеседовании. Включи: технологии, инструменты, компании, роли, soft skills, бизнес-термины. Верни JSON массив."
- Пример выхода: `["kubernetes", "CI/CD", "team lead", "микросервисы", "нагрузка", "SLA", "релиз"]`
- Сохранить в сессию: `session.keywords = [...]`
- Вернуть список клиенту для отображения

### 2. Vosk сервер (новый модуль)

**Файл: `backend/src/vosk-spotter.js`**

- Установить: `npm install vosk`
- Скачать модели:
  - `vosk-model-small-ru-0.22` (~45MB) — русский
  - `vosk-model-small-en-us-0.15` (~40MB) — английский
  - `vosk-model-ar-0.22-linto` (~75MB) — арабский
- Модели хранить в `backend/models/` (добавить в .gitignore)

Класс `VoskSpotter`:
```javascript
class VoskSpotter {
  constructor(language = 'ru') {
    // Загрузить модель по языку
  }

  setKeywords(keywords) {
    // Установить грамматику: keywords + "[unk]"
    // Пересоздать recognizer с новой грамматикой
  }

  feedAudio(pcmBuffer) {
    // Принять PCM 16-bit 16kHz mono
    // Вернуть распознанные слова если есть
  }

  onKeywordDetected(callback) {
    // Коллбэк когда слово из списка распознано
    // { keyword: "kubernetes", confidence: 0.85, timestamp: ... }
  }
}
```

### 3. Конвертация аудио

**Проблема:** Chrome отдаёт WebM/Opus, Vosk принимает PCM 16-bit 16kHz mono.

**Решение:** `ffmpeg` как child process или библиотека `prism-media` / `opus-decoder`:
```
WebM/Opus chunks → FFmpeg pipe → PCM 16kHz mono → Vosk
```

Можно использовать один конвертер для обоих потоков, но Deepgram принимает WebM напрямую, так что конвертация нужна только для Vosk.

### 4. Интеграция в server.js

В обработчике WebSocket `/ws/audio`:
```javascript
// Существующий код — Deepgram
dg.sendAudio(rawChunk);

// НОВОЕ — Vosk
const pcm = await convertToPCM(rawChunk);
const result = voskSpotter.feedAudio(pcm);
if (result.keyword) {
  // Отправить в расширение
  ws.send(JSON.stringify({
    type: 'keyword_detected',
    keyword: result.keyword,
    confidence: result.confidence,
    timestamp: Date.now()
  }));
}
```

### 5. UI в расширении (content.js)

Добавить **отдельную секцию** в оверлей для ключевиков:

```
┌─────────────────────────────┐
│ 🎙 AI Coach                 │
├─────────────────────────────┤
│ Транскрипция (Deepgram):    │
│ "...рассказывал про опыт в  │
│ компании где мы делали..."  │
├─────────────────────────────┤
│ 🏷 Ключевики:               │
│ [kubernetes] [Docker] [AWS] │
│ [team lead] [CI/CD]         │
│                             │
│ Последний: "микросервисы"   │
│ 3 сек назад                 │
├─────────────────────────────┤
│ 💡 Подсказка:               │
│ "Спросите про масштаб..."   │
└─────────────────────────────┘
```

Поведение:
- Ключевики появляются как теги/чипсы
- Новый тег подсвечивается на 3 сек
- Уже упомянутые слова — серые, новые — яркие
- Можно кликнуть на тег → получить объяснение (что это, зачем спрашивать)

### 6. Новый тип WebSocket сообщения

```javascript
// Сервер → Расширение
{ type: 'keyword_detected', keyword: 'kubernetes', confidence: 0.85 }

// Сервер → Расширение (объяснение по клику)
{ type: 'keyword_explanation', keyword: 'kubernetes', explanation: '...' }

// Расширение → Сервер (запрос объяснения)
{ type: 'explain_keyword', keyword: 'kubernetes' }
```

### 7. Генерация объяснений

Когда рекрутер кликает на тег — отправить в OpenAI:
```
Промпт: "Кандидат упомянул '{keyword}' на собеседовании на роль {role}.
Контекст вакансии: {jobDescription краткое}
Объясни рекрутеру:
1. Что это такое (1 предложение, простым языком)
2. Почему важно для этой роли
3. Уточняющий вопрос который стоит задать"
```

## Порядок реализации

1. **Установить Vosk + скачать модель** — проверить что работает локально
2. **Конвертер WebM→PCM** — ffmpeg pipe
3. **VoskSpotter класс** — keyword grammar + feedAudio
4. **Endpoint prepare-keywords** — CV+JD → список ключей
5. **Интеграция в audio WebSocket** — параллельный поток
6. **UI в content.js** — секция тегов
7. **Объяснения по клику** — LLM endpoint

## Скачивание моделей

```bash
cd backend
mkdir -p models && cd models

# Русский (~45MB)
wget https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip
unzip vosk-model-small-ru-0.22.zip

# Английский (~40MB)
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip

# Арабский (~75MB)
wget https://alphacephei.com/vosk/models/vosk-model-ar-0.22-linto-1.1.0.zip
unzip vosk-model-ar-0.22-linto-1.1.0.zip
```

## Конфигурация (.env)

```
# Vosk (новое)
VOSK_MODEL_PATH=./models        # путь к моделям
VOSK_DEFAULT_LANG=ru            # язык по умолчанию
```

## Зависимости (новые)

```bash
npm install vosk
# ffmpeg должен быть установлен в системе (brew install ffmpeg)
```
