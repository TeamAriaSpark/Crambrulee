import { useEffect, useState } from 'react'

const STEPS = [
  '🥣 Whisking your notes…',
  '🔍 Skimming off the fluff…',
  '🍯 Caramelizing the key concepts…',
  '🃏 Cutting the flashcard deck…',
  '📝 Prepping your practice tests…',
  '🍮 Plating your cram plan…',
]

export default function Cooking({ onDone }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(onDone, 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), 650)
    return () => clearTimeout(t)
  }, [step, onDone])

  return (
    <div className="card cooking">
      <span className="pot">🍳</span>
      <div className="cooking-step">{STEPS[Math.min(step, STEPS.length - 1)]}</div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, (step / STEPS.length) * 100)}%` }}
        />
      </div>
      <p className="muted small" style={{ marginTop: 18 }}>
        Optimizing your hours for maximum retention — heavy on the recall, light on the rereading.
      </p>
    </div>
  )
}
