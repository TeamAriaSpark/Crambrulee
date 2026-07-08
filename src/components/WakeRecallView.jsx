import { useState } from 'react'
import { WAKE_PROMPTS } from '../lib/wake.js'

// Guided wake-up recall: intro → six prompted brain-dump steps → grading.
// The whole point is that this happens BEFORE the student opens any notes.
export default function WakeRecallView({ onGrade, onBack }) {
  const [step, setStep] = useState(-1) // -1 = intro, 0..5 = prompts
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('write') // write | grading | done
  const [result, setResult] = useState(null)

  const prompt = WAKE_PROMPTS[step]
  const written = Object.values(answers).filter((v) => String(v || '').trim()).length

  const grade = async () => {
    setPhase('grading')
    const r = await onGrade(answers)
    setResult(r)
    setPhase('done')
  }

  if (phase === 'grading') {
    return (
      <div className="card cooking">
        <span className="pot">🍮</span>
        <div className="cooking-step">Grading your pour…</div>
        <p className="muted small">Comparing what you remembered against your materials.</p>
      </div>
    )
  }

  if (phase === 'done' && result) {
    return (
      <div className="card">
        <div className="score-plate" style={{ textAlign: 'center' }}>
          <div className="muted small">🌅 wake-up recall coverage</div>
          <div className="score-big">{result.score}%</div>
        </div>
        <p className="muted" style={{ textAlign: 'center', maxWidth: 560, margin: '10px auto 0' }}>
          {result.feedback}
        </p>
        {result.note && <p className="cook-note">⚠️ {result.note}</p>}
        <div className="wake-cols">
          <div>
            <h3>✅ Came back</h3>
            {result.recalled.length ? (
              result.recalled.map((t) => (
                <span key={t} className="pill" style={{ margin: '0 6px 6px 0' }}>
                  {t}
                </span>
              ))
            ) : (
              <p className="muted small">Nothing yet — that’s your starting line.</p>
            )}
          </div>
          <div>
            <h3>🔥 Still buried</h3>
            {result.missed.length ? (
              result.missed.map((t) => (
                <span key={t} className="pill hot" style={{ margin: '0 6px 6px 0' }}>
                  {t}
                </span>
              ))
            ) : (
              <p className="muted small">Nothing — everything surfaced. 👨‍🍳</p>
            )}
          </div>
        </div>
        <div className="step-row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={onBack}>
            {result.missed.length ? 'Study the gaps first →' : 'Back to the plan →'}
          </button>
        </div>
      </div>
    )
  }

  if (step === -1) {
    return (
      <div className="card wake-intro">
        <h2>🌅 Wake-up recall</h2>
        <p className="muted" style={{ maxWidth: 560 }}>
          <strong>Don’t open your notes yet.</strong> While you slept, your brain filed
          yesterday’s studying into long-term memory. Writing down everything you can retrieve —
          right now, cold — is the strongest way to lock it in. Blanks aren’t failure; they show
          you exactly what to study first.
        </p>
        <p className="muted small">
          Six quick prompts: formulas, concepts, definitions, processes, mistakes, and
          yesterday’s hard topics. Then we grade your pour against your materials.
        </p>
        <div className="step-row">
          <button className="btn ghost" onClick={onBack}>
            ← Not now
          </button>
          <button className="btn" onClick={() => setStep(0)}>
            Pour it out →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>
            {prompt.emoji} {prompt.title}
          </h2>
          <p className="muted small">{prompt.hint}</p>
        </div>
        <span className="pill">
          {step + 1} / {WAKE_PROMPTS.length}
        </span>
      </div>
      <textarea
        className="paste wake-input"
        rows={7}
        autoFocus
        placeholder="Everything you can retrieve — fragments count. No peeking at notes."
        value={answers[prompt.key] || ''}
        onChange={(e) => setAnswers((a) => ({ ...a, [prompt.key]: e.target.value }))}
      />
      <div className="step-row">
        <button className="btn ghost" onClick={() => setStep(step - 1)}>
          ← Back
        </button>
        {step < WAKE_PROMPTS.length - 1 ? (
          <button className="btn" onClick={() => setStep(step + 1)}>
            Next →
          </button>
        ) : (
          <button className="btn" onClick={grade} disabled={written === 0}>
            Grade my recall 🍮
          </button>
        )}
        {step === WAKE_PROMPTS.length - 1 && written === 0 && (
          <span className="muted small" style={{ alignSelf: 'center' }}>
            write something in at least one prompt
          </span>
        )}
      </div>
    </div>
  )
}
