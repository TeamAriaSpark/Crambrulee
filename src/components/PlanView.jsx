import { useState } from 'react'
import { TIPS, suggestSleeps } from '../lib/planner.js'

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const clockFull = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })

const fmtSpent = (sec) => {
  if (sec < 60) return '<1 min'
  const min = Math.round(sec / 60)
  return min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`
}

const tally = (sec) => (sec > 0 ? `${fmtSpent(sec)} so far` : 'not started')

const fmtIn = (iso) => {
  const min = Math.round((new Date(iso) - Date.now()) / 60000)
  if (min <= 0) return 'now'
  if (min < 60) return `in ~${min} min`
  return `in ~${Math.round(min / 6) / 10} h`
}

export default function PlanView({
  plan,
  testTime,
  results,
  timeSpent,
  breakTimer,
  countdown,
  level,
  onLevelChange,
  onStudy,
  onRecall,
  onTest,
  onBreakStart,
  onBreakExtend,
  onBreakEnd,
}) {
  const tests = plan?.tests || []
  // Backfill sleep suggestions for sessions saved before sleeps existed.
  const sleeps =
    plan?.sleeps ?? suggestSleeps(plan.startedAt, plan.finalReviewAt)
  const taken = Math.min(results.length, tests.length)
  const nextTest = tests[taken] || null

  // Proportional axis: session start → real test time.
  const axisStart = new Date(plan.startedAt).getTime()
  const axisEnd = new Date(plan.testAt || testTime).getTime()
  const span = Math.max(axisEnd - axisStart, 1)
  const pos = (iso) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - axisStart) / span) * 100))
  const nowPct = pos(new Date().toISOString())

  // Tallies of real time on each task.
  const studySec = timeSpent?.study || 0
  const activeSec = timeSpent?.active || 0
  const breakSec = timeSpent?.break || 0
  const totalSec = studySec + activeSec
  const readPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0
  const verdict =
    totalSec < 120
      ? null
      : readPct > 40
        ? 'You’re reading more than the target — switch to flashcards or a test. 🔥'
        : readPct >= 22
          ? 'Right on target. 👌'
          : 'Nicely recall-heavy. 💪'

  // Break timer state.
  const [customMin, setCustomMin] = useState(10)
  const breakRunning = breakTimer && new Date(breakTimer.until) > Date.now()
  const breakOver = breakTimer && !breakRunning
  const breakRemaining = breakRunning
    ? Math.max(0, Math.round((new Date(breakTimer.until) - Date.now()) / 1000))
    : 0
  const breakElapsedSec = breakTimer
    ? Math.round((Date.now() - new Date(breakTimer.startedAt)) / 1000)
    : 0
  const tip = breakRunning
    ? TIPS[Math.floor(breakElapsedSec / 40) % TIPS.length]
    : TIPS[(taken * 3 + new Date().getHours()) % TIPS.length]
  const mm = String(Math.floor(breakRemaining / 60))
  const ss = String(breakRemaining % 60).padStart(2, '0')
  const SUGGESTED_BREAK = 10

  // Compact time-until-test for the NOW marker.
  const leftMs = countdown?.ms ?? Math.max(0, axisEnd - Date.now())
  const leftH = Math.floor(leftMs / 3600000)
  const leftM = Math.floor((leftMs % 3600000) / 60000)
  const leftLabel = leftH > 0 ? `${leftH}h ${leftM}m left` : `${leftM}m left`

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
          <p className="muted">
            Study and quiz yourself in any order — aim for{' '}
            <strong>30% reading / 70% recall</strong>, and hit the practice tests when they come
            up.
          </p>
        </div>
        <div className="head-controls">
          <label
            className="level-select"
            title="Sets how hard your materials are. Score 80%+ on a practice test to level up automatically."
          >
            <span className="muted small">Level</span>
            <select value={level} onChange={(e) => onLevelChange(e.target.value)}>
              <option value="novice">🌱 Novice</option>
              <option value="competent">🍳 Competent</option>
              <option value="expert">👨‍🍳 Expert</option>
            </select>
          </label>
          <span className="muted small level-note">
            score 80%+ on a test to level up · {taken} of {tests.length} taken
          </span>
        </div>
      </div>

      <div className="line-timeline" aria-label="Timeline until your test">
        <div className="lt-track" />
        <div className="lt-progress" style={{ width: `${nowPct}%` }} />
        {sleeps.map((s, i) => {
          const left = pos(s.from)
          const width = Math.max(pos(s.to) - left, 3)
          return (
            <div key={i}>
              <div
                className="lt-sleep"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`Suggested sleep · ${clockFull(s.from)} – ${clock(s.to)}`}
              >
                💤
              </div>
              {width >= 10 && (
                <div className="lt-sleep-label" style={{ left: `${left + width / 2}%` }}>
                  <span className="lt-name">😴 Sleep</span>
                  <span className="lt-label">
                    {clock(s.from)}–{clock(s.to)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
        {tests.map((t, i) => {
          const crowded =
            i > 0 && pos(t.suggestedAt) - pos(tests[i - 1].suggestedAt) < 9
          return (
            <div
              key={t.id}
              className={`lt-marker ${i < taken ? 'past' : ''} ${i === taken ? 'next' : ''} ${crowded ? 'crowded' : ''}`}
              style={{ left: `${pos(t.suggestedAt)}%` }}
              title={`Practice test ${t.n} — suggested ${clockFull(t.suggestedAt)}`}
            >
              <span className="lt-icon">{i < taken ? '✓' : '🔥'}</span>
              <span className="lt-name">Test {t.n}</span>
              <span className="lt-label">{clock(t.suggestedAt)}</span>
            </div>
          )
        })}
        <div className="lt-marker end" style={{ left: '100%' }} title={`Test time · ${clockFull(plan.testAt || testTime)}`}>
          <span className="lt-icon">🎓</span>
          <span className="lt-name">Your test</span>
          <span className="lt-label">{clock(plan.testAt || testTime)}</span>
        </div>
        <div className="lt-now" style={{ left: `${Math.min(Math.max(nowPct, 4), 92)}%` }}>
          <span className="lt-now-dot" />
          <span className="lt-now-label">{leftLabel}</span>
        </div>
      </div>
      <p className="lt-legend muted small">
        🔥 practice test{sleeps.length > 0 && <> · 💤 suggested sleep</>} · 🎓 your real test
      </p>

      {verdict && (
        <p className="muted small mix-caption">
          Mix so far: <strong>{readPct}% reading · {100 - readPct}% recall + tests</strong>{' '}
          (target 30 · 70). {verdict}
        </p>
      )}

      <div className="action-row">
        <button className="action-card read" onClick={onStudy}>
          <span className="action-emoji">📖</span>
          <span className="action-title">Study</span>
          <span className="action-sub">Summary &amp; cheat sheet</span>
          <span className="action-chips">
            <span className="action-tally">{tally(studySec)}</span>
            <span className="action-target">target ~30% of your time</span>
          </span>
        </button>
        <button className="action-card recall" onClick={onRecall}>
          <span className="action-emoji">🧠</span>
          <span className="action-title">Active recall</span>
          <span className="action-sub">Flashcards, notes closed</span>
          <span className="action-chips">
            <span className="action-tally hot-tally">{tally(activeSec)}</span>
            <span className="action-target">target ~70% (incl. tests)</span>
          </span>
        </button>
      </div>

      <div className="test-suggest">
        {nextTest ? (
          <>
            <div className="suggest-main">
              <div className="milestone-eyebrow">
                🔥 Practice test {nextTest.n} of {tests.length} — suggested at
              </div>
              <div className="suggest-time">
                {clock(nextTest.suggestedAt)}
                <span className="suggest-in">{fmtIn(nextTest.suggestedAt)}</span>
              </div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Afterwards your materials are rebuilt around what you missed.
              </p>
            </div>
            <button className="btn" onClick={onTest}>
              Take it {fmtIn(nextTest.suggestedAt) === 'now' ? 'now ' : ''}🔥
            </button>
          </>
        ) : (
          <>
            <div className="suggest-main">
              <div className="milestone-eyebrow">🏁 All tests taken — final review at</div>
              <div className="suggest-time">{clock(plan.finalReviewAt)}</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                One calm pass over the cheat sheet, then step away — you’re ready.
              </p>
            </div>
            <button className="btn ghost" onClick={onTest}>
              Retake a test 🔥
            </button>
          </>
        )}
      </div>

      <div className={`break-card ${breakRunning ? 'running' : ''}`}>
        <div className="break-head">
          <strong>☕ Break timer</strong>
          <span className="action-tally">{tally(breakSec)}</span>
          <span className="muted small">
            suggested: ~{SUGGESTED_BREAK} min for every hour of studying
          </span>
        </div>
        <p className="break-benefit">
          Breaks aren’t slacking — resting between sessions is when your brain consolidates
          what you just learned, so it sticks for the test.
        </p>

        {!breakTimer && (
          <div className="break-controls">
            {[5, 10, 15].map((m) => (
              <button
                key={m}
                className={`preset-chip ${m === SUGGESTED_BREAK ? 'selected' : ''}`}
                onClick={() => onBreakStart(m)}
              >
                {m} min{m === SUGGESTED_BREAK ? ' ★' : ''}
              </button>
            ))}
            <span className="break-custom">
              <input
                type="number"
                min="1"
                max="120"
                value={customMin}
                onChange={(e) => setCustomMin(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                aria-label="Custom break minutes"
              />
              <button className="preset-chip" onClick={() => onBreakStart(customMin)}>
                Start {customMin} min
              </button>
            </span>
          </div>
        )}

        {breakRunning && (
          <div className="break-running">
            <span className="break-count">
              {mm}:{ss}
            </span>
            <button className="btn ghost small-btn" onClick={onBreakExtend}>
              +5 min
            </button>
            <button className="btn ghost small-btn" onClick={onBreakEnd}>
              End break
            </button>
          </div>
        )}

        {breakOver && (
          <div className="break-running">
            <strong>⏰ Break’s over — back to it!</strong>
            <button className="btn small-btn" onClick={onBreakEnd}>
              Back to it 🔥
            </button>
          </div>
        )}

        <div className="break-tip">
          <span>{tip.emoji}</span>
          <span>
            <strong>{tip.tip}.</strong> <span className="muted">{tip.why}</span>
          </span>
        </div>
      </div>

    </div>
  )
}
