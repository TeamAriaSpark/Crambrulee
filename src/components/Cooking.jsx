import { useEffect, useRef, useState } from 'react'

export const COOK_STEPS = [
  '🥣 Whisking your notes…',
  '🔍 Skimming off the fluff…',
  '🍯 Caramelizing the key concepts…',
  '🃏 Cutting the flashcard deck…',
  '📝 Prepping your practice tests…',
  '🍮 Plating your cram plan…',
]

export const REFRY_STEPS = [
  '🔍 Reading your test results…',
  '🌶️ Adding heat to the weak topics…',
  '🍯 Re-caramelizing the summaries…',
  '🃏 Re-cutting the flashcard deck…',
  '📝 Writing a fresh practice test…',
  '🍳 Refrying to a crisp…',
]

// Animates the kitchen while `job` (an async generator of materials) runs.
// Finishes when both the job has resolved and at least one full pass of the
// step animation has played; loops the steps if the job needs longer (AI
// cooking can take a minute).
export default function Cooking({ steps = COOK_STEPS, job, onDone, ai = false }) {
  const [step, setStep] = useState(0)
  const [result, setResult] = useState(undefined)
  const startedRef = useRef(false)
  const firedRef = useRef(false)

  // Hold onDone in a ref so App re-renders (the 1s countdown) can't change its
  // identity out from under the completion effect and cancel the hand-off.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    job().then((value) => setResult({ value }))
    // job never rejects — the App-level wrapper falls back to the local engine
  }, [job])

  const waiting = result === undefined
  const finished = !waiting && step >= steps.length

  useEffect(() => {
    if (finished) return
    const t = setTimeout(() => setStep((s) => s + 1), waiting && step >= steps.length ? 1400 : 700)
    return () => clearTimeout(t)
  }, [step, waiting, finished, steps.length])

  useEffect(() => {
    if (!finished || firedRef.current) return
    firedRef.current = true
    const t = setTimeout(() => onDoneRef.current(result.value), 300)
    return () => clearTimeout(t)
  }, [finished, result])

  const pct = finished ? 100 : Math.min(92, Math.round(100 * (1 - Math.exp(-(step + 1) / 4))))
  const slowCook = waiting && step >= steps.length

  return (
    <div className="card cooking">
      <span className="pot">🍳</span>
      <div className="cooking-step">
        {slowCook ? '🍮 Slow-cooking for extra flavor…' : steps[Math.min(step, steps.length - 1)]}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small" style={{ marginTop: 18 }}>
        {ai
          ? 'Claude is personally in the kitchen — real AI cooking takes a minute, and it’s worth it.'
          : 'Optimizing your hours for maximum retention — heavy on the recall, light on the rereading.'}
      </p>
    </div>
  )
}
