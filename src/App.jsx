import { useEffect, useMemo, useState } from 'react'
import Upload from './components/Upload.jsx'
import TimeSelect from './components/TimeSelect.jsx'
import Cooking from './components/Cooking.jsx'
import PlanView from './components/PlanView.jsx'
import StudyView from './components/StudyView.jsx'
import FlashcardsView from './components/FlashcardsView.jsx'
import TestView from './components/TestView.jsx'
import ResultsView from './components/ResultsView.jsx'
import { generateMaterials } from './lib/engine.js'
import { generatePlan } from './lib/planner.js'

const STORAGE_KEY = 'cram-brulee-v1'

const emptyState = {
  screen: 'upload',
  materials: null, // { name, text }
  testTime: null, // ISO string
  plan: [],
  doneSteps: [],
  versions: [], // generated materials, newest last
  activeVersion: 0, // index into versions being viewed
  results: [], // { versionId, score, total, byTopic, weakTopics, at }
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

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

  const currentVersion = state.versions[state.activeVersion] || null
  const latestVersion = state.versions[state.versions.length - 1] || null

  const startOver = () => {
    if (state.materials && !confirm('Toss this batch and start a fresh one?')) return
    localStorage.removeItem(STORAGE_KEY)
    setState(emptyState)
  }

  const handleCooked = () => {
    const plan = generatePlan(state.testTime)
    const v1 = generateMaterials(state.materials.text, { version: 1 })
    update({ plan, versions: [v1], activeVersion: 0, screen: 'plan' })
  }

  const markDone = (stepId) =>
    setState((s) =>
      s.doneSteps.includes(stepId) ? s : { ...s, doneSteps: [...s.doneSteps, stepId] }
    )

  const handleRefry = (weakTopics) => {
    const version = latestVersion.version + 1
    const fresh = generateMaterials(state.materials.text, { weakTopics, version })
    setState((s) => ({
      ...s,
      versions: [...s.versions, fresh],
      activeVersion: s.versions.length,
      screen: 'study',
    }))
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
        onDone={(testTime) => update({ testTime, screen: 'cooking' })}
      />
    ),
    cooking: <Cooking onDone={handleCooked} />,
    plan: (
      <PlanView
        plan={state.plan}
        doneSteps={state.doneSteps}
        results={state.results}
        countdown={countdown}
        onGo={(step) => {
          const target = { study: 'study', recall: 'flashcards', test: 'test' }[step.type]
          if (target) update({ screen: target, activeStep: step.id })
          else markDone(step.id)
        }}
        onToggleDone={(step) =>
          setState((s) => ({
            ...s,
            doneSteps: s.doneSteps.includes(step.id)
              ? s.doneSteps.filter((id) => id !== step.id)
              : [...s.doneSteps, step.id],
          }))
        }
      />
    ),
    study: currentVersion && (
      <StudyView
        version={currentVersion}
        versions={state.versions}
        activeVersion={state.activeVersion}
        onPickVersion={(i) => update({ activeVersion: i })}
        onFinish={() => {
          if (state.activeStep) markDone(state.activeStep)
          update({ screen: 'flashcards', activeStep: null })
        }}
        onBack={() => update({ screen: 'plan' })}
      />
    ),
    flashcards: currentVersion && (
      <FlashcardsView
        version={currentVersion}
        versions={state.versions}
        activeVersion={state.activeVersion}
        onPickVersion={(i) => update({ activeVersion: i })}
        onFinish={() => {
          if (state.activeStep) markDone(state.activeStep)
          update({ screen: 'plan', activeStep: null })
        }}
        onBack={() => update({ screen: 'plan' })}
      />
    ),
    test: latestVersion && (
      <TestView
        version={latestVersion}
        onFinish={(result) => {
          if (state.activeStep) markDone(state.activeStep)
          setState((s) => ({
            ...s,
            results: [...s.results, result],
            screen: 'results',
            activeStep: null,
          }))
        }}
        onBack={() => update({ screen: 'plan' })}
      />
    ),
    results: state.results.length > 0 && (
      <ResultsView
        result={state.results[state.results.length - 1]}
        onRefry={handleRefry}
        onPlan={() => update({ screen: 'plan' })}
      />
    ),
  }

  return (
    <div className="app">
      <header className="masthead">
        <button className="brand" onClick={startOver} title="Start a fresh batch">
          <span className="brand-flan">🍮</span>
          <span>
            <h1>
              cram <span className="brule">brûlée</span>
            </h1>
            <p className="tagline">active recall is our special sauce</p>
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
