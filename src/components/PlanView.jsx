import { TYPE_META } from '../lib/planner.js'

const fmtTime = (iso) =>
  new Date(iso).toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

export default function PlanView({ plan, doneSteps, results, countdown, onGo, onToggleDone }) {
  const now = Date.now()
  const currentIdx = plan.findIndex(
    (item) =>
      !doneSteps.includes(item.id) &&
      new Date(item.start).getTime() + item.durationMin * 60000 > now
  )
  const testCount = plan.filter((i) => i.type === 'test').length
  const takenTests = results.length

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
          <p className="muted">
            The recipe repeats until test time:{' '}
            <strong>🍳 study → 🧠 active recall → ☕ break</strong>, with{' '}
            <strong>🔥 practice tests</strong> as the milestones that refry your materials
            around your weak spots.
          </p>
        </div>
        {countdown && <span className="pill hot">⏲️ {countdown.text} left</span>}
      </div>

      <div className="timeline">
        {plan.map((item, idx) => {
          const meta = TYPE_META[item.type]
          const done = doneSteps.includes(item.id)
          const isCurrent = idx === currentIdx
          const rowClass = `tl-item ${item.type === 'test' ? 'milestone' : ''} ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`

          if (item.type === 'test') {
            return (
              <div key={item.id} className={rowClass} style={{ '--dot': meta.color }}>
                <div className="milestone-eyebrow">🔥 Milestone</div>
                <div className="tl-time">
                  {fmtTime(item.start)} · {item.durationMin} min
                </div>
                <div className="tl-title">
                  Practice test {item.n} of {testCount}
                </div>
                <div className="tl-detail">{item.detail}</div>
                <div className="tl-actions">
                  <button className="btn small-btn" onClick={() => onGo({ id: item.id, type: 'test' })}>
                    {isCurrent ? 'Take the test 🔥' : done ? 'Retake it 🔥' : 'Take it early 🔥'}
                  </button>
                  {!done && (
                    <button className="btn ghost small-btn" onClick={() => onToggleDone(item)}>
                      Mark done ✓
                    </button>
                  )}
                </div>
              </div>
            )
          }

          if (item.type === 'cycle') {
            return (
              <div key={item.id} className={rowClass} style={{ '--dot': meta.color }}>
                <div className="tl-time">
                  {fmtTime(item.start)} · {item.durationMin} min
                  {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
                </div>
                <div className="tl-title">🍳 Cook cycle {item.n}</div>
                <div className="tl-detail">
                  Study the summary &amp; cheat sheet for {item.study} min, then flip flashcards
                  for {item.recall} min — notes closed.
                </div>
                {item.break && (
                  <div className="snack-bar">
                    <span className="snack-emoji">{item.break.emoji}</span>
                    <div>
                      <strong>
                        {item.break.durationMin}-min break: {item.break.tip}
                      </strong>
                      <p>{item.break.why}</p>
                    </div>
                  </div>
                )}
                {(isCurrent || !done) && (
                  <div className="tl-actions">
                    <button
                      className={`btn ${isCurrent ? '' : 'ghost'} small-btn`}
                      onClick={() => onGo({ id: item.id, type: 'study' })}
                    >
                      Start studying 🍳
                    </button>
                    <button
                      className="btn ghost small-btn"
                      onClick={() => onGo({ id: item.id, type: 'recall' })}
                    >
                      Flashcards 🧠
                    </button>
                    {isCurrent && (
                      <button className="btn ghost small-btn" onClick={() => onToggleDone(item)}>
                        Mark done ✓
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          }

          // sleep + final glaze
          return (
            <div key={item.id} className={rowClass} style={{ '--dot': meta.color }}>
              <div className="tl-time">
                {fmtTime(item.start)} ·{' '}
                {item.durationMin >= 90
                  ? `${Math.round(item.durationMin / 6) / 10} h`
                  : `${item.durationMin} min`}
                {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
              </div>
              <div className="tl-title">{item.title}</div>
              <div className="tl-detail">{item.detail}</div>
            </div>
          )
        })}
      </div>

      <p className="muted small" style={{ marginTop: 18 }}>
        🔥 {takenTests} of {testCount} practice tests taken. Each one refries your materials
        around your weak spots — that’s where the real flavor develops.
      </p>
    </div>
  )
}
