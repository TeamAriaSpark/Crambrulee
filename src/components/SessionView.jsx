import { useEffect, useState } from 'react'
import StudyView from './StudyView.jsx'
import FlashcardsView from './FlashcardsView.jsx'
import { TIPS } from '../lib/planner.js'
import { setAmbient } from '../lib/ambient.js'

const fmtSpent = (sec) => {
  if (sec < 60) return '<1 min'
  const min = Math.round(sec / 60)
  return min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`
}

// The 30/70 recommendation: spend the first ~30% of the session reading,
// the rest pulling it back out.
export function sessionRecommendation(session, now = Date.now()) {
  const start = new Date(session.startedAt).getTime()
  const end = new Date(session.until).getTime()
  const progress = (now - start) / Math.max(end - start, 1)
  return progress < 0.3 ? 'study' : 'recall'
}

export default function SessionView({
  session,
  breakTimer,
  timeSpent,
  versions,
  activeVersion,
  onPickVersion,
  onMode,
  onEnd,
  onTest,
  onBreakStart,
  onBreakExtend,
  onBreakEnd,
  onBreakSkip,
}) {
  const now = Date.now()
  const over = new Date(session.until) <= now
  const breakRunning = breakTimer && new Date(breakTimer.until) > now
  const breakOver = breakTimer && !breakRunning
  const breakDue = !over && !breakTimer && new Date(session.nextBreakAt) <= now
  const mode = session.mode || 'study'
  const recommended = sessionRecommendation(session, now)
  const version = versions[activeVersion]

  const [breakLen, setBreakLen] = useState(10)
  const breakRemaining = breakRunning
    ? Math.max(0, Math.round((new Date(breakTimer.until) - now) / 1000))
    : 0
  const mm = String(Math.floor(breakRemaining / 60))
  const ss = String(breakRemaining % 60).padStart(2, '0')
  const breakElapsedSec = breakTimer
    ? Math.round((now - new Date(breakTimer.startedAt)) / 1000)
    : 0
  const tip = TIPS[Math.floor(breakElapsedSec / 40) % TIPS.length]

  // Ambient music is synthesized locally; stop it when the session unmounts.
  const [music, setMusic] = useState('off')
  useEffect(() => {
    setAmbient(music)
    return () => setAmbient('off')
  }, [music])

  const other = mode === 'study' ? 'recall' : 'study'
  const headerExtra = (
    <div className="session-tools">
      <button className="mode-switch" onClick={() => onMode(other)}>
        {other === 'recall' ? 'Switch to active recall 🧠' : 'Switch to studying 📖'}
        {recommended === other && <span className="mode-rec">recommended now</span>}
      </button>
      <label className="music-pick" title="Ambient study music, cooked up right in your browser">
        <span>🎵</span>
        <select value={music} onChange={(e) => setMusic(e.target.value)}>
          <option value="off">music off</option>
          <option value="lofi">📻 lo-fi pad</option>
          <option value="rain">🌧️ rain</option>
          <option value="waves">🌊 waves</option>
          <option value="focus">🟤 deep focus</option>
        </select>
      </label>
    </div>
  )

  return (
    <>
      {mode === 'study' ? (
        <StudyView
          embedded
          headerExtra={headerExtra}
          version={version}
          versions={versions}
          activeVersion={activeVersion}
          onPickVersion={onPickVersion}
          onFinish={() => onMode('recall')}
          onBack={onEnd}
        />
      ) : (
        <FlashcardsView
          embedded
          headerExtra={headerExtra}
          version={version}
          versions={versions}
          activeVersion={activeVersion}
          onPickVersion={onPickVersion}
          onFinish={() => onMode('study')}
          onBack={onEnd}
        />
      )}

      {(over || breakDue || breakRunning || breakOver) && (
        <div className="session-overlay">
          <div className="overlay-card">
            {over ? (
              <>
                <h3>🎉 Session complete!</h3>
                <p className="muted">
                  {fmtSpent(
                    Math.max(
                      0,
                      (timeSpent?.study || 0) +
                        (timeSpent?.active || 0) -
                        (session.base ? session.base.study + session.base.active : 0)
                    )
                  )}{' '}
                  of real work in
                  the books. Lock it in with a practice test — it rebuilds your materials around
                  what you missed.
                </p>
                <div className="step-row" style={{ justifyContent: 'center' }}>
                  <button className="btn" onClick={onTest}>
                    Take the practice test 🔥
                  </button>
                  <button className="btn ghost" onClick={onEnd}>
                    Back to plan
                  </button>
                </div>
              </>
            ) : breakRunning ? (
              <>
                <h3>
                  ☕ Break — {mm}:{ss}
                </h3>
                <p className="muted small">
                  {tip.emoji} <strong>{tip.tip}.</strong> {tip.why}
                </p>
                <div className="step-row" style={{ justifyContent: 'center' }}>
                  <button className="btn ghost small-btn" onClick={onBreakExtend}>
                    +5 min
                  </button>
                  <button className="btn small-btn" onClick={onBreakEnd}>
                    Back to it 🔥
                  </button>
                </div>
              </>
            ) : breakOver ? (
              <>
                <h3>⏰ Break’s over!</h3>
                <div className="step-row" style={{ justifyContent: 'center' }}>
                  <button className="btn" onClick={onBreakEnd}>
                    Back to it 🔥
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>☕ Time for a break</h3>
                <p className="muted small">
                  You’ve been at it {session.breakEveryMin} minutes — resting is when your brain
                  locks in what you just learned.
                </p>
                <div className="step-row" style={{ justifyContent: 'center' }}>
                  {[5, 10, 15].map((m) => (
                    <button
                      key={m}
                      className={`preset-chip ${m === breakLen ? 'selected' : ''}`}
                      onClick={() => {
                        setBreakLen(m)
                        onBreakStart(m)
                      }}
                    >
                      {m} min
                    </button>
                  ))}
                  <button className="btn ghost small-btn" onClick={onBreakSkip}>
                    Skip — keep going
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
