import { useState } from 'react'

const PRESETS = [
  { hours: 3, label: 'Tonight!', emoji: '🚨' },
  { hours: 12, label: 'Tomorrow morning', emoji: '🌅' },
  { hours: 24, label: 'In a day', emoji: '📅' },
  { hours: 48, label: 'In two days', emoji: '🗓️' },
  { hours: 72, label: 'In three days', emoji: '😌' },
]

export default function TimeSelect({ onDone, onBack }) {
  const [hours, setHours] = useState(24)

  const testDate = new Date(Date.now() + hours * 3600000)
  const testDateLabel = testDate.toLocaleString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const heat =
    hours <= 6
      ? { label: 'HIGH HEAT 🔥🔥🔥', note: 'Short runway — tight cycles, no fluff, one hard practice test.' }
      : hours <= 24
        ? { label: 'MEDIUM-HIGH 🔥🔥', note: 'A solid cram window. Sleep still makes the cut — it’s when memory sets.' }
        : { label: 'STEADY SIMMER 🔥', note: 'Enough time for spaced cycles, real sleep, and several practice tests.' }

  return (
    <div className="card">
      <h2>⏲️ Set the timer</h2>
      <p className="muted">How long until your test? We’ll size every study cycle to fit.</p>

      <div className="time-grid">
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            className={`time-option ${hours === p.hours ? 'selected' : ''}`}
            onClick={() => setHours(p.hours)}
          >
            <span className="big">
              {p.emoji} {p.hours}h
            </span>
            <span className="muted small">{p.label}</span>
          </button>
        ))}
      </div>

      <div className="slider-row">
        <span className="muted small">Fine-tune:</span>
        <input
          type="range"
          min="1"
          max="72"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
        <span className="slider-value">{hours}h</span>
      </div>

      <p className="target-time">
        ⏰ That puts your test at <strong>{testDateLabel}</strong>
      </p>

      <p>
        <span className="pill hot">{heat.label}</span>{' '}
        <span className="muted small">{heat.note}</span>
      </p>

      <div className="step-row">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn"
          onClick={() => onDone(new Date(Date.now() + hours * 3600000).toISOString())}
        >
          Cook up my cram plan 🍳
        </button>
      </div>
    </div>
  )
}
