import { useState } from 'react'

const PRESETS = [
  { hours: 3, label: 'Tonight' },
  { hours: 12, label: 'Tomorrow' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
]

export default function TimeSelect({ onDone, onBack }) {
  const [hours, setHours] = useState(24)

  const testDateLabel = new Date(Date.now() + hours * 3600000).toLocaleString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const hoursLabel = hours === 1 ? '1 hour' : `${hours} hours`

  return (
    <div className="card timeselect">
      <h2>⏲️ How long until your test?</h2>

      <div className="time-readout">
        <span className="time-big">{hoursLabel}</span>
        <span className="muted">until test time · {testDateLabel}</span>
      </div>

      <input
        className="time-slider"
        type="range"
        min="1"
        max="72"
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        aria-label="Hours until test"
      />

      <div className="preset-row">
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            className={`preset-chip ${hours === p.hours ? 'selected' : ''}`}
            onClick={() => setHours(p.hours)}
          >
            {p.label}
          </button>
        ))}
      </div>

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
