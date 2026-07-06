import { TYPE_META } from '../lib/planner.js'

const fmtTime = (iso) =>
  new Date(iso).toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

const fmtDuration = (min) =>
  min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`

const fmtSpent = (sec) => {
  if (sec < 60) return '<1 min'
  const min = Math.round(sec / 60)
  return min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`
}

export default function PlanView({
  plan,
  doneSteps,
  results,
  timeSpent,
  countdown,
  onGo,
  onToggleDone,
}) {
  const now = Date.now()
  const currentIdx = plan.findIndex(
    (item) =>
      !doneSteps.includes(item.id) &&
      new Date(item.start).getTime() + item.durationMin * 60000 > now
  )
  const totalTests = plan
    .flatMap((i) => i.parts || [])
    .filter((p) => p.kind === 'test').length
  const takenTests = results.length

  // Live mix: real seconds spent on the study screen vs flashcards + tests.
  const studySec = timeSpent?.study || 0
  const activeSec = timeSpent?.active || 0
  const totalSec = studySec + activeSec
  const readPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0
  const enoughData = totalSec >= 120
  const verdict = !enoughData
    ? null
    : readPct > 40
      ? 'You’re rereading more than the target — switch to flashcards or a practice test. 🔥'
      : readPct >= 22
        ? 'Right on target — keep this balance. 👌'
        : 'Nicely recall-heavy — exactly what the research favors. 💪'

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
          <p className="muted">
            Every round is the same simple loop:{' '}
            <strong>📖 study → 🧠 flashcards → ☕ break</strong>.{' '}
            <strong>🔥 Practice tests</strong> are your milestones — after each one, your study
            materials are rebuilt to focus on what you missed.
          </p>
        </div>
        {countdown && <span className="pill hot">⏲️ {countdown.text} left</span>}
      </div>

      <div
        className="mix-stats"
        title="Tracks the time you actually spend on each screen. Target: ~30% reading, ~70% recall + tests."
      >
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

      <div className="timeline">
        {plan.map((item, idx) => {
          const done = doneSteps.includes(item.id)
          const isCurrent = idx === currentIdx

          if (item.type !== 'cycle') {
            // sleep + final glaze
            return (
              <div
                key={item.id}
                className={`tl-item ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                style={{ '--dot': TYPE_META[item.type].color }}
              >
                <div className="tl-time">
                  {fmtTime(item.start)} · {fmtDuration(item.durationMin)}
                  {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
                </div>
                <div className="tl-title">{item.title}</div>
                <div className="tl-detail">{item.detail}</div>
              </div>
            )
          }

          const hasTest = item.parts.some((p) => p.kind === 'test')
          return (
            <div
              key={item.id}
              className={`tl-item cycle-card ${hasTest ? 'has-milestone' : ''} ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              style={{ '--dot': hasTest ? 'var(--step-test)' : TYPE_META.cycle.color }}
            >
              <div className="cycle-head">
                <div>
                  <div className="tl-time">
                    {fmtTime(item.start)}
                    {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
                  </div>
                  <div className="tl-title">Round {item.n}</div>
                </div>
                <div className="cycle-total">{fmtDuration(item.durationMin)}</div>
              </div>

              <div className="cycle-parts">
                {item.parts.map((part, i) => {
                  if (part.kind === 'study')
                    return (
                      <div className="part-row" key={i}>
                        <span className="part-label">📖 Study the summary &amp; cheat sheet</span>
                        <span className="part-time">{part.durationMin} min</span>
                        <button
                          className="btn ghost small-btn"
                          onClick={() => onGo({ id: item.id, type: 'study' })}
                        >
                          Start →
                        </button>
                      </div>
                    )
                  if (part.kind === 'recall')
                    return (
                      <div className="part-row" key={i}>
                        <span className="part-label">🧠 Flashcards — answer from memory, notes closed</span>
                        <span className="part-time">{part.durationMin} min</span>
                        <button
                          className="btn ghost small-btn"
                          onClick={() => onGo({ id: item.id, type: 'recall' })}
                        >
                          Flip →
                        </button>
                      </div>
                    )
                  if (part.kind === 'test')
                    return (
                      <div className="part-milestone" key={i}>
                        <div className="milestone-eyebrow">🔥 Milestone</div>
                        <div className="part-row">
                          <span className="part-label">
                            <strong>Practice test {part.n} of {totalTests}</strong> — simulates
                            the real thing, then your materials are rebuilt around what you missed
                          </span>
                          <span className="part-time hot-time">{part.durationMin} min</span>
                          <button
                            className="btn small-btn"
                            onClick={() => onGo({ id: item.id, type: 'test' })}
                          >
                            Take it 🔥
                          </button>
                        </div>
                      </div>
                    )
                  // break
                  return (
                    <div className="snack-bar" key={i}>
                      <span className="snack-emoji">{part.emoji}</span>
                      <div>
                        <strong>
                          {part.durationMin}-min break: {part.tip}
                        </strong>
                        <p>{part.why}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {!done && (
                <div className="tl-actions">
                  <button className="btn ghost small-btn" onClick={() => onToggleDone(item)}>
                    Mark round done ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="muted small" style={{ marginTop: 18 }}>
        🔥 {takenTests} of {totalTests} practice tests taken. After each one, your summaries,
        flashcards, and next test are rebuilt to target your weak spots.
      </p>
    </div>
  )
}
