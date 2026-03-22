import { useState, useEffect, useRef } from 'react'
import './LivePage.css'

const POLL_INTERVAL = 4000

export default function LivePage() {
  const [data, setData] = useState({ hints: [], segments: [] })
  const [status, setStatus] = useState('connecting') // connecting | live | no_session | error
  const [lastPoll, setLastPoll] = useState(null)
  const intervalRef = useRef(null)

  async function poll() {
    try {
      const res = await fetch('/api/sessions/current/live')
      if (res.status === 404) {
        setStatus('no_session')
        setData({ hints: [], segments: [] })
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setStatus('live')
      setLastPoll(new Date())
    } catch (err) {
      setStatus('error')
      console.error('[LivePage] poll error:', err)
    }
  }

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [])

  const latestHint = data.hints[data.hints.length - 1]
  const olderHints = data.hints.slice(0, -1).reverse()

  return (
    <div className="live-root">
      <header className="live-header">
        <span className="live-title">AI Coach</span>
        <span className={`live-badge live-badge--${status}`}>
          {status === 'live' && '● LIVE'}
          {status === 'connecting' && '○ connecting...'}
          {status === 'no_session' && '○ нет сессии'}
          {status === 'error' && '✕ ошибка'}
        </span>
      </header>

      <main className="live-main">
        {status === 'no_session' && (
          <div className="live-empty">
            <p>Нет активной сессии.</p>
            <p>Начни звонок в Chrome Extension.</p>
          </div>
        )}

        {status !== 'no_session' && (
          <>
            {/* Latest hint — big and prominent */}
            <section className="live-hint-primary">
              {latestHint ? (
                <>
                  <div className="live-hint-label">Подсказка</div>
                  <div className="live-hint-text">{latestHint.hint}</div>
                  <div className="live-hint-time">
                    {formatTime(latestHint.timestamp)}
                  </div>
                </>
              ) : (
                <div className="live-hint-placeholder">Ждём подсказку...</div>
              )}
            </section>

            {/* Previous hints */}
            {olderHints.length > 0 && (
              <section className="live-hints-older">
                {olderHints.map((h, i) => (
                  <div key={i} className="live-hint-older-item">
                    <span className="live-hint-older-time">{formatTime(h.timestamp)}</span>
                    <span className="live-hint-older-text">{h.hint}</span>
                  </div>
                ))}
              </section>
            )}

            {/* Transcript */}
            {data.segments.length > 0 && (
              <section className="live-transcript">
                <div className="live-section-title">Транскрипт</div>
                {[...data.segments].reverse().map((seg, i) => (
                  <div key={i} className="live-segment">
                    <span className="live-segment-speaker">{seg.speaker}</span>
                    <span className="live-segment-text">{seg.text}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="live-footer">
        {lastPoll && <span>обновлено {formatTime(lastPoll.toISOString())}</span>}
      </footer>
    </div>
  )
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
