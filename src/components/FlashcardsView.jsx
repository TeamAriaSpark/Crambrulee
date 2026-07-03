import { useState } from 'react'
import VersionPicker from './VersionPicker.jsx'

export default function FlashcardsView({
  version,
  versions,
  activeVersion,
  onPickVersion,
  onFinish,
  onBack,
}) {
  const cards = version.flashcards
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [gotIt, setGotIt] = useState(0)
  const [redo, setRedo] = useState([]) // card indexes to re-serve at the end
  const [queue, setQueue] = useState(cards.map((_, i) => i))

  const done = idx >= queue.length
  const cardIdx = done ? null : queue[idx]
  const card = done ? null : cards[cardIdx]

  const grade = (knewIt) => {
    if (knewIt) setGotIt((n) => n + 1)
    else if (!redo.includes(cardIdx)) setRedo((r) => [...r, cardIdx])
    setFlipped(false)
    // Small delay so the card flips back before content swaps.
    setTimeout(() => setIdx((i) => i + 1), 180)
  }

  const serveRedo = () => {
    setQueue(redo)
    setRedo([])
    setIdx(0)
    setFlipped(false)
  }

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>🧠 Recall round done!</h2>
        <p className="muted">
          {gotIt} of {cards.length} cards landed on the first try.
          {redo.length > 0
            ? ' The tricky ones are worth one more pass — struggling to remember is literally what makes it stick.'
            : ' Beautifully caramelized. 👨‍🍳'}
        </p>
        <div className="step-row" style={{ justifyContent: 'center' }}>
          {redo.length > 0 && (
            <button className="btn" onClick={serveRedo}>
              Re-serve the tricky {redo.length} 🍳
            </button>
          )}
          <button className={`btn ${redo.length > 0 ? 'ghost' : ''}`} onClick={onFinish}>
            Back to the plan →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🧠 Active recall</h2>
          <p className="muted">
            Notes closed. Answer <em>before</em> you flip — the reach is the workout.
          </p>
        </div>
        <span className="pill">{card.topic}</span>
      </div>

      <VersionPicker versions={versions} activeVersion={activeVersion} onPick={onPickVersion} />

      <div className="flash-stage">
        <div
          className={`flashcard ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === ' ' && setFlipped((f) => !f)}
        >
          <div className="flash-face front">
            <span className="muted small">QUESTION · tap to flip</span>
            <div className="content">{card.q}</div>
          </div>
          <div className="flash-face back">
            <span className="muted small">ANSWER</span>
            <div className="content">{card.a}</div>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="flash-controls">
          <button className="btn needs" onClick={() => grade(false)}>
            Still raw 🥴
          </button>
          <button className="btn got" onClick={() => grade(true)}>
            Nailed it ✅
          </button>
        </div>
      ) : (
        <div className="flash-controls">
          <button className="btn ghost" onClick={() => setFlipped(true)}>
            Flip the card 🔄
          </button>
        </div>
      )}

      <div className="deck-progress">
        Card {idx + 1} of {queue.length}
      </div>

      <div className="step-row">
        <button className="btn ghost small-btn" onClick={onBack}>
          ← Back to plan
        </button>
      </div>
    </div>
  )
}
