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
            The recipe is simple: <strong>study → active recall → practice test → repeat</strong>,
            with breaks, sleep, and brain food folded in.
          </p>
        </div>
        {countdown && <span className="pill hot">⏲️ {countdown.text} left</span>}
      </div>

      <div className="legend">
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <span key={key}>
            <i style={{ background: meta.color }} /> {meta.emoji} {meta.label}
          </span>
        ))}
      </div>

      <div className="timeline">
        {plan.map((item, idx) => {
          const meta = TYPE_META[item.type]
          const done = doneSteps.includes(item.id)
          const isCurrent = idx === currentIdx
          const actionable = ['study', 'recall', 'test'].includes(item.type)
          return (
            <div
              key={item.id}
              className={`tl-item ${item.type === 'test' ? 'milestone' : ''} ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              style={{ '--dot': meta.color }}
            >
              <div className="tl-time">
                {fmtTime(item.start)} · {item.durationMin} min
                {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
              </div>
              <div className="tl-title">{item.title}</div>
              <div className="tl-detail">{item.detail}</div>
              {isCurrent && (
                <div className="tl-actions">
                  {actionable && (
                    <button className="btn small-btn" onClick={() => onGo(item)}>
                      {item.type === 'study' && 'Start studying 🍳'}
                      {item.type === 'recall' && 'Flip flashcards 🧠'}
                      {item.type === 'test' && 'Take practice test 🔥'}
                    </button>
                  )}
                  <button className="btn ghost small-btn" onClick={() => onToggleDone(item)}>
                    Mark done ✓
                  </button>
                </div>
              )}
              {!isCurrent && !done && actionable && (
                <div className="tl-actions">
                  <button className="btn ghost small-btn" onClick={() => onGo(item)}>
                    Jump in early →
                  </button>
                </div>
              )}
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
