import { useEffect, useRef } from 'react'
import { suggestSleeps } from '../lib/planner.js'

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const clockFull = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })

const SLEEP_SCIENCE =
  'Sleep isn’t lost study time — during deep sleep your brain replays what you learned and files it into long-term memory. Students who sleep before an exam consistently beat the all-nighters.'

// The proportional line timeline (now → test time) with practice-test
// markers and draggable sleep blocks. Lives in the countdown-chip popover.
export default function TimelinePanel({ plan, testTime, results, onSleepChange, onDragStart }) {
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
      title: `Practice test ${t.n} — suggested ${clockFull(t.suggestedAt)}`,
    })),
    {
      key: 'end',
      at: plan.testAt || testTime,
      icon: '🎓',
      name: 'Your test',
      cls: 'end',
      title: `Test time · ${clockFull(plan.testAt || testTime)}`,
    },
  ]
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
        {markers.map((m) => (
          <div
            key={m.key}
            className={`lt-marker ${m.cls} ${m.row === 'b' ? 'rowb' : ''}`}
            style={{ left: `${m.p}%` }}
            title={m.title}
          >
            <span className="lt-icon">{m.icon}</span>
            <span className="lt-tag">
              <span className="lt-name">{m.name}</span>
              <span className="lt-label">{clock(m.at)}</span>
            </span>
          </div>
        ))}
        <div className="lt-now" style={{ left: `${Math.min(Math.max(nowPct, 4), 92)}%` }}>
          <span className="lt-now-dot" />
          <span className="lt-now-label">now</span>
        </div>
      </div>
      <p className="lt-legend muted small">
        🔥 practice test{sleeps.length > 0 && <> · 💤 suggested sleep (hover for the science, drag to adjust)</>} · 🎓 your real test
      </p>
    </>
  )
}
