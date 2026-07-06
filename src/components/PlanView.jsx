import { Fragment, useState } from 'react'
import { TYPE_META } from '../lib/planner.js'
import { LEVEL_META } from '../lib/engine.js'

const fmtTime = (iso) =>
  new Date(iso).toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

const fmtDuration = (min) =>
  min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`

const fmtSpent = (sec) => {
  if (sec < 60) return '<1 min'
  const min = Math.round(sec / 60)
  return min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`
}

const ReadChip = () => <span className="cat-chip read">📖 reading</span>
const RecallChip = () => <span className="cat-chip recall">🧠 active recall</span>

// Group the plan into study blocks: everything up to and including a
// practice test is one block. The final review is the finish line.
function buildBlocks(plan) {
  const blocks = []
  let current = { items: [], test: null }
  let finalItem = null
  for (const item of plan) {
    if (item.type === 'final') {
      finalItem = item
      continue
    }
    current.items.push(item)
    if (item.type === 'test') {
      current.test = item
      blocks.push(current)
      current = { items: [], test: null }
    }
  }
  if (current.items.length) blocks.push(current)
  return { blocks, finalItem }
}

export default function PlanView({
  plan,
  doneSteps,
  results,
  timeSpent,
  countdown,
  level,
  onLevelChange,
  onGo,
  onToggleDone,
}) {
  const now = Date.now()
  const currentIdx = plan.findIndex(
    (item) =>
      !doneSteps.includes(item.id) &&
      new Date(item.start).getTime() + item.durationMin * 60000 > now
  )
  const totalTests = plan.filter((i) => i.type === 'test').length
  const takenTests = results.length

  const { blocks, finalItem } = buildBlocks(plan)
  const currentItemId = currentIdx >= 0 ? plan[currentIdx].id : null
  const currentBlockIdx = Math.max(
    blocks.findIndex((b) => b.items.some((i) => i.id === currentItemId)),
    0
  )
  const [selected, setSelected] = useState(null)
  const blockIdx = selected === null ? currentBlockIdx : selected
  const block = blocks[blockIdx]

  // Live mix: real seconds spent on the study screen vs flashcards + tests.
  const studySec = timeSpent?.study || 0
  const activeSec = timeSpent?.active || 0
  const totalSec = studySec + activeSec
  const readPct = totalSec > 0 ? Math.round((studySec / totalSec) * 100) : 0
  const enoughData = totalSec >= 120
  const verdict = !enoughData
    ? null
    : readPct > 40
      ? 'You’re rereading more than the target — switch to flashcards or a practice test. 🔥'
      : readPct >= 22
        ? 'Right on target — keep this balance. 👌'
        : 'Nicely recall-heavy — exactly what the research favors. 💪'

  const renderItem = (item, isCurrent) => {
    const meta = TYPE_META[item.type]
    const done = doneSteps.includes(item.id)
    const baseClass = `tl-item ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`

    if (item.type === 'cycle') {
      return (
        <div key={item.id} className={`${baseClass} cycle-card`} style={{ '--dot': meta.color }}>
          <div className="cycle-head">
            <div>
              <div className="tl-time">
                {fmtTime(item.start)}
                {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
              </div>
              <div className="tl-title">Round {item.n}</div>
            </div>
            <div className="cycle-total">{fmtDuration(item.durationMin)}</div>
          </div>
          <div className="cycle-parts">
            {item.parts.map((part, i) =>
              part.kind === 'study' ? (
                <div className="part-row read" key={i}>
                  <span className="part-label">Study the summary &amp; cheat sheet</span>
                  <ReadChip />
                  <span className="part-time">{part.durationMin} min</span>
                  <button
                    className="btn ghost small-btn"
                    onClick={() => onGo({ id: item.id, type: 'study' })}
                  >
                    Start →
                  </button>
                </div>
              ) : (
                <div className="part-row recall" key={i}>
                  <span className="part-label">Flashcards — answer from memory, notes closed</span>
                  <RecallChip />
                  <span className="part-time">{part.durationMin} min</span>
                  <button
                    className="btn ghost small-btn"
                    onClick={() => onGo({ id: item.id, type: 'recall' })}
                  >
                    Flip →
                  </button>
                </div>
              )
            )}
          </div>
          {!done && (
            <div className="tl-actions">
              <button className="btn ghost small-btn" onClick={() => onToggleDone(item)}>
                Mark round done ✓
              </button>
            </div>
          )}
        </div>
      )
    }

    if (item.type === 'test') {
      return (
        <div key={item.id} className={`${baseClass} milestone`} style={{ '--dot': meta.color }}>
          <div className="milestone-eyebrow">🔥 This block ends with</div>
          <div className="tl-time">
            {fmtTime(item.start)} · {item.durationMin} min
            {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
          </div>
          <div className="tl-title">
            Practice test {item.n} of {totalTests} <RecallChip />
          </div>
          <div className="tl-detail">{item.detail}</div>
          <div className="tl-actions">
            <button className="btn small-btn" onClick={() => onGo({ id: item.id, type: 'test' })}>
              {done ? 'Retake it 🔥' : 'Take the test 🔥'}
            </button>
            {!done && (
              <button className="btn ghost small-btn" onClick={() => onToggleDone(item)}>
                Mark done ✓
              </button>
            )}
          </div>
        </div>
      )
    }

    if (item.type === 'break') {
      return (
        <div key={item.id} className={`${baseClass} break-row`} style={{ '--dot': meta.color }}>
          <div className="tl-time">
            {fmtTime(item.start)} · {item.durationMin} min
            {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
          </div>
          <div className="snack-bar">
            <span className="snack-emoji">{item.emoji}</span>
            <div>
              <strong>Break: {item.tip}</strong>
              <p>{item.why}</p>
            </div>
          </div>
        </div>
      )
    }

    // sleep
    return (
      <div key={item.id} className={baseClass} style={{ '--dot': meta.color }}>
        <div className="tl-time">
          {fmtTime(item.start)} · {fmtDuration(item.durationMin)}
          {isCurrent && <span className="pill" style={{ marginLeft: 8 }}>you are here</span>}
        </div>
        <div className="tl-title">{item.title}</div>
        <div className="tl-detail">{item.detail}</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="session-head">
        <div>
          <h2>🗺️ Your cram plan</h2>
          <p className="muted">
            Work through one <strong>study block</strong> at a time — rounds of{' '}
            <strong>📖 study → 🧠 flashcards</strong> with breaks, each block ending in a{' '}
            <strong>🔥 practice test</strong> that rebuilds your materials around what you missed.
          </p>
        </div>
        <div className="head-controls">
          {countdown && <span className="pill hot">⏲️ {countdown.text} left</span>}
          <label className="level-select" title="Sets how hard your summaries, flashcards, and practice tests are. Score 80%+ on a practice test to level up automatically.">
            <span className="muted small">Level</span>
            <select value={level} onChange={(e) => onLevelChange(e.target.value)}>
              <option value="novice">🌱 Novice</option>
              <option value="competent">🍳 Competent</option>
              <option value="expert">👨‍🍳 Expert</option>
            </select>
          </label>
        </div>
      </div>

      <div className="hz-timeline" role="tablist" aria-label="Study blocks">
        {blocks.map((b, i) => {
          const blockMin = b.items.reduce((sum, it) => sum + it.durationMin, 0)
          const past = i < currentBlockIdx
          return (
            <Fragment key={i}>
              <button
                className={`hz-block ${i === blockIdx ? 'selected' : ''} ${past ? 'past' : ''} ${i === currentBlockIdx ? 'live' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="hz-block-name">Block {i + 1}</span>
                <span className="hz-block-time">{fmtDuration(blockMin)}</span>
              </button>
              {b.test && (
                <button
                  className={`hz-node ${past || doneSteps.includes(b.test.id) ? 'past' : ''} ${i === blockIdx ? 'selected' : ''}`}
                  title={`Practice test ${b.test.n}`}
                  onClick={() => setSelected(i)}
                >
                  🔥
                </button>
              )}
            </Fragment>
          )
        })}
        <div className="hz-node finish" title={finalItem ? `Final review · ${fmtTime(finalItem.start)}` : 'Test time'}>
          🏁
        </div>
      </div>

      <div
        className="mix-stats"
        title="Tracks the time you actually spend on each screen. Target: ~30% reading, ~70% recall + tests."
      >
        {totalSec === 0 ? (
          <p className="muted small mix-caption">
            ⏱️ Your time tallies here as you go — target mix:{' '}
            <strong>30% reading · 70% recall + tests</strong>.
          </p>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-label">📖 Reading</span>
                <span className="stat-value">{fmtSpent(studySec)}</span>
                <span className="stat-pct">{readPct}%</span>
              </div>
              <div className="stat">
                <span className="stat-label">🧠🔥 Recall + tests</span>
                <span className="stat-value">{fmtSpent(activeSec)}</span>
                <span className="stat-pct">{100 - readPct}%</span>
              </div>
              <div className="stat stat-target">
                <span className="stat-label">🎯 Target</span>
                <span className="stat-value">30% · 70%</span>
              </div>
            </div>
            {verdict && <p className="muted small mix-caption">{verdict}</p>}
          </>
        )}
      </div>

      {block && (
        <div className="block-detail">
          <div className="block-detail-head">
            <h3>
              Study block {blockIdx + 1} of {blocks.length}
              {blockIdx === currentBlockIdx && <span className="pill" style={{ marginLeft: 8 }}>current</span>}
            </h3>
            <span className="muted small">
              {block.test
                ? `ends with practice test ${block.test.n}`
                : 'the final stretch before test time'}
            </span>
          </div>
          <div className="timeline">
            {block.items.map((item) => renderItem(item, item.id === currentItemId))}
            {!block.test && finalItem && renderItem(finalItem, finalItem.id === currentItemId)}
          </div>
        </div>
      )}

      <p className="muted small" style={{ marginTop: 18 }}>
        {LEVEL_META[level]?.emoji} Level: <strong>{level}</strong> — score 80%+ on a practice
        test to level up. 🔥 {takenTests} of {totalTests} tests taken; after each one your
        materials are rebuilt to target your weak spots.
      </p>
    </div>
  )
}
