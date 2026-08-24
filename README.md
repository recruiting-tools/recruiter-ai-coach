# Call Tips

Native macOS app — реальтайм AI-коуч для любых звонков.

## Архитектура

```
Audio (mic + speakers) → Deepgram WebSocket → Transcript → Claude API → Tip overlay
```

| Файл | Роль |
|------|------|
| `CallController.swift` | Оркестратор: стартует/стопает всё |
| `MicCapture.swift` | AVAudioEngine → 16kHz PCM |
| `SpeakerCapture.swift` | ScreenCaptureKit → системное аудио |
| `DeepgramClient.swift` | WebSocket стриминг → текст |
| `CoachEngine.swift` | Claude API → подсказка |
| `CallSession.swift` | State: тип звонка, цели, транскрипт, типсы |
| `PreCallView.swift` | Экран настройки перед звонком |
| `OverlayView.swift` | Floating HUD поверх Zoom/Teams |

## Запуск

### Переменные окружения
```bash
export DEEPGRAM_API_KEY=your_key
export CLAUDE_API_KEY=your_key
```

### Build & Run
```bash
# Открыть в Xcode:
open Package.swift

# Или из терминала:
swift run
```

### Permissions (первый запуск)
- **Microphone** — системный диалог при старте
- **Screen Recording** → System Settings → Privacy & Security → Screen Recording → добавить Call Tips

## Что настроить дальше

- `CoachEngine.swift` → `buildPrompt()` — промпты под каждый тип звонка
- `CallController.swift` → `maybeFetchTip()` — триггеры когда запрашивать подсказку
- `OverlayView.swift` — дизайн HUD, позиционирование на экране

## Claude Code Instructions

### Stack
- Swift 5.9 / SwiftUI / macOS 13+
- ScreenCaptureKit для системного аудио (требует Screen Recording permission)
- Deepgram nova-2 для транскрипции (два отдельных WebSocket: mic + speakers)
- Claude API для коучинга

### Правила
- Вся бизнес-логика промптов — только в `AI/CoachEngine.swift`
- Не добавлять зависимостей (SPM пакетов) без явной причины — Foundation + AVFoundation + ScreenCaptureKit достаточно
- API ключи только через env vars, не хардкодить
