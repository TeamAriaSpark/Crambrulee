import { useState } from 'react'
import { LEVELS, LEVEL_META } from '../lib/engine.js'
import { suggestStudyBlocks } from '../lib/planner.js'
import VerticalTimeline from './VerticalTimeline.jsx'
import Tour from './Tour.jsx'

const TOUR_KEY = 'cram-brulee-tour-done'
const TOUR_STEPS = [
  {
    selector: '.vt',
    emoji: '⏳',
    title: 'Your runway, top to bottom',
    body: 'Everything in one timeline: spaced study blocks, sleep, practice tests, and your real test. The gaps between blocks are deliberate — that’s when memory consolidates.',
  },
  {
    selector: '.stats-row',
    emoji: '📊',
    title: 'Your numbers at a glance',
    body: 'Time studied vs suggested, your reading/recall mix (aim for ~30/70), your last test score, and your level. They update live as you work.',
  },
  {
    selector: '.vt-session',
    emoji: '📚',
    title: 'Your next study block',
    body: 'Start it whenever you’re ready — inside, switch freely between reading and flashcards, with a break popping up every 45 minutes.',
  },
  {
    selector: '.vt-test',
    emoji: '🔥',
    title: 'The milestone that matters',
    body: 'Practice tests simulate the real thing. After each one, your materials are rebuilt around what you missed. Score 80%+ and you level up.',
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

const fmtSec = (sec) => (sec < 60 ? '<1 min' : fmtDuration(Math.round(sec / 60)))

const fmtIn = (iso) => {
  const min = Math.round((new Date(iso) - Date.now()) / 60000)
  if (min <= 0) return 'now'
  if (min < 60) return `in ~${min} min`
  return `in ~${Math.round(min / 6) / 10} h`
}

export default function PlanView({
  plan,
  testTime,
  results,
  intensity,
  gauge,
  level,
  onLevelChange,
  onStartSession,
  onTest,
}) {
  const tests = plan?.tests || []
  const taken = Math.min(results.length, tests.length)
  const nextTest = tests[taken] || null

  const blocks = suggestStudyBlocks(plan, intensity)
  const nextBlock = blocks.find((b) => new Date(b.to).getTime() > Date.now()) || null

  // Default session length: the next suggested block.
  const recMin = nextBlock
    ? nextBlock.min
    : gauge
      ? Math.max(15, Math.min(300, Math.round(Math.max(0, gauge.targetMin - gauge.doneMin) / 5) * 5 || 30))
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

  const sessionCard = (
    <div className="start-box vt-session">
      <h3>
        📚 {nextBlock ? 'Next study block' : 'Study session'}
        {nextBlock && (
          <span className="pill" style={{ marginLeft: 8 }}>
            suggested {clock(nextBlock.from)}–{clock(nextBlock.to)}
          </span>
        )}
      </h3>
      <p className="muted small">
        Break every{' '}
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
  )

  const testCard = (
    <div className="test-suggest vt-test">
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
              Rebuilds your materials around what you miss
              {LEVELS.indexOf(level) < LEVELS.length - 1 ? (
                <>
                  {' '}· <strong>80%+</strong> →{' '}
                  {LEVEL_META[LEVELS[LEVELS.indexOf(level) + 1]]?.emoji}{' '}
                  <strong>{LEVELS[LEVELS.indexOf(level) + 1]}</strong>
                </>
              ) : (
                <> — you’re at the top shelf 👨‍🍳</>
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
  )

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
            <button className="tour-replay" onClick={() => setTourStep(0)}>
              ❓ tour
            </button>
          </span>
        </div>
      </div>

      {(() => {
        const last = results[results.length - 1] || null
        const mixTotal = gauge ? gauge.readSec + gauge.recallSec : 0
        const readPct = mixTotal > 0 ? Math.round((gauge.readSec / mixTotal) * 100) : null
        const donePct = gauge
          ? Math.min(100, Math.round((gauge.doneMin / gauge.targetMin) * 100))
          : 0
        return (
          <div className="stats-row">
            <div
              className="stat"
              title="Time studied vs suggested for this stretch — resets after each practice test"
            >
              <span className="stat-label">📚 studied</span>
              <span className="stat-value">
                {gauge ? fmtDuration(gauge.doneMin) : '0 min'}
                <span className="stat-of"> / {gauge ? fmtDuration(gauge.targetMin) : '—'}</span>
              </span>
              <div className="gauge-track mini">
                <div
                  className={`gauge-fill ${donePct >= 100 ? 'full' : ''}`}
                  style={{ width: `${donePct}%` }}
                />
              </div>
              <span className="stat-sub">
                {gauge?.testN ? `before practice test ${gauge.testN}` : 'before final review'}
              </span>
            </div>
            <div className="stat" title="Share of your time rereading vs pulling it back out">
              <span className="stat-label">🧠 your mix</span>
              <span className="stat-value">
                {readPct != null ? (
                  <>
                    {readPct}
                    <span className="stat-of"> / </span>
                    {100 - readPct}
                  </>
                ) : (
                  '—'
                )}
              </span>
              {readPct != null ? (
                <div className="split-track mini">
                  <span className="split-study" style={{ width: `${readPct}%` }} />
                  <span className="split-active" style={{ width: `${100 - readPct}%` }} />
                </div>
              ) : (
                <div className="gauge-track mini" />
              )}
              <span className="stat-sub">read / recall · aim ~30 / 70</span>
            </div>
            <div
              className="stat"
              title="Your most recent practice test and level — score 80%+ to level up"
            >
              <span className="stat-label">🔥 last test · level</span>
              <span className="stat-value">
                {last ? (
                  <>
                    {Math.round((last.score / last.total) * 100)}%
                    <span className="stat-of"> · </span>
                    {LEVEL_META[level]?.emoji} {level}
                  </>
                ) : (
                  <>
                    <span className="stat-of">— · </span>
                    {LEVEL_META[level]?.emoji} {level}
                  </>
                )}
              </span>
              <span className="stat-sub">
                {last
                  ? `${last.score}/${last.total}${last.levelUp ? ' · leveled up! 🎉' : ''} · ${taken}/${tests.length} taken`
                  : `none yet — test 1 awaits · 0/${tests.length} taken`}
              </span>
            </div>
          </div>
        )
      })()}

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

      <VerticalTimeline
        plan={plan}
        testTime={testTime}
        results={results}
        intensity={intensity}
        sessionCard={sessionCard}
        testCard={testCard}
      />
    </div>
  )
}
