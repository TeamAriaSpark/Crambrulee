import { useState } from 'react'
import { weakTopicsFromResults } from '../lib/engine.js'

export default function TestView({ version, onFinish, onBack }) {
  const questions = version.test
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState([])
  const [picked, setPicked] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const q = questions[idx]

  const submit = () => setRevealed(true)

  const next = () => {
    const newAnswers = [...answers, picked]
    setAnswers(newAnswers)
    setPicked(null)
    setRevealed(false)
    if (idx + 1 >= questions.length) {
      const score = newAnswers.filter((a, i) => a === questions[i].answerIdx).length
      const byTopic = {}
      questions.forEach((question, i) => {
        const t = (byTopic[question.topic] ||= { right: 0, total: 0 })
        t.total++
        if (newAnswers[i] === question.answerIdx) t.right++
      })
      onFinish({
        versionId: version.id,
        versionLabel: version.label,
        score,
        total: questions.length,
        byTopic,
        weakTopics: weakTopicsFromResults(questions, newAnswers),
        at: new Date().toISOString(),
      })
    } else {
      setIdx(idx + 1)
    }
  }

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🔥 Practice test</h2>
          <p className="muted">
            Simulated test conditions — no notes, no flipping back. Whatever gets missed here
            gets <strong>refried</strong> into your next batch of materials.
          </p>
        </div>
        <span className="head-side">
          <span className="pill hot">{version.label}</span>{' '}
          {version.level && (
            <span className="pill" title="The difficulty you picked for this test">
              {{ novice: '🌱', competent: '🍳', expert: '👨‍🍳' }[version.level]} {version.level}
            </span>
          )}
        </span>
      </div>

      <div className="question">
        <div className="q-count">
          Question {idx + 1} / {questions.length} · {q.topic}
        </div>
        <div className="q-text">{q.q}</div>
        {q.options.map((opt, i) => {
          let cls = 'option'
          if (revealed) {
            if (i === q.answerIdx) cls += ' correct'
            else if (i === picked) cls += ' wrong'
          } else if (i === picked) cls += ' picked'
          return (
            <button
              key={i}
              className={cls}
              disabled={revealed}
              onClick={() => setPicked(i)}
            >
              {String.fromCharCode(65 + i)}. {opt}
            </button>
          )
        })}
      </div>

      <div className="step-row">
        {!revealed ? (
          <>
            <button className="btn ghost small-btn" onClick={onBack}>
              ← Exit test
            </button>
            <button className="btn" disabled={picked === null} onClick={submit}>
              Lock it in 🔒
            </button>
          </>
        ) : (
          <button className="btn" onClick={next}>
            {idx + 1 >= questions.length ? 'See my results 🍮' : 'Next question →'}
          </button>
        )}
      </div>
    </div>
  )
}
