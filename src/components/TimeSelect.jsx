import { useState } from 'react'
import { INTENSITY } from '../lib/planner.js'

const PRESETS = [
  { hours: 3, label: 'Tonight' },
  { hours: 12, label: 'Tomorrow' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
]

export default function TimeSelect({ onDone, onBack }) {
  const [hours, setHours] = useState(24)
  const [intensity, setIntensity] = useState('steady')

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

      <div className="intensity-row">
        <label className="intensity-pick">
          <span className="muted small">Intensity</span>
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            {Object.entries(INTENSITY).map(([key, v]) => (
              <option key={key} value={key}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small intensity-blurb">{INTENSITY[intensity].blurb}.</span>
      </div>

      <div className="step-row">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn"
          onClick={() =>
            onDone(new Date(Date.now() + hours * 3600000).toISOString(), intensity)
          }
        >
          Cook up my cram plan 🍳
        </button>
      </div>
    </div>
  )
}
