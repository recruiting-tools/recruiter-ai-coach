# Recruiter AI Coach

Native macOS app — реальтайм AI-коуч для рекрутёра во время интервью.

Слушает микрофон + системный аудио (Zoom, Teams, Google Meet), транскрибирует в реальном времени и показывает подсказки поверх экрана: следующий вопрос из плана, уточнения, проверка глубины знаний кандидата.

---

## Скачать и запустить

### Требования
- macOS 13 Ventura или новее
- API ключи: [Deepgram](https://deepgram.com) (транскрипция) + [OpenRouter](https://openrouter.ai) (AI подсказки)

### Установка

1. **Скачай** архив со страницы [Releases](../../releases)
2. **Разархивируй** — появится `CallTips.app`
3. **Перемести** в папку `/Applications`
4. **Первый запуск** — приложение не подписано, поэтому:
   - Не двойной клик, а **правая кнопка мыши → Открыть**
   - В диалоге нажми «Открыть» — это единственный раз, дальше запускается как обычно
5. **Добавь API ключи** — создай файл `.env` в папке `/Applications/CallTips.app/Contents/Resources/`:

```
DEEPGRAM_API_KEY=your_deepgram_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
```

6. **Разреши доступ** при первом запуске:
   - Микрофон — системный диалог
   - Запись экрана → Системные настройки → Конфиденциальность → Запись экрана → добавить Call Tips

---

## Как пользоваться

1. Кликни на иконку 👤+ в строке меню → **Показать / скрыть**
2. Заполни форму: имя кандидата, резюме (текст / PDF / URL hh.ru), описание вакансии
3. Нажми **Создать план интервью** — AI составит план с вопросами под конкретного кандидата
4. Нажми **Начать звонок** — появится floating HUD поверх Zoom/Teams
5. HUD показывает:
   - Следующий вопрос из плана
   - Уточняющий вопрос если кандидат ответил размыто
   - Проверочный вопрос на глубину знаний

---

## Собрать из исходников

```bash
git clone https://github.com/recruiting-tools/recruiter-ai-coach
cd recruiter-ai-coach

# API ключи
cp .env.example .env
# отредактируй .env — добавь свои ключи

# Запуск
swift run
```

Иконка 👤+ появится в строке меню.

---

## Архитектура

```
Mic + System Audio → Deepgram WebSocket → Transcript → Claude (via OpenRouter) → Tip overlay
```

| Файл | Роль |
|------|------|
| `CallController.swift` | Оркестратор: стартует/стопает всё |
| `MicCapture.swift` | AVAudioEngine → 16kHz PCM |
| `SpeakerCapture.swift` | ScreenCaptureKit → системное аудио |
| `DeepgramClient.swift` | WebSocket стриминг → текст |
| `CoachEngine.swift` | OpenRouter (Gemini Flash) → подсказки |
| `InterviewPlanEngine.swift` | Генерация плана интервью |
| `RecruiterSetupView.swift` | Форма настройки перед звонком |
| `OverlayView.swift` | Floating HUD поверх Zoom/Teams |

## Stack

- Swift 5.9 / SwiftUI / macOS 13+
- Deepgram nova-2 (транскрипция, два WebSocket: mic + speakers)
- Gemini 2.5 Flash Lite via OpenRouter (AI подсказки, ~300ms)
- ScreenCaptureKit (системное аудио, требует Screen Recording permission)

## Claude Code Instructions

### Правила
- Вся бизнес-логика промптов — только в `AI/CoachEngine.swift`
- Не добавлять зависимостей (SPM пакетов) без явной причины — Foundation + AVFoundation + ScreenCaptureKit достаточно
- API ключи только через env vars, не хардкодить
