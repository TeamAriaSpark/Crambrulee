import { useEffect, useState } from 'react'
import VersionPicker from './VersionPicker.jsx'

function SessionTimer({ minutes = 25 }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [running, secondsLeft])

  const mm = Math.floor(secondsLeft / 60)
  const ss = String(secondsLeft % 60).padStart(2, '0')
  return (
    <button
      className="session-timer"
      style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}
      onClick={() => setRunning((r) => !r)}
      title={running ? 'Pause timer' : 'Start timer'}
    >
      {secondsLeft === 0 ? '⏰ Time’s up!' : `${running ? '⏳' : '▶️'} ${mm}:${ss}`}
    </button>
  )
}

export default function StudyView({
  version,
  versions,
  activeVersion,
  onPickVersion,
  onFinish,
  onBack,
}) {
  const [tab, setTab] = useState('summary')
  const blocks = tab === 'summary' ? version.summary : version.cheatSheet

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🍳 Study session</h2>
          <p className="muted">
            {version.focusTopics.length > 0 ? (
              <>
                Refried to double down on:{' '}
                <strong>{version.focusTopics.join(', ')}</strong> 🔥
              </>
            ) : (
              'The most important stuff from your notes, reduced to a rich glaze.'
            )}
          </p>
        </div>
        <SessionTimer minutes={25} />
      </div>

      <VersionPicker versions={versions} activeVersion={activeVersion} onPick={onPickVersion} />

      <div className="tabs">
        <button
          className={`tab ${tab === 'summary' ? 'active' : ''}`}
          onClick={() => setTab('summary')}
        >
          📖 AI summary
        </button>
        <button
          className={`tab ${tab === 'cheat' ? 'active' : ''}`}
          onClick={() => setTab('cheat')}
        >
          📋 Cheat sheet
        </button>
      </div>

      {blocks.map((block) => (
        <div key={block.topic} className={`topic-block ${block.weak ? 'weak' : ''}`}>
          <h3>
            {block.weak && <span className="pill hot">needs heat 🔥</span>}{' '}
            {block.topic}
          </h3>
          <ul>
            {(block.points || block.facts).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ))}

      <div className="step-row">
        <button className="btn ghost" onClick={onBack}>
          ← Back to plan
        </button>
        <button className="btn" onClick={onFinish}>
          Time’s up → active recall 🧠
        </button>
      </div>
    </div>
  )
}
