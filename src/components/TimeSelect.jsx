import { useEffect, useState } from 'react'
import { sleepDurationMin } from '../lib/planner.js'

const TIME_PRESETS = [
  { hours: 3, label: 'Tonight' },
  { hours: 12, label: 'Tomorrow' },
  { hours: 24, label: '1 day' },
  { hours: 48, label: '2 days' },
  { hours: 72, label: '3 days' },
]

const DAILY_PRESETS = [2, 3, 4, 6]

const COOK_MSGS = [
  '🍳 Reading your notes…',
  '🧂 Pulling out the key concepts…',
  '🥣 Drafting flashcards…',
  '🔥 Sketching practice questions…',
  '🍮 Tasting for difficulty…',
  '📋 Reducing the cheat sheet…',
]

// A little ambient strip: the AI is already prepping materials in the
// background while the student makes their choices.
function BgCooking() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 1900)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="bg-cook" aria-live="polite">
      <span className="bg-pot">🍳</span>
      <span className="muted small">{COOK_MSGS[i % COOK_MSGS.length]}</span>
      <span className="bg-dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

// Returns minutes-from-midnight, or null for an empty/cleared/malformed input
// (browsers show a clear button on <input type="time">).
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

export default function TimeSelect({ onDone, onBack }) {
  const [step, setStep] = useState(0)
  const [hours, setHours] = useState(24)
  const [daily, setDaily] = useState(4) // hours of study per day
  const [bed, setBed] = useState('23:00')
  const [wake, setWake] = useState('07:00')

  const bedMin = toMin(bed) ?? 23 * 60
  const wakeMin = toMin(wake) ?? 7 * 60
  const sleepH = Math.round((sleepDurationMin(bedMin, wakeMin) / 60) * 10) / 10

  const testDateLabel = new Date(Date.now() + hours * 3600000).toLocaleString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const finish = () =>
    // Snap the whole schedule to a 15-minute grid from the start.
    onDone(
      new Date(
        Math.round((Date.now() + hours * 3600000) / (15 * 60000)) * (15 * 60000)
      ).toISOString(),
      Math.round(daily * 60),
      { bedMin, wakeMin }
    )

  return (
    <div className="card timeselect">
      {step === 0 && (
        <div className="step-fade" key="s0">
          <h2>⏲️ How long until your test?</h2>
          <div className="time-readout">
            <span className="time-big">{hours === 1 ? '1 hour' : `${hours} hours`}</span>
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
            {TIME_PRESETS.map((p) => (
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
            <button className="btn" onClick={() => setStep(1)}>
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="step-fade" key="s1">
          <h2>📚 How much will you study per day?</h2>
          <div className="time-readout">
            <span className="time-big">{daily} h</span>
            <span className="muted">per day — we’ll split it into spaced sessions</span>
          </div>
          <input
            className="time-slider"
            type="range"
            min="1"
            max="12"
            step="0.5"
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
            aria-label="Study hours per day"
          />
          <div className="preset-row">
            {DAILY_PRESETS.map((h) => (
              <button
                key={h}
                className={`preset-chip ${daily === h ? 'selected' : ''}`}
                onClick={() => setDaily(h)}
              >
                {h} h
              </button>
            ))}
          </div>
          <div className="step-row">
            <button className="btn ghost" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button className="btn" onClick={() => setStep(2)}>
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-fade" key="s2">
          <h2>😴 When do you sleep?</h2>
          <div className="setup-row">
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
            <strong>{sleepH} h</strong> of sleep planned — deep sleep is when studying sticks,
            so don’t skip it.
          </p>
          <div className="step-row">
            <button className="btn ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button className="btn" onClick={finish}>
              Cook up my cram plan 🍳
            </button>
          </div>
        </div>
      )}

      <div className="step-dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`step-dot ${i === step ? 'on' : ''}`} />
        ))}
      </div>
      <BgCooking />
    </div>
  )
}
