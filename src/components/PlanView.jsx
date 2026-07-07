import { useState } from 'react'
import { LEVELS, LEVEL_META } from '../lib/engine.js'
import Tour from './Tour.jsx'

const TOUR_KEY = 'cram-brulee-tour-done'
const TOUR_STEPS = [
  {
    selector: '.tl-pop',
    emoji: '⏲️',
    title: 'Your countdown & timeline',
    body: 'This ticks down to your test. Hover or click it any time to see your full runway — suggested practice tests and a draggable sleep block.',
  },
  {
    selector: '.start-box',
    emoji: '📚',
    title: 'Start a study session',
    body: 'Pick a length — we recommend studying right up to your next practice test. Inside, switch freely between reading and flashcards; a break pops up every 45 minutes (customizable).',
  },
  {
    selector: '.test-suggest',
    emoji: '🔥',
    title: 'The milestone that matters',
    body: 'Practice tests simulate the real thing. After each one, your summaries, flashcards, and next test are rebuilt around what you missed. Score 80%+ and you level up.',
  },
  {
    selector: '.level-select',
    emoji: '🌡️',
    title: 'Difficulty rises with you',
    body: 'Materials start at novice. Ace a practice test to move up automatically, or pick a level yourself any time.',
  },
]

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const fmtDuration = (min) =>
  min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`

const fmtIn = (iso) => {
  const min = Math.round((new Date(iso) - Date.now()) / 60000)
  if (min <= 0) return 'now'
  if (min < 60) return `in ~${min} min`
  return `in ~${Math.round(min / 6) / 10} h`
}

export default function PlanView({
  plan,
  results,
  level,
  onLevelChange,
  onStartSession,
  onTest,
}) {
  const tests = plan?.tests || []
  const taken = Math.min(results.length, tests.length)
  const nextTest = tests[taken] || null

  // Recommended session length: study right up to the next practice test.
  const recMin = nextTest
    ? Math.min(
        300,
        Math.max(15, Math.round((new Date(nextTest.suggestedAt) - Date.now()) / 60000 / 5) * 5)
      )
    : 60
  const [sessionLen, setSessionLen] = useState(recMin)
  const [breakEvery, setBreakEvery] = useState(45)

  const [tourStep, setTourStep] = useState(() =>
    localStorage.getItem(TOUR_KEY) ? -1 : 0
  )
  const endTour = () => {
    localStorage.setItem(TOUR_KEY, '1')
    setTourStep(-1)
  }

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
        </div>
        <div className="head-controls">
          <label className="level-select">
            <span className="muted small">Level</span>
            <select value={level} onChange={(e) => onLevelChange(e.target.value)}>
              <option value="novice">🌱 Novice</option>
              <option value="competent">🍳 Competent</option>
              <option value="expert">👨‍🍳 Expert</option>
            </select>
            <span className="level-tooltip">
              <strong>🌡️ Difficulty</strong> — changes how hard your summaries, flashcards, and
              practice tests are. Pick one yourself, or it levels up automatically when you
              score 80%+ on a practice test.
            </span>
          </label>
          <span className="muted small level-note">
            score 80%+ to level up · {taken}/{tests.length} tests taken ·{' '}
            <button className="tour-replay" onClick={() => setTourStep(0)}>
              ❓ tour
            </button>
          </span>
        </div>
      </div>

      {tourStep >= 0 && (
        <Tour
          steps={TOUR_STEPS}
          step={tourStep}
          onNext={() =>
            tourStep >= TOUR_STEPS.length - 1 ? endTour() : setTourStep(tourStep + 1)
          }
          onSkip={endTour}
        />
      )}

      <div className="start-box">
        <h3>📚 Study session</h3>
        <p className="muted small">
          Recommended: <strong>{fmtDuration(recMin)}</strong>
          {nextTest && <> — takes you right up to practice test {nextTest.n}</>}. Break every{' '}
          <input
            className="inline-num"
            type="number"
            min="10"
            max="120"
            value={breakEvery}
            onChange={(e) =>
              setBreakEvery(Math.max(10, Math.min(120, Number(e.target.value) || 45)))
            }
            aria-label="Break interval in minutes"
          />{' '}
          min.
        </p>
        <div className="len-row">
          {[30, 45, 60, 90].map((m) => (
            <button
              key={m}
              className={`preset-chip ${sessionLen === m ? 'selected' : ''}`}
              onClick={() => setSessionLen(m)}
            >
              {fmtDuration(m)}
            </button>
          ))}
          <button
            className={`preset-chip ${sessionLen === recMin ? 'selected' : ''}`}
            onClick={() => setSessionLen(recMin)}
          >
            ⭐ {fmtDuration(recMin)}
          </button>
          <span className="break-custom">
            <input
              type="number"
              min="10"
              max="480"
              value={sessionLen}
              onChange={(e) =>
                setSessionLen(Math.max(10, Math.min(480, Number(e.target.value) || 10)))
              }
              aria-label="Session length in minutes"
            />
            <span className="muted small">min</span>
          </span>
        </div>
        <button className="btn start-btn" onClick={() => onStartSession(sessionLen, breakEvery)}>
          Start study session →
        </button>
      </div>

      <div className="test-suggest">
        {nextTest ? (
          <>
            <div className="suggest-main">
              <div className="milestone-eyebrow">
                🔥 Practice test {nextTest.n} of {tests.length} — suggested at
              </div>
              <div className="suggest-time">
                {clock(nextTest.suggestedAt)}
                <span className="suggest-in">{fmtIn(nextTest.suggestedAt)}</span>
                <span className="pill" title="This test is built at your current level">
                  {LEVEL_META[level]?.emoji} {level} difficulty
                </span>
              </div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                Afterwards your materials are rebuilt around what you missed.
                {LEVELS.indexOf(level) < LEVELS.length - 1 ? (
                  <>
                    {' '}Score <strong>80%+</strong> to move up to{' '}
                    {LEVEL_META[LEVELS[LEVELS.indexOf(level) + 1]]?.emoji}{' '}
                    <strong>{LEVELS[LEVELS.indexOf(level) + 1]}</strong>.
                  </>
                ) : (
                  <> You’re at the top shelf — keep it crispy. 👨‍🍳</>
                )}
              </p>
            </div>
            <button className="btn" onClick={onTest}>
              Take it {fmtIn(nextTest.suggestedAt) === 'now' ? 'now ' : ''}🔥
            </button>
          </>
        ) : (
          <>
            <div className="suggest-main">
              <div className="milestone-eyebrow">🏁 All tests taken — final review at</div>
              <div className="suggest-time">{clock(plan.finalReviewAt)}</div>
              <p className="muted small" style={{ margin: '2px 0 0' }}>
                One calm pass over the cheat sheet, then step away — you’re ready.
              </p>
            </div>
            <button className="btn ghost" onClick={onTest}>
              Retake a test 🔥
            </button>
          </>
        )}
      </div>
    </div>
  )
}
