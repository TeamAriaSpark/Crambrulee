import { Fragment } from 'react'
import { TIPS } from '../lib/planner.js'
import { LEVEL_META } from '../lib/engine.js'

const fmtClock = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })

const fmtSpent = (sec) => {
  if (sec < 60) return '<1 min'
  const min = Math.round(sec / 60)
  return min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`
}

const fmtIn = (iso) => {
  const min = Math.round((new Date(iso) - Date.now()) / 60000)
  if (min <= 0) return 'now'
  if (min < 60) return `in ~${min} min`
  const h = Math.round(min / 6) / 10
  return `in ~${h} h`
}

export default function PlanView({
  plan,
  results,
  timeSpent,
  countdown,
  level,
  onLevelChange,
  onStudy,
  onRecall,
  onTest,
}) {
  const tests = plan?.tests || []
  const taken = Math.min(results.length, tests.length)
  const nextTest = tests[taken] || null
  const allDone = !nextTest

  // Live mix: real time on the study screen vs flashcards + tests.
  const studySec = timeSpent?.study || 0
  const activeSec = timeSpent?.active || 0
  const totalSec = studySec + activeSec
  const readPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0
  const verdict =
    totalSec < 120
      ? null
      : readPct > 40
        ? 'You’re reading more than the target — switch to flashcards or a test. 🔥'
        : readPct >= 22
          ? 'Right on target — keep this balance. 👌'
          : 'Nicely recall-heavy — exactly what the research favors. 💪'

  const tip = TIPS[(taken * 3 + new Date().getHours()) % TIPS.length]

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
          <p className="muted">
            Study and quiz yourself in any order you like — just keep the mix near{' '}
            <strong>30% reading / 70% recall</strong>, and take the practice tests when they
            come up.
          </p>
        </div>
        <div className="head-controls">
          {countdown && <span className="pill hot">⏲️ {countdown.text} left</span>}
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
        </div>
      </div>

      <div className="hz-timeline" aria-label="Practice test milestones">
        {tests.map((t, i) => (
          <Fragment key={t.id}>
            <div className={`hz-block ${i === taken ? 'live' : ''} ${i < taken ? 'past' : ''}`}>
              <span className="hz-block-name">Study block {i + 1}</span>
              <span className="hz-block-time">
                {i < taken ? 'done' : i === taken ? 'you are here' : ''}
              </span>
            </div>
            <div
              className={`hz-node ${i < taken ? 'past' : ''}`}
              title={`Practice test ${t.n} — suggested ${fmtClock(t.suggestedAt)}`}
            >
              {i < taken ? '✓' : '🔥'}
            </div>
          </Fragment>
        ))}
        <div className="hz-node finish" title={`Final review · ${fmtClock(plan.finalReviewAt)}`}>
          🏁
        </div>
      </div>

      <div className="mix-stats">
        {totalSec === 0 ? (
          <p className="muted small mix-caption">
            ⏱️ Your time tallies here as you go — target mix:{' '}
            <strong>30% reading · 70% recall + tests</strong>.
          </p>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-label">📖 Reading</span>
                <span className="stat-value">{fmtSpent(studySec)}</span>
                <span className="stat-pct">{readPct}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">🧠🔥 Recall + tests</span>
                <span className="stat-value">{fmtSpent(activeSec)}</span>
                <span className="stat-pct">{100 - readPct}%</span>
              </div>
              <div className="stat stat-target">
                <span className="stat-label">🎯 Target</span>
                <span className="stat-value">30% · 70%</span>
              </div>
            </div>
            {verdict && <p className="muted small mix-caption">{verdict}</p>}
          </>
        )}
      </div>

      <div className="action-row">
        <button className="action-card read" onClick={onStudy}>
          <span className="action-emoji">📖</span>
          <span className="action-title">Study</span>
          <span className="action-sub">Summary &amp; cheat sheet</span>
          <span className="cat-chip read">reading</span>
        </button>
        <button className="action-card recall" onClick={onRecall}>
          <span className="action-emoji">🧠</span>
          <span className="action-title">Active recall</span>
          <span className="action-sub">Flashcards, notes closed</span>
          <span className="cat-chip recall">active recall</span>
        </button>
      </div>

      <div className="test-suggest">
        {allDone ? (
          <>
            <div>
              <div className="milestone-eyebrow">🏁 All tests taken</div>
              <strong>Final review at {fmtClock(plan.finalReviewAt)}</strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                One calm pass over the cheat sheet, then step away — you’re ready.
              </p>
            </div>
            <button className="btn ghost" onClick={onTest}>
              Retake a test 🔥
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="milestone-eyebrow">🔥 Next milestone</div>
              <strong>
                Practice test {nextTest.n} of {tests.length}
              </strong>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Suggested around {fmtClock(nextTest.suggestedAt)} ({fmtIn(nextTest.suggestedAt)})
                — afterwards your materials are rebuilt around what you missed.
              </p>
            </div>
            <button className="btn" onClick={onTest}>
              Take it {fmtIn(nextTest.suggestedAt) === 'now' ? 'now ' : ''}🔥
            </button>
          </>
        )}
      </div>

      <div className="snack-bar" style={{ marginTop: 14, maxWidth: 'none' }}>
        <span className="snack-emoji">{tip.emoji}</span>
        <div>
          <strong>{tip.tip}</strong>
          <p>{tip.why}</p>
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 16 }}>
        {LEVEL_META[level]?.emoji} Level: <strong>{level}</strong> — score 80%+ on a practice
        test to level up.
      </p>
    </div>
  )
}
