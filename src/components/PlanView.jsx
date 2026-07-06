import { TYPE_META } from '../lib/planner.js'

const fmtTime = (iso) =>
  new Date(iso).toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

const fmtDuration = (min) =>
  min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`

export default function PlanView({ plan, doneSteps, results, countdown, onGo, onToggleDone }) {
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

  let studyMin = 0
  let activeMin = 0
  for (const part of plan.flatMap((i) => i.parts || [])) {
    if (part.kind === 'study') studyMin += part.durationMin
    if (part.kind === 'recall' || part.kind === 'test') activeMin += part.durationMin
  }
  const readPct = Math.round((studyMin / Math.max(studyMin + activeMin, 1)) * 100)

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
          <p className="muted">
            Each <strong>cook cycle</strong> is one serving of the recipe:{' '}
            <strong>🍳 study → 🧠 active recall → ☕ break</strong> — and when a{' '}
            <strong>🔥 practice test</strong> milestone lands in a cycle, it refries your
            materials around your weak spots.
          </p>
        </div>
        {countdown && <span className="pill hot">⏲️ {countdown.text} left</span>}
      </div>

      <div className="mix-bar" title="A century of research: retrieval beats rereading. We mix your hours accordingly.">
        <div className="mix-track">
          <div className="mix-read" style={{ width: `${readPct}%` }}>
            📖 {readPct}%
          </div>
          <div className="mix-active" style={{ width: `${100 - readPct}%` }}>
            🧠🔥 {100 - readPct}% active recall + practice tests
          </div>
        </div>
        <p className="muted small mix-caption">
          Your hours, mixed to the science-backed ratio — roughly 30% reading, 70% pulling it
          back out.
        </p>
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
                  <div className="tl-title">🍳 Cook cycle {item.n}</div>
                </div>
                <div className="cycle-total">{fmtDuration(item.durationMin)}</div>
              </div>

              <div className="cycle-parts">
                {item.parts.map((part, i) => {
                  if (part.kind === 'study')
                    return (
                      <div className="part-row" key={i}>
                        <span className="part-label">🍳 Study the summary &amp; cheat sheet</span>
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
                        <span className="part-label">🧠 Active recall — flashcards, notes closed</span>
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
                            <strong>Practice test {part.n} of {totalTests}</strong> — real
                            conditions, then we refry everything around what you missed
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
                    Mark cycle done ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="muted small" style={{ marginTop: 18 }}>
        🔥 {takenTests} of {totalTests} practice tests taken. Each one refries your materials
        around your weak spots — that’s where the real flavor develops.
      </p>
    </div>
  )
}
