import { useCallback, useEffect, useState } from 'react'
import Upload from './components/Upload.jsx'
import TimeSelect from './components/TimeSelect.jsx'
import Cooking, { COOK_STEPS, REFRY_STEPS } from './components/Cooking.jsx'
import PlanView from './components/PlanView.jsx'
import StudyView from './components/StudyView.jsx'
import FlashcardsView from './components/FlashcardsView.jsx'
import TestView from './components/TestView.jsx'
import ResultsView from './components/ResultsView.jsx'
import { generateMaterials, LEVELS } from './lib/engine.js'
import { generateMaterialsAI, hasApiKey } from './lib/ai.js'
import { generatePlan } from './lib/planner.js'

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
  timeSpent: { study: 0, active: 0 }, // seconds actually spent on each kind of screen
  level: 'novice', // novice | competent | expert — advances on strong practice-test scores
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Track real time on task: study screen counts as reading, flashcards and
  // practice tests count as active recall. Only ticks while the tab is visible.
  useEffect(() => {
    const bucket = { study: 'study', flashcards: 'active', test: 'active' }[state.screen]
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
  }, [state.screen])

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
      setState((s) => ({
        ...s,
        versions: [...s.versions, fresh],
        activeVersion: s.versions.length,
        cookingJob: null,
        screen: 'study',
      }))
    } else {
      update({
        plan: generatePlan(state.testTime),
        versions: [fresh],
        activeVersion: 0,
        cookingJob: null,
        screen: 'plan',
      })
    }
  }

  const handleRefry = (weakTopics) =>
    update({ cookingJob: { kind: 'refry', weakTopics }, screen: 'cooking' })

  const screens = {
    upload: (
      <Upload
        onDone={(materials) => update({ materials, screen: 'time' })}
      />
    ),
    time: (
      <TimeSelect
        onBack={() => update({ screen: 'upload' })}
        onDone={(testTime) =>
          update({ testTime, cookingJob: { kind: 'initial' }, screen: 'cooking' })
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
        results={state.results}
        timeSpent={state.timeSpent}
        countdown={countdown}
        level={state.level || 'novice'}
        onLevelChange={handleLevelChange}
        onStudy={() => update({ screen: 'study' })}
        onRecall={() => update({ screen: 'flashcards' })}
        onTest={() => update({ screen: 'test' })}
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
            return {
              ...s,
              level: leveledUp || currentLevel,
              results: [...s.results, { ...result, levelUp: leveledUp }],
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
        {countdown && state.screen !== 'upload' && state.screen !== 'time' && (
          <div className="countdown-chip" title="Time until your test">
            ⏲️ {countdown.text} until test time
          </div>
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
