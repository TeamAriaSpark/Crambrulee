import { useEffect, useRef } from 'react'
import { suggestSleeps, suggestedStudyMin, INTENSITY } from '../lib/planner.js'

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const fmtMin = (min) => (min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`)

const clockFull = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })

const SLEEP_SCIENCE =
  'Sleep isn’t lost study time — during deep sleep your brain replays what you learned and files it into long-term memory. Students who sleep before an exam consistently beat the all-nighters.'

// The proportional line timeline (now → test time) with practice-test
// markers, draggable sleep blocks, and per-stretch study suggestions.
// Shown inline on the plan page and inside the countdown-chip popover.
export default function TimelinePanel({
  plan,
  testTime,
  results,
  intensity = 'steady',
  onSleepChange,
  onDragStart,
}) {
  const tests = plan?.tests || []
  const sleeps = plan?.sleeps ?? suggestSleeps(plan.startedAt, plan.finalReviewAt)
  const taken = Math.min(results.length, tests.length)

  const axisStart = new Date(plan.startedAt).getTime()
  const axisEnd = new Date(plan.testAt || testTime).getTime()
  const span = Math.max(axisEnd - axisStart, 1)
  const pos = (iso) =>
    Math.min(100, Math.max(0, ((new Date(iso).getTime() - axisStart) / span) * 100))
  const nowPct = pos(new Date().toISOString())

  const markerList = [
    ...tests.map((t, i) => ({
      key: t.id,
      at: t.suggestedAt,
      icon: i < taken ? '✓' : '🔥',
      name: `Test ${t.n}`,
      cls: `${i < taken ? 'past' : ''} ${i === taken ? 'next' : ''}`,
      tip:
        i < taken ? (
          <>
            <strong>✓ Practice test {t.n}</strong> — taken. The refry that followed doubled
            down on what you missed.
          </>
        ) : (
          <>
            <strong>🔥 Practice test {t.n}</strong> — suggested {clockFull(t.suggestedAt)}. It
            simulates the real thing, then your materials are rebuilt around what you miss.
            Score 80%+ to level up.
          </>
        ),
    })),
    {
      key: 'end',
      at: plan.testAt || testTime,
      icon: '🎓',
      name: 'Your test',
      cls: 'end',
      tip: (
        <>
          <strong>🎓 Your real test</strong> — {clockFull(plan.testAt || testTime)}. We stop
          suggesting study ~45 min before: one calm review, then walk in rested.
        </>
      ),
    },
  ]
  // Suggested study between consecutive milestones (start → tests → final
  // review), drawn on the line itself in the awake gaps around sleep.
  const segPoints = [plan.startedAt, ...tests.map((t) => t.suggestedAt), plan.finalReviewAt]
  const studyStretches = []
  for (let i = 0; i < segPoints.length - 1; i++) {
    const fromMs = new Date(segPoints[i]).getTime()
    const toMs = new Date(segPoints[i + 1]).getTime()
    if (toMs <= fromMs) continue
    // Split the stretch into awake sub-intervals by carving out sleep.
    let parts = [[fromMs, toMs]]
    for (const s of sleeps) {
      const sa = new Date(s.from).getTime()
      const sb = new Date(s.to).getTime()
      parts = parts.flatMap(([a, b]) => {
        if (sb <= a || sa >= b) return [[a, b]]
        const kept = []
        if (sa > a) kept.push([a, sa])
        if (sb < b) kept.push([sb, b])
        return kept
      })
    }
    const awakeMin = parts.reduce((m, [a, b]) => m + (b - a) / 60000, 0)
    const pct = parts
      .map(([a, b]) => ({ a: pos(new Date(a).toISOString()), b: pos(new Date(b).toISOString()) }))
      .filter((p) => p.b - p.a >= 2)
    if (!pct.length) continue
    const widest = pct.reduce((w, p) => (p.b - p.a > w.b - w.a ? p : w))
    studyStretches.push({
      key: `stretch-${i}`,
      parts: pct,
      widest,
      min: suggestedStudyMin(segPoints[i], segPoints[i + 1], sleeps, intensity),
      awakeMin: Math.round(awakeMin),
      past: i < taken,
    })
  }
  const intensityMeta = INTENSITY[intensity] || INTENSITY.steady

  let lastTopRow = -Infinity
  const markers = markerList.map((m) => {
    const p = pos(m.at)
    if (p - lastTopRow < 10) return { ...m, p, row: 'b' }
    lastTopRow = p
    return { ...m, p, row: 'a' }
  })
  const hasRowB = markers.some((m) => m.row === 'b')

  const timelineRef = useRef(null)
  const dragRef = useRef(null)
  const sleepsRef = useRef(sleeps)
  sleepsRef.current = sleeps
  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current
      if (!d || !timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const SNAP = 15 * 60000
      const t = Math.round((axisStart + pct * span) / SNAP) * SNAP
      const current = sleepsRef.current[d.i]
      if (!current) return
      const from = new Date(current.from).getTime()
      const to = new Date(current.to).getTime()
      const finalReview = new Date(plan.finalReviewAt).getTime()
      const MIN_SLEEP = 60 * 60000
      const next =
        d.edge === 'from'
          ? { from: new Date(Math.max(axisStart, Math.min(t, to - MIN_SLEEP))).toISOString(), to: current.to }
          : { from: current.from, to: new Date(Math.min(finalReview, Math.max(t, from + MIN_SLEEP))).toISOString() }
      onSleepChange(sleepsRef.current.map((s, j) => (j === d.i ? next : s)))
    }
    const up = () => {
      dragRef.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [axisStart, span, plan.finalReviewAt, onSleepChange])

  const startDrag = (i, edge) => (e) => {
    e.preventDefault()
    dragRef.current = { i, edge }
    document.body.style.cursor = 'ew-resize'
    onDragStart?.()
  }

  return (
    <>
      <h3 className="lt-heading">⏳ Your runway to test day</h3>
      <div
        ref={timelineRef}
        className={`line-timeline ${hasRowB ? 'tall' : ''}`}
        aria-label="Timeline until your test"
      >
        <div className="lt-track" />
        <div className="lt-progress" style={{ width: `${nowPct}%` }} />
        {sleeps.map((s, i) => {
          const left = pos(s.from)
          const width = Math.max(pos(s.to) - left, 3)
          const mid = Math.min(Math.max(left + width / 2, 16), 84)
          return (
            <div key={i} className="lt-sleep-wrap">
              <div className="lt-sleep" style={{ left: `${left}%`, width: `${width}%` }}>
                <span className="lt-sleep-text">
                  {width >= 16 ? `😴 sleep ${clock(s.from)}–${clock(s.to)}` : '💤'}
                </span>
                <span className="lt-handle left" onPointerDown={startDrag(i, 'from')} />
                <span className="lt-handle right" onPointerDown={startDrag(i, 'to')} />
              </div>
              <div className="lt-tooltip" style={{ left: `${mid}%` }}>
                <strong>💤 Why sleep instead of cramming?</strong> {SLEEP_SCIENCE}
                <span className="lt-tooltip-hint">↔ Drag the ends to match your real bedtime.</span>
              </div>
            </div>
          )
        })}
        {studyStretches.map((st) => (
          <div key={st.key} className="lt-study-wrap">
            {st.parts.map((p, j) => {
              const w = p.b - p.a
              const labeled = p === st.widest
              return (
                <div
                  key={j}
                  className={`lt-studyspan ${st.past ? 'past' : ''}`}
                  style={{ left: `${p.a}%`, width: `${w}%` }}
                >
                  <span className="lt-studyspan-text">
                    {labeled && w >= 11 ? `📖 ~${fmtMin(st.min)}` : labeled && w >= 4 ? '📖' : ''}
                  </span>
                </div>
              )
            })}
            <div
              className="lt-tooltip"
              style={{
                left: `${Math.min(Math.max((st.widest.a + st.widest.b) / 2, 16), 84)}%`,
              }}
            >
              <strong>📖 ~{fmtMin(st.min)} of study suggested</strong> in this stretch — about{' '}
              {Math.min(100, Math.round((st.min / Math.max(st.awakeMin, 1)) * 100))}% of the ~
              {fmtMin(st.awakeMin)} you’re awake ({intensityMeta.emoji} {intensityMeta.label}{' '}
              intensity).
              <span className="lt-tooltip-hint">
                Aim for ~30% reading, 70% active recall — and take the practice test at the end.
              </span>
            </div>
          </div>
        ))}
        {markers.map((m) => (
          <div
            key={m.key}
            className={`lt-marker ${m.cls} ${m.row === 'b' ? 'rowb' : ''}`}
            style={{ left: `${m.p}%` }}
          >
            <span className="lt-icon">{m.icon}</span>
            <span className="lt-tag">
              <span className="lt-name">{m.name}</span>
              <span className="lt-label">{clock(m.at)}</span>
            </span>
            <span className={`lt-mtip ${m.p > 78 ? 'edge-r' : m.p < 8 ? 'edge-l' : ''}`}>
              {m.tip}
            </span>
          </div>
        ))}
        <span className="lt-start" title="When you started this cram plan">
          started {clock(plan.startedAt)}
        </span>
        <div className="lt-now" style={{ left: `${Math.min(Math.max(nowPct, 4), 92)}%` }}>
          <span className="lt-now-dot" />
          <span className="lt-now-label">now</span>
          <span className="lt-now-time">{clock(new Date().toISOString())}</span>
        </div>
      </div>
      <p className="lt-legend muted small">
        🔥 practice test · 📖 suggested study, drawn on the line{sleeps.length > 0 && <> · 💤 suggested sleep (drag the ends to adjust)</>} · 🎓 your real test — hover anything for details
      </p>
    </>
  )
}
