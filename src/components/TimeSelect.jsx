import { useState } from 'react'
import { INTENSITY, sleepDurationMin } from '../lib/planner.js'

const PRESETS = [
  { hours: 3, label: 'Tonight' },
  { hours: 12, label: 'Tomorrow' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
]

// Returns minutes-from-midnight, or null for an empty/cleared/malformed input
// (browsers show a clear button on <input type="time">).
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

export default function TimeSelect({ onDone, onBack }) {
  const [hours, setHours] = useState(24)
  const [intensity, setIntensity] = useState('steady')
  const [bed, setBed] = useState('23:00')
  const [wake, setWake] = useState('07:00')

  // Fall back to sensible defaults if a field is cleared, so neither the
  // reminder nor the plan ever sees NaN.
  const bedMin = toMin(bed) ?? 23 * 60
  const wakeMin = toMin(wake) ?? 7 * 60
  // Same helper the planner uses, so the reminder can't contradict the plan.
  const sleepH = Math.round((sleepDurationMin(bedMin, wakeMin) / 60) * 10) / 10

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

      <div className="setup-row">
        <label className="setup-pick">
          <span className="muted small">Intensity</span>
          <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            {Object.entries(INTENSITY).map(([key, v]) => (
              <option key={key} value={key}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="setup-pick">
          <span className="muted small">😴 Bedtime</span>
          <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
        </label>
        <label className="setup-pick">
          <span className="muted small">🌅 Wake up</span>
          <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
        </label>
      </div>
      <p className="muted small setup-note">
        {INTENSITY[intensity].blurb} · <strong>{sleepH} h</strong> of sleep planned — deep sleep
        is when studying sticks, so don’t skip it.
      </p>

      <div className="step-row">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn"
          onClick={() =>
            // Snap the whole schedule to a 15-minute grid from the start.
            onDone(
              new Date(
                Math.round((Date.now() + hours * 3600000) / (15 * 60000)) * (15 * 60000)
              ).toISOString(),
              intensity,
              { bedMin, wakeMin }
            )
          }
        >
          Cook up my cram plan 🍳
        </button>
      </div>
    </div>
  )
}
