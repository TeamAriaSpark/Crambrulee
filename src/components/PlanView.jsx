import { useState } from 'react'
import { LEVELS, LEVEL_META } from '../lib/engine.js'
import { suggestStudyBlocks } from '../lib/planner.js'
import VerticalTimeline from './VerticalTimeline.jsx'
import Tour from './Tour.jsx'

const TOUR_KEY = 'cram-brulee-tour-done'
const TOUR_STEPS = [
  {
    selector: '.vt-session',
    emoji: '📚',
    title: 'Your study hub',
    body: 'Everything study in one place: time done vs suggested, your reading/recall mix (aim ~30/70), today’s portion, and the button that starts a session — breaks pop up automatically.',
  },
  {
    selector: '.vt-test',
    emoji: '🔥',
    title: 'The milestone that matters',
    body: 'Practice tests simulate the real thing and show your last score. Afterwards your materials are rebuilt around what you missed — 80%+ levels you up.',
  },
  {
    selector: '.chip-group',
    emoji: '⏲️',
    title: 'Countdown & Cram Mode',
    body: 'The timer counts down to your test — hover it for your day-by-day runway. Hit Cram Mode! and the AI schedules every block, minute by minute.',
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
  wakeRecalls,
  cramMode,
  onLevelChange,
  onStartSession,
  onTest,
  onWake,
}) {
  const now = Date.now()
  const tests = plan?.tests || []
  const taken = Math.min(results.length, tests.length)
  const nextTest = tests[taken] || null
  const last = results[results.length - 1] || null

  const blocks = suggestStudyBlocks(plan, intensity)
  const nextBlock = blocks.find((b) => new Date(b.to).getTime() > now) || null

  // Today's remaining portion of the daily target.
  const todayKey = new Date().toDateString()
  let todayLeftMin = 0
  for (const b of blocks) {
    if (new Date(b.from).toDateString() !== todayKey) continue
    todayLeftMin += Math.max(0, Math.round((new Date(b.to).getTime() - Math.max(new Date(b.from).getTime(), now)) / 60000))
  }
  todayLeftMin = Math.round(todayLeftMin / 15) * 15
  const dailyMin = typeof intensity === 'number' ? intensity : null

  // Is a wake-up recall due right now?
  const wakeActive = (plan.sleeps || []).some((s) => {
    const wakeMs = new Date(s.to).getTime()
    const logged = (wakeRecalls || []).some((w) => {
      const t = new Date(w.at).getTime()
      return t >= new Date(s.from).getTime() && t <= wakeMs + 6 * 3600000
    })
    return !logged && now >= wakeMs && now <= wakeMs + 6 * 3600000
  })

  // Recommended session length: whatever is left of the suggested study
  // time before the next practice test.
  const recMin = gauge
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

  const mixTotal = gauge ? gauge.readSec + gauge.recallSec : 0
  const readPct = mixTotal > 0 ? Math.round((gauge.readSec / mixTotal) * 100) : null
  const totalTargetMin = Math.max(15, blocks.reduce((m, b) => m + b.min, 0))
  const totalDonePct = gauge
    ? Math.min(100, Math.round(((gauge.totalDoneMin || 0) / totalTargetMin) * 100))
    : 0

  // One card for everything study: meters + today's portion + start controls.
  const sessionCard = (
    <div className="start-box vt-session study-hub">
      <div className="hub-head">
        <h3>
          📚 Study
          {cramMode && nextBlock && (
            <span className="pill" style={{ marginLeft: 8 }}>
              next block {clock(nextBlock.from)}–{clock(nextBlock.to)}
            </span>
          )}
        </h3>
        {todayLeftMin >= 15 && (
          <span className="hub-quota" title="Today's remaining portion — split it however suits you">
            ~{fmtDuration(todayLeftMin)} left today
            {dailyMin ? ` of ${fmtDuration(dailyMin)}/day` : ''}
          </span>
        )}
      </div>

      {gauge && (
        <div className="hub-meters">
          <div className="hub-meter" title="Total time studied vs the whole plan's suggestion">
            <span className="stat-label">📚 studied</span>
            <span className="stat-value">
              {fmtDuration(gauge.totalDoneMin || 0)}
              <span className="stat-of"> / {fmtDuration(totalTargetMin)}</span>
            </span>
            <div className="gauge-track mini">
              <div
                className={`gauge-fill ${totalDonePct >= 100 ? 'full' : ''}`}
                style={{ width: `${totalDonePct}%` }}
              />
            </div>
            <span className="stat-sub">
              {fmtDuration(gauge.doneMin)} / {fmtDuration(gauge.targetMin)} before{' '}
              {gauge.testN ? `test ${gauge.testN}` : 'final review'}
            </span>
          </div>
          <div className="hub-meter" title="Share of your time rereading vs pulling it back out">
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
        </div>
      )}

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
        <span className="muted small hub-break">
          break every{' '}
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
          min
        </span>
      </div>
      <button className="btn start-btn" onClick={() => onStartSession(sessionLen, breakEvery)}>
        Start study session →
      </button>
    </div>
  )

  // One card for everything test: next milestone + last result + the button.
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
              {last ? (
                <>
                  Last score: <strong>{Math.round((last.score / last.total) * 100)}%</strong> (
                  {last.score}/{last.total}){last.levelUp ? ' · leveled up! 🎉' : ''} ·{' '}
                  {taken}/{tests.length} taken
                </>
              ) : (
                <>No tests taken yet — this is the milestone that matters</>
              )}
              {LEVELS.indexOf(level) < LEVELS.length - 1 && (
                <>
                  {' '}· <strong>80%+</strong> →{' '}
                  {LEVEL_META[LEVELS[LEVELS.indexOf(level) + 1]]?.emoji}{' '}
                  <strong>{LEVELS[LEVELS.indexOf(level) + 1]}</strong>
                </>
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
              {last && (
                <>
                  Last score: <strong>{Math.round((last.score / last.total) * 100)}%</strong>{' '}
                  ({last.score}/{last.total}) ·{' '}
                </>
              )}
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

      {wakeActive && !cramMode && onWake && (
        <div className="wake-banner">
          <span>
            <strong>🌅 Wake-up recall</strong> · ~10 min — before you open your notes, write
            down everything you remember.
          </span>
          <button className="btn small-btn" onClick={onWake}>
            Do it now 🌅
          </button>
        </div>
      )}

      {cramMode ? (
        <div className="plan-timeline">
          <VerticalTimeline
            plan={plan}
            testTime={testTime}
            results={results}
            intensity={intensity}
            sessionCard={sessionCard}
            testCard={testCard}
            wakeRecalls={wakeRecalls}
            onWake={onWake}
          />
        </div>
      ) : (
        <>
          {sessionCard}
          {testCard}
        </>
      )}
    </div>
  )
}
