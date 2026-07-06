import { useEffect, useRef, useState } from 'react'
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

const SLEEP_SCIENCE =
  'Sleep isn’t lost study time — during deep sleep your brain replays what you learned and files it into long-term memory. Students who sleep before an exam consistently beat the all-nighters.'

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
  onSleepChange,
  onBreakStart,
  onBreakExtend,
  onBreakEnd,
}) {
  const tests = plan?.tests || []
  // Backfill sleep suggestions for sessions saved before sleeps existed.
  const sleeps = plan?.sleeps ?? suggestSleeps(plan.startedAt, plan.finalReviewAt)
  const taken = Math.min(results.length, tests.length)
  const nextTest = tests[taken] || null

  // Proportional axis: session start → real test time.
  const axisStart = new Date(plan.startedAt).getTime()
  const axisEnd = new Date(plan.testAt || testTime).getTime()
  const span = Math.max(axisEnd - axisStart, 1)
  const pos = (iso) => Math.min(100, Math.max(0, ((new Date(iso).getTime() - axisStart) / span) * 100))
  const nowPct = pos(new Date().toISOString())

  // Zigzag label rows so close markers never overlap: a marker whose label
  // would crowd the previous top-row label drops to a second row.
  const markerList = [
    ...tests.map((t, i) => ({
      key: t.id,
      at: t.suggestedAt,
      icon: i < taken ? '✓' : '🔥',
      name: `Test ${t.n}`,
      cls: `${i < taken ? 'past' : ''} ${i === taken ? 'next' : ''}`,
      title: `Practice test ${t.n} — suggested ${clockFull(t.suggestedAt)}`,
    })),
    {
      key: 'end',
      at: plan.testAt || testTime,
      icon: '🎓',
      name: 'Your test',
      cls: 'end',
      title: `Test time · ${clockFull(plan.testAt || testTime)}`,
    },
  ]
  let lastTopRow = -Infinity
  const markers = markerList.map((m) => {
    const p = pos(m.at)
    if (p - lastTopRow < 10) return { ...m, p, row: 'b' }
    lastTopRow = p
    return { ...m, p, row: 'a' }
  })
  const hasRowB = markers.some((m) => m.row === 'b')

  // Drag-to-edit sleep edges: pointer position → time, snapped to 15 min.
  const timelineRef = useRef(null)
  const dragRef = useRef(null)
  const sleepsRef = useRef(sleeps)
  sleepsRef.current = sleeps
  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current
      if (!d || !timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const SNAP = 15 * 60000
      const t = Math.round((axisStart + pct * span) / SNAP) * SNAP
      const current = sleepsRef.current[d.i]
      if (!current) return
      const from = new Date(current.from).getTime()
      const to = new Date(current.to).getTime()
      const finalReview = new Date(plan.finalReviewAt).getTime()
      const MIN_SLEEP = 60 * 60000
      const next =
        d.edge === 'from'
          ? { from: new Date(Math.max(axisStart, Math.min(t, to - MIN_SLEEP))).toISOString(), to: current.to }
          : { from: current.from, to: new Date(Math.min(finalReview, Math.max(t, from + MIN_SLEEP))).toISOString() }
      onSleepChange(sleepsRef.current.map((s, j) => (j === d.i ? next : s)))
    }
    const up = () => {
      dragRef.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [axisStart, span, plan.finalReviewAt, onSleepChange])

  const startDrag = (i, edge) => (e) => {
    e.preventDefault()
    dragRef.current = { i, edge }
    document.body.style.cursor = 'ew-resize'
  }

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
  const SUGGESTED_BREAK = 45
  const [customMin, setCustomMin] = useState(SUGGESTED_BREAK)
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
          <label className="level-select">
            <span className="muted small">Level</span>
            <select value={level} onChange={(e) => onLevelChange(e.target.value)}>
              <option value="novice">🌱 Novice</option>
              <option value="competent">🍳 Competent</option>
              <option value="expert">👨‍🍳 Expert</option>
            </select>
            <span className="level-tooltip">
              <strong>🌡️ Difficulty</strong> — changes how hard your summaries, flashcards, and
              practice tests are. Pick one yourself, or it levels up automatically when you
              score 80%+ on a practice test.
            </span>
          </label>
          <span className="muted small level-note">
            score 80%+ to level up · {taken}/{tests.length} tests taken
          </span>
        </div>
      </div>

      <div
        ref={timelineRef}
        className={`line-timeline ${hasRowB ? 'tall' : ''}`}
        aria-label="Timeline until your test"
      >
        <div className="lt-track" />
        <div className="lt-progress" style={{ width: `${nowPct}%` }} />
        {sleeps.map((s, i) => {
          const left = pos(s.from)
          const width = Math.max(pos(s.to) - left, 3)
          const mid = Math.min(Math.max(left + width / 2, 16), 84)
          return (
            <div key={i} className="lt-sleep-wrap">
              <div className="lt-sleep" style={{ left: `${left}%`, width: `${width}%` }}>
                <span className="lt-sleep-text">
                  {width >= 16 ? `😴 sleep ${clock(s.from)}–${clock(s.to)}` : '💤'}
                </span>
                <span className="lt-handle left" onPointerDown={startDrag(i, 'from')} />
                <span className="lt-handle right" onPointerDown={startDrag(i, 'to')} />
              </div>
              <div className="lt-tooltip" style={{ left: `${mid}%` }}>
                <strong>💤 Why sleep instead of cramming?</strong> {SLEEP_SCIENCE}
                <span className="lt-tooltip-hint">↔ Drag the ends to match your real bedtime.</span>
              </div>
            </div>
          )
        })}
        {markers.map((m) => (
          <div
            key={m.key}
            className={`lt-marker ${m.cls} ${m.row === 'b' ? 'rowb' : ''}`}
            style={{ left: `${m.p}%` }}
            title={m.title}
          >
            <span className="lt-icon">{m.icon}</span>
            <span className="lt-tag">
              <span className="lt-name">{m.name}</span>
              <span className="lt-label">{clock(m.at)}</span>
            </span>
          </div>
        ))}
        <div className="lt-now" style={{ left: `${Math.min(Math.max(nowPct, 4), 92)}%` }}>
          <span className="lt-now-dot" />
          <span className="lt-now-label">{leftLabel}</span>
        </div>
      </div>
      <p className="lt-legend muted small">
        🔥 practice test{sleeps.length > 0 && <> · 💤 suggested sleep (hover for the science, drag to adjust)</>} · 🎓 your real test
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

      <div
        className={`break-card ${breakRunning ? 'running' : ''}`}
        title="Rest is when your brain consolidates what you just learned."
      >
        <div className="break-line">
          <strong>☕ Break</strong>
          {!breakTimer && (
            <>
              {[10, 20, 45].map((m) => (
                <button
                  key={m}
                  className={`preset-chip ${m === SUGGESTED_BREAK ? 'selected' : ''}`}
                  onClick={() => onBreakStart(m)}
                >
                  {m}m{m === SUGGESTED_BREAK ? ' ★' : ''}
                </button>
              ))}
              <span className="break-custom">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customMin}
                  onChange={(e) =>
                    setCustomMin(Math.max(1, Math.min(120, Number(e.target.value) || 1)))
                  }
                  aria-label="Custom break minutes"
                />
                <button className="preset-chip" onClick={() => onBreakStart(customMin)}>
                  Start
                </button>
              </span>
            </>
          )}
          {breakRunning && (
            <>
              <span className="break-count">
                {mm}:{ss}
              </span>
              <button className="preset-chip" onClick={onBreakExtend}>
                +5m
              </button>
              <button className="preset-chip" onClick={onBreakEnd}>
                End
              </button>
            </>
          )}
          {breakOver && (
            <>
              <strong className="break-over-msg">⏰ Break’s over!</strong>
              <button className="btn small-btn" onClick={onBreakEnd}>
                Back to it 🔥
              </button>
            </>
          )}
          <span className="action-tally break-tally">{tally(breakSec)}</span>
        </div>
        <p className="break-tip small">
          {tip.emoji} <strong>{tip.tip}.</strong>{' '}
          <span className="muted">{tip.why}</span>
        </p>
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
    </div>
  )
}
