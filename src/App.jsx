import { useCallback, useEffect, useRef, useState } from 'react'
import Upload from './components/Upload.jsx'
import TimeSelect from './components/TimeSelect.jsx'
import Cooking, { COOK_STEPS, REFRY_STEPS } from './components/Cooking.jsx'
import PlanView from './components/PlanView.jsx'
import SessionView, { sessionRecommendation } from './components/SessionView.jsx'
import VerticalTimeline from './components/VerticalTimeline.jsx'
import RelaxedTimeline from './components/RelaxedTimeline.jsx'
import StudyView from './components/StudyView.jsx'
import FlashcardsView from './components/FlashcardsView.jsx'
import TestView from './components/TestView.jsx'
import ResultsView from './components/ResultsView.jsx'
import WakeRecallView from './components/WakeRecallView.jsx'
import { generateMaterials, LEVELS } from './lib/engine.js'
import { generateMaterialsAI, gradeWakeRecallAI, hasApiKey } from './lib/ai.js'
import { houseGradeWakeRecall } from './lib/wake.js'
import { generatePlan, suggestedStudyMin, suggestStudyBlocks } from './lib/planner.js'

const STORAGE_KEY = 'cram-brulee-v5' // v5: loose plan — suggested test times only

const emptyState = {
  screen: 'upload',
  materials: null, // { name, text }
  testTime: null, // ISO string
  cookingJob: null, // { kind: 'initial' } | { kind: 'refry', weakTopics } | { kind: 'recook' }
  plan: null, // { startedAt, finalReviewAt, tests: [{ id, n, suggestedAt }] }
  versions: [], // generated materials, newest last
  activeVersion: 0, // index into versions being viewed
  results: [], // { versionId, score, total, byTopic, weakTopics, at }
  timeSpent: { study: 0, active: 0, break: 0 }, // seconds actually spent on each kind of task
  breakTimer: null, // { startedAt, lengthMin, until } while a break is running/over
  session: null, // { startedAt, lengthMin, until, breakEveryMin, nextBreakAt, mode, base }
  sessionGoal: null, // { targetMin, base: {study, active}, testN } — suggested study before the next test
  wakeRecalls: [], // graded morning brain-dumps: { at, score, recalled, missed, feedback, source }
  intensity: 'steady', // chill | steady | intense — scales suggested study time
  sleepWindow: null, // { bedMin, wakeMin } — the student's chosen sleep hours
  cramMode: false, // false: daily study portions · true: every block scheduled
  level: 'novice', // novice | competent | expert — advances on strong practice-test scores
}

// The study-time gauge target: how much study we suggest between now and the
// next untaken practice test (intensity-scaled awake time), frozen at plan
// creation / after each test so the gauge fills steadily.
function goalFrom(plan, testsTaken, timeSpent, intensity) {
  const next = plan?.tests?.[testsTaken] || null
  // Target = the sum of the suggested spaced blocks for this stretch, so
  // the gauge always agrees with what the timeline shows.
  const stretchBlocks = suggestStudyBlocks(plan, intensity).filter((b) =>
    next ? b.beforeTest === next.n : b.beforeTest === null
  )
  const until = next ? next.suggestedAt : plan?.finalReviewAt
  const suggested = stretchBlocks.length
    ? stretchBlocks.reduce((m, b) => m + b.min, 0)
    : until
      ? suggestedStudyMin(new Date().toISOString(), until, plan?.sleeps || [], intensity)
      : 60
  return {
    targetMin: Math.min(600, Math.max(15, suggested)),
    base: { study: timeSpent?.study || 0, active: timeSpent?.active || 0 },
    testN: next?.n || null,
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = { ...emptyState, ...JSON.parse(raw) }
    // A finished test date means the session is over; start fresh.
    if (parsed.testTime && new Date(parsed.testTime) < new Date()) return emptyState
    return parsed
  } catch {
    return emptyState
  }
}

function useCountdown(testTime) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!testTime) return null
  const ms = Math.max(0, new Date(testTime) - now)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return { ms, text: `${h}:${pad(m)}:${pad(s)}` }
}

export default function App() {
  const [state, setState] = useState(loadState)
  const countdown = useCountdown(state.testTime)
  const [tlPinned, setTlPinned] = useState(false)
  const [sessionChipOpen, setSessionChipOpen] = useState(false)
  const chipRef = useRef(null)

  // A pinned session-timer panel closes when you tap/click outside it.
  useEffect(() => {
    if (!sessionChipOpen) return
    const onDoc = (e) => {
      if (chipRef.current && !chipRef.current.contains(e.target)) setSessionChipOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [sessionChipOpen])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Plans saved before the gauge existed (or before it split reading vs
  // recall) have no usable goal — backfill one.
  useEffect(() => {
    if (!state.plan || state.sessionGoal?.base) return
    setState((s) =>
      s.plan && !s.sessionGoal?.base
        ? { ...s, sessionGoal: goalFrom(s.plan, s.results.length, s.timeSpent, s.intensity) }
        : s
    )
  }, [state.plan, state.sessionGoal])

  // Track real time on task: study screens count as reading, flashcards and
  // practice tests count as active recall. Only ticks while the tab is visible.
  useEffect(() => {
    const bucket =
      state.screen === 'session'
        ? state.session?.mode === 'recall'
          ? 'active'
          : 'study'
        : { study: 'study', flashcards: 'active', test: 'active', wake: 'active' }[state.screen]
    if (!bucket) return
    const TICK = 5
    const t = setInterval(() => {
      if (document.hidden) return
      setState((s) => ({
        ...s,
        timeSpent: {
          ...emptyState.timeSpent,
          ...s.timeSpent,
          [bucket]: (s.timeSpent?.[bucket] || 0) + TICK,
        },
      }))
    }, TICK * 1000)
    return () => clearInterval(t)
  }, [state.screen, state.session?.mode])

  // Break time tallies while the break timer runs, whatever screen or tab
  // state — the whole point of a break is walking away.
  useEffect(() => {
    if (!state.breakTimer) return
    const t = setInterval(() => {
      setState((s) => {
        if (!s.breakTimer || new Date(s.breakTimer.until) <= Date.now()) return s
        return {
          ...s,
          timeSpent: { ...s.timeSpent, break: (s.timeSpent?.break || 0) + 5 },
        }
      })
    }, 5000)
    return () => clearInterval(t)
  }, [Boolean(state.breakTimer)])

  // Ending or skipping a break schedules the next one a full interval out.
  const nextBreakPatch = (s) =>
    s.session
      ? {
          session: {
            ...s.session,
            nextBreakAt: new Date(
              Date.now() + (s.session.breakEveryMin || 45) * 60000
            ).toISOString(),
          },
        }
      : {}
  const breakHandlers = {
    onBreakStart: (lengthMin) =>
      update({
        breakTimer: {
          startedAt: new Date().toISOString(),
          lengthMin,
          until: new Date(Date.now() + lengthMin * 60000).toISOString(),
        },
      }),
    onBreakExtend: () =>
      setState((s) =>
        s.breakTimer
          ? {
              ...s,
              breakTimer: {
                ...s.breakTimer,
                until: new Date(
                  Math.max(new Date(s.breakTimer.until).getTime(), Date.now()) + 5 * 60000
                ).toISOString(),
              },
            }
          : s
      ),
    onBreakEnd: () => setState((s) => ({ ...s, breakTimer: null, ...nextBreakPatch(s) })),
    onBreakSkip: () => setState((s) => ({ ...s, ...nextBreakPatch(s) })),
  }

  const startSession = (lengthMin, breakEveryMin) => {
    const now = Date.now()
    setState((s) => ({
      ...s,
      session: {
        startedAt: new Date(now).toISOString(),
        lengthMin,
        until: new Date(now + lengthMin * 60000).toISOString(),
        breakEveryMin,
        nextBreakAt: new Date(now + breakEveryMin * 60000).toISOString(),
        mode: 'study',
        // Snapshot so the chip tooltip can show this session's reading/recall mix.
        base: { study: s.timeSpent?.study || 0, active: s.timeSpent?.active || 0 },
      },
      screen: 'session',
    }))
  }
  const endSession = () => {
    setSessionChipOpen(false)
    update({ session: null, breakTimer: null, screen: 'plan' })
  }

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

  const currentVersion = state.versions[state.activeVersion] || null
  const latestVersion = state.versions[state.versions.length - 1] || null

  // Two-tap reset instead of window.confirm() — blocking dialogs are
  // suppressed in sandboxed embeds, where the logo would silently do nothing.
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => {
    if (!confirmReset) return
    const t = setTimeout(() => setConfirmReset(false), 4000)
    return () => clearTimeout(t)
  }, [confirmReset])

  const startOver = () => {
    if (state.materials && !confirmReset) {
      setConfirmReset(true)
      return
    }
    setConfirmReset(false)
    localStorage.removeItem(STORAGE_KEY)
    setState(emptyState)
  }

  // Cook one batch of materials: Claude when the user has added an API key,
  // the local engine otherwise — and as the safety net when the AI call fails.
  const cookMaterials = useCallback(
    async (opts) => {
      const text = state.materials?.text || ''
      const fullOpts = { level: state.level || 'novice', ...opts }
      if (hasApiKey()) {
        try {
          return await generateMaterialsAI(text, fullOpts)
        } catch (err) {
          console.warn('AI kitchen unavailable, using the house engine:', err)
          const fallback = generateMaterials(text, fullOpts)
          fallback.note = `The AI kitchen hit a snag (${err?.message || 'unknown error'}), so this batch was cooked with the house engine.`
          return fallback
        }
      }
      return generateMaterials(text, fullOpts)
    },
    [state.materials, state.level]
  )

  const cookingJob = state.cookingJob || { kind: 'initial' }
  const runCookingJob = useCallback(async () => {
    const nextVersion = (state.versions[state.versions.length - 1]?.version || 1) + 1
    if (cookingJob.kind === 'refry')
      return cookMaterials({ weakTopics: cookingJob.weakTopics, version: nextVersion })
    if (cookingJob.kind === 'recook') return cookMaterials({ version: nextVersion })
    return cookMaterials({ version: 1 })
  }, [cookingJob, cookMaterials, state.versions])

  // Changing difficulty re-cooks the materials at the new level.
  const handleLevelChange = (level) => {
    if (!LEVELS.includes(level) || level === state.level) return
    if (state.versions.length > 0) {
      update({ level, cookingJob: { kind: 'recook' }, screen: 'cooking' })
    } else {
      update({ level })
    }
  }

  const handleCooked = (fresh) => {
    if (cookingJob.kind === 'refry' || cookingJob.kind === 'recook') {
      // Land back on the plan: the fresh batch is what the next study
      // session serves, and the standalone study screen has no session
      // timer, breaks, or recall toggle.
      setState((s) => ({
        ...s,
        versions: [...s.versions, fresh],
        activeVersion: s.versions.length,
        cookingJob: null,
        screen: 'plan',
      }))
    } else {
      const plan = generatePlan(state.testTime, undefined, state.sleepWindow)
      setState((s) => ({
        ...s,
        plan,
        sessionGoal: goalFrom(plan, 0, s.timeSpent, s.intensity),
        versions: [fresh],
        activeVersion: 0,
        cookingJob: null,
        screen: 'plan',
      }))
    }
  }

  const handleRefry = (weakTopics) =>
    update({ cookingJob: { kind: 'refry', weakTopics }, screen: 'cooking' })

  // Grade a wake-up recall dump: Claude when a key is set, the local
  // coverage grader otherwise (and as the fallback when the call fails).
  const gradeWake = async (answers) => {
    const version = currentVersion
    const dumpText = Object.values(answers).filter(Boolean).join('\n')
    let result
    if (hasApiKey()) {
      try {
        result = await gradeWakeRecallAI(answers, version)
      } catch (err) {
        result = houseGradeWakeRecall(dumpText, version)
        result.note = `AI grading unavailable (${err?.message || 'unknown error'}) — graded with the house engine instead.`
      }
    } else {
      result = houseGradeWakeRecall(dumpText, version)
    }
    const entry = { ...result, at: new Date().toISOString() }
    setState((s) => ({ ...s, wakeRecalls: [...(s.wakeRecalls || []), entry] }))
    return entry
  }

  const screens = {
    upload: (
      <Upload
        onDone={(materials) => update({ materials, screen: 'time' })}
      />
    ),
    time: (
      <TimeSelect
        onBack={() => update({ screen: 'upload' })}
        onDone={(testTime, intensity, sleepWindow) =>
          update({
            testTime,
            intensity,
            sleepWindow,
            cookingJob: { kind: 'initial' },
            screen: 'cooking',
          })
        }
      />
    ),
    cooking: (
      <Cooking
        key={`${cookingJob.kind}-${state.versions.length}`}
        steps={cookingJob.kind === 'refry' ? REFRY_STEPS : COOK_STEPS}
        job={runCookingJob}
        onDone={handleCooked}
        ai={hasApiKey()}
      />
    ),
    plan: state.plan && (
      <PlanView
        plan={state.plan}
        testTime={state.testTime}
        results={state.results}
        intensity={state.intensity || 'steady'}
        gauge={(() => {
          const g = state.sessionGoal
          if (!g?.base) return null
          const readSec = Math.max(0, (state.timeSpent?.study || 0) - g.base.study)
          const recallSec = Math.max(0, (state.timeSpent?.active || 0) - g.base.active)
          return {
            doneMin: Math.round((readSec + recallSec) / 60),
            targetMin: g.targetMin,
            testN: g.testN,
            readSec,
            recallSec,
            totalDoneMin: Math.round(
              ((state.timeSpent?.study || 0) + (state.timeSpent?.active || 0)) / 60
            ),
          }
        })()}
        level={state.level || 'novice'}
        wakeRecalls={state.wakeRecalls || []}
        cramMode={Boolean(state.cramMode)}
        onToggleCram={() => setState((s) => ({ ...s, cramMode: !s.cramMode }))}
        onLevelChange={handleLevelChange}
        onStartSession={startSession}
        onTest={() => update({ screen: 'test' })}
        onWake={() => update({ screen: 'wake' })}
      />
    ),
    wake: currentVersion && (
      <WakeRecallView onGrade={gradeWake} onBack={() => update({ screen: 'plan' })} />
    ),
    session: state.session && currentVersion && (
      <SessionView
        session={state.session}
        breakTimer={state.breakTimer}
        timeSpent={state.timeSpent}
        versions={state.versions}
        activeVersion={state.activeVersion}
        onPickVersion={(i) => update({ activeVersion: i })}
        onMode={(mode) =>
          setState((s) => (s.session ? { ...s, session: { ...s.session, mode } } : s))
        }
        onEnd={endSession}
        onTest={() => update({ session: null, breakTimer: null, screen: 'test' })}
        {...breakHandlers}
      />
    ),
    study: currentVersion && (
      <StudyView
        version={currentVersion}
        versions={state.versions}
        activeVersion={state.activeVersion}
        onPickVersion={(i) => update({ activeVersion: i })}
        onFinish={() => update({ screen: 'flashcards' })}
        onBack={() => update({ screen: 'plan' })}
      />
    ),
    flashcards: currentVersion && (
      <FlashcardsView
        version={currentVersion}
        versions={state.versions}
        activeVersion={state.activeVersion}
        onPickVersion={(i) => update({ activeVersion: i })}
        onFinish={() => update({ screen: 'plan' })}
        onBack={() => update({ screen: 'plan' })}
      />
    ),
    test: latestVersion && (
      <TestView
        version={latestVersion}
        onFinish={(result) => {
          setState((s) => {
            // Score ≥ 80% advances the student to the next difficulty level.
            const currentLevel = s.level || 'novice'
            const idx = LEVELS.indexOf(currentLevel)
            const leveledUp =
              result.score / result.total >= 0.8 && idx < LEVELS.length - 1
                ? LEVELS[idx + 1]
                : null
            const results = [...s.results, { ...result, levelUp: leveledUp }]
            return {
              ...s,
              level: leveledUp || currentLevel,
              results,
              // Fresh gauge target for the stretch to the next practice test.
              sessionGoal: goalFrom(s.plan, results.length, s.timeSpent, s.intensity),
              screen: 'results',
            }
          })
        }}
        onBack={() => update({ screen: 'plan' })}
      />
    ),
    results: state.results.length > 0 && (
      <ResultsView
        result={state.results[state.results.length - 1]}
        level={state.level || 'novice'}
        onRefry={handleRefry}
        onRecook={() => update({ cookingJob: { kind: 'recook' }, screen: 'cooking' })}
        onPlan={() => update({ screen: 'plan' })}
      />
    ),
  }

  return (
    <div className="app">
      <header className="masthead">
        <button
          className={`brand ${confirmReset ? 'confirm-reset' : ''}`}
          onClick={startOver}
          title="Start a fresh batch"
        >
          <span className="brand-flan">{confirmReset ? '🗑️' : '🍮'}</span>
          <span>
            <h1>
              cram <span className="brule">brûlée</span>
            </h1>
            <p className="tagline">
              {confirmReset
                ? 'tap again to toss this batch and start fresh'
                : 'active recall is our special sauce'}
            </p>
          </span>
        </button>
        {state.screen === 'session' && state.session ? (
          <div className="head-right">
            {(() => {
              const now = Date.now()
              const startMs = new Date(state.session.startedAt).getTime()
              const endMs = new Date(state.session.until).getTime()
              const rem = Math.max(0, endMs - now)
              const sessionMs = Math.max(endMs - startMs, 1)
              const pad = (n) => String(n).padStart(2, '0')
              const fmt = (msLeft) => {
                const h = Math.floor(msLeft / 3600000)
                const m = Math.floor((msLeft % 3600000) / 60000)
                const s = Math.floor((msLeft % 60000) / 1000)
                return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
              }
              const left = fmt(rem)
              const onBreak = state.breakTimer && new Date(state.breakTimer.until) > now
              const breakMs = Math.max(0, new Date(state.session.nextBreakAt) - now)
              const rec = sessionRecommendation(state.session)
              // The bubble shows only the time to the next break.
              const chipTime =
                rem === 0 ? '🎉' : onBreak ? '☕ break' : breakMs === 0 ? '☕ now' : `☕ ${fmt(breakMs)}`
              const breakLabel =
                rem === 0
                  ? 'Session complete 🎉'
                  : onBreak
                    ? 'On a break right now'
                    : breakMs === 0
                      ? 'Break time — take five'
                      : `${fmt(breakMs)} until your next break`
              // Ring = the whole session, draining clockwise from the top, with a
              // cocoa notch at each upcoming break.
              const elapsedDeg = Math.min(360, Math.max(0, ((now - startMs) / sessionMs) * 360))
              const notches = []
              if (rem > 0) {
                const be = (state.session.breakEveryMin || 45) * 60000
                for (
                  let bt = new Date(state.session.nextBreakAt).getTime();
                  bt < endMs && notches.length < 12;
                  bt += be
                ) {
                  if (bt > now) notches.push(((bt - startMs) / sessionMs) * 360)
                }
              }
              const progress = `conic-gradient(#eae0c8 0deg ${elapsedDeg}deg, var(--caramel) ${elapsedDeg}deg 360deg)`
              const W = 3.4
              let prevHi = 0
              const stops = ['transparent 0deg']
              notches
                .sort((a, b) => a - b)
                .forEach((c) => {
                  const lo = Math.max(prevHi, c - W)
                  const hi = Math.min(360, c + W)
                  if (hi <= lo) return
                  stops.push(
                    `transparent ${lo}deg`,
                    `var(--cocoa) ${lo}deg`,
                    `var(--cocoa) ${hi}deg`,
                    `transparent ${hi}deg`
                  )
                  prevHi = hi
                })
              stops.push('transparent 360deg')
              const ringBg = notches.length
                ? `conic-gradient(${stops.join(', ')}), ${progress}`
                : progress
              const base = state.session.base || { study: 0, active: 0 }
              const read = Math.max(0, (state.timeSpent?.study || 0) - base.study)
              const recall = Math.max(0, (state.timeSpent?.active || 0) - base.active)
              const tracked = read + recall
              const readPct = tracked ? Math.round((read / tracked) * 100) : 0
              return (
                <div className={`tl-pop ${sessionChipOpen ? 'pinned' : ''}`} ref={chipRef}>
                  <div className="chip-ring" style={{ background: ringBg }}>
                    <button
                      className="countdown-chip session-chip big"
                      onClick={() => setSessionChipOpen((o) => !o)}
                      title="Break time, session time, and End"
                    >
                      {chipTime}
                    </button>
                  </div>
                  <div className="tl-panel chip-tip">
                    <p className="chip-line">
                      <strong>☕ {breakLabel}</strong>
                    </p>
                    <p className="chip-line">
                      Do now: {rec === 'study' ? '📖 study' : '🧠 active recall'}
                    </p>
                    <p className="chip-total">
                      ⏳ <strong>{left}</strong> left in this session
                    </p>
                    <div className="chip-mix">
                      <strong>Your mix this session</strong>
                      {tracked > 0 ? (
                        <>
                          <div className="split-track">
                            <span className="split-study" style={{ width: `${readPct}%` }} />
                            <span
                              className="split-active"
                              style={{ width: `${100 - readPct}%` }}
                            />
                          </div>
                          <p className="split-nums">
                            📖 rereading <strong>{readPct}%</strong> · 🧠 active recall{' '}
                            <strong>{100 - readPct}%</strong>
                          </p>
                        </>
                      ) : (
                        <p className="muted small" style={{ margin: 0 }}>
                          Nothing tracked yet — dig in!
                        </p>
                      )}
                    </div>
                    <button className="btn ghost small-btn chip-end-btn" onClick={endSession}>
                      End session ✕
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          countdown &&
          state.screen !== 'upload' &&
          state.screen !== 'time' && (
            <div className="head-right">
              <div className={`tl-pop ${tlPinned ? 'pinned' : ''}`}>
                <button
                  className="countdown-chip"
                  onClick={() => setTlPinned((p) => !p)}
                  title="Hover or click for your full timeline"
                >
                  ⏲️ {countdown.text} until test time
                </button>
                {state.plan && (
                  <div className="tl-panel vt-panel">
                    <h3 className="lt-heading">⏳ Your runway to test day</h3>
                    {state.cramMode ? (
                      <VerticalTimeline
                        compact
                        plan={state.plan}
                        testTime={state.testTime}
                        results={state.results}
                        intensity={state.intensity || 'steady'}
                        wakeRecalls={state.wakeRecalls || []}
                      />
                    ) : (
                      <RelaxedTimeline
                        compact
                        plan={state.plan}
                        testTime={state.testTime}
                        results={state.results}
                        intensity={state.intensity || 'steady'}
                        wakeRecalls={state.wakeRecalls || []}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </header>

      {screens[state.screen] || screens.upload}

      <p className="footer-note">
        🥄 Baked on the science of retrieval practice — testing yourself beats rereading, every
        time.
      </p>
    </div>
  )
}
