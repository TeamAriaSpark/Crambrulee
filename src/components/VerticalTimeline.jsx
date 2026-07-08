import { suggestSleeps, suggestStudyBlocks, TIPS } from '../lib/planner.js'
import { SLEEP_RECS } from '../lib/wake.js'

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const fmtMin = (min) => (min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`)

const SPACING_SCIENCE =
  'The gaps are on purpose: memory consolidates between sessions, and spaced blocks beat one long marathon — that’s the spacing effect.'

const ORDER = { start: 0, now: 1, sleep: 2, wake: 3, study: 4, test: 5, final: 6, end: 7 }

const dayTitle = (date) => {
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86400000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString([], { weekday: 'long' })
}

// The plan as a calendar: one column per day, with study blocks, sleep,
// wake-up recall, practice tests, and the real test as event chips. The
// next study block and next practice test expand into their action cards.
export default function VerticalTimeline({
  plan,
  testTime,
  results,
  intensity = 'steady',
  compact = false,
  sessionCard = null,
  testCard = null,
  wakeRecalls = [],
  onWake = null,
}) {
  const now = Date.now()
  const tests = plan?.tests || []
  const taken = Math.min(results?.length || 0, tests.length)
  const sleeps = plan?.sleeps ?? suggestSleeps(plan.startedAt, plan.finalReviewAt)
  const blocks = suggestStudyBlocks({ ...plan, sleeps }, intensity)

  const upcoming = blocks.filter((b) => new Date(b.to).getTime() > now)
  const nextBlockFrom = upcoming[0]?.from || null

  // A wake-up recall block follows every night of sleep that still has
  // runway after it. "Done" = a recall was logged between falling asleep
  // and ~6h after waking; the most recent undone one gets the CTA.
  const endMs = new Date(plan.testAt || testTime).getTime()
  const wakes = sleeps
    .filter((s) => new Date(s.to).getTime() < endMs - 30 * 60000)
    .map((s) => {
      const wakeMs = new Date(s.to).getTime()
      const logged = (wakeRecalls || []).find((w) => {
        const t = new Date(w.at).getTime()
        return t >= new Date(s.from).getTime() && t <= wakeMs + 6 * 3600000
      })
      return {
        type: 'wake',
        at: s.to,
        logged,
        active: !logged && now >= wakeMs && now <= wakeMs + 6 * 3600000,
      }
    })

  const entries = [
    { type: 'now', at: new Date(now).toISOString() },
    ...blocks.map((b) => ({ type: 'study', at: b.from, b })),
    ...sleeps.map((s) => ({ type: 'sleep', at: s.from, s })),
    ...wakes,
    ...tests.map((t, i) => ({ type: 'test', at: t.suggestedAt, t, done: i < taken, next: i === taken })),
    { type: 'final', at: plan.finalReviewAt },
    { type: 'end', at: plan.testAt || testTime },
  ].sort((a, b) => new Date(a.at) - new Date(b.at) || ORDER[a.type] - ORDER[b.type])

  // "You are here" and the next study block are one moment from the
  // student's point of view — merge them into a single event.
  if (!compact && sessionCard) {
    const nowIdx = entries.findIndex((e) => e.type === 'now')
    const after = entries[nowIdx + 1]
    if (after?.type === 'study' && after.b.from === nextBlockFrom) {
      entries.splice(nowIdx, 1)
      after.here = true
    }
  }

  // Fill real gaps between study blocks / tests with a break-activity or
  // brain-nutrient tip. Deterministic rotation keeps tips stable.
  if (!compact) {
    let tipIdx = 0
    for (let i = 0; i < entries.length - 1; i++) {
      const cur = entries[i]
      const nxt = entries[i + 1]
      const workTypes = ['study', 'test']
      if (!workTypes.includes(cur.type) || !workTypes.includes(nxt.type)) continue
      const curEnd = new Date(cur.b?.to || cur.at).getTime()
      const gapMin = Math.round((new Date(nxt.at).getTime() - curEnd) / 60000)
      if (gapMin < 25) continue
      entries.splice(i + 1, 0, {
        type: 'tip',
        at: new Date(curEnd).toISOString(),
        tip: TIPS[tipIdx++ % TIPS.length],
        gapMin,
      })
      i++
    }
  }

  // Group chronological entries into day columns.
  const days = []
  for (const e of entries) {
    const key = new Date(e.at).toDateString()
    let day = days[days.length - 1]
    if (!day || day.key !== key) {
      day = { key, date: new Date(e.at), entries: [] }
      days.push(day)
    }
    day.entries.push(e)
  }

  const renderEntry = (e, i) => {
    const endAt = e.b?.to || e.s?.to || e.at
    const past = e.type !== 'now' && !e.active && new Date(endAt).getTime() < now
    const key = `${e.type}-${i}`

    if (e.type === 'tip') {
      return (
        <div key={key} className={`cal-tip vt-hover ${past ? 'past' : ''}`}>
          <span className="muted small">
            {e.tip.emoji} {e.tip.tip.replace(/^(Break|Snack) idea: /, '')}
            <span className="vt-gap-len"> · ~{fmtMin(e.gapMin)}</span>
          </span>
          <span className="vt-tip">
            {e.tip.emoji} <strong>{e.tip.tip}.</strong> {e.tip.why}
          </span>
        </div>
      )
    }

    if (e.type === 'now') {
      // The calendar's "current time" line.
      return (
        <div key={key} className="cal-now">
          <span className="cal-now-label">now · {clock(e.at)}</span>
        </div>
      )
    }

    const showSessionCard =
      !compact && sessionCard && e.type === 'study' && e.b.from === nextBlockFrom
    const showTestCard = !compact && testCard && e.type === 'test' && e.next

    if (showSessionCard) {
      return (
        <div key={key} className="cal-card">
          {e.here && <span className="vt-now-label">you are here</span>}
          {sessionCard}
        </div>
      )
    }
    if (showTestCard) {
      return (
        <div key={key} className="cal-card">
          {testCard}
        </div>
      )
    }

    const time = <span className="cal-time">{clock(e.at)}</span>

    if (e.type === 'study') {
      return (
        <div key={key} className={`cal-ev study vt-hover ${past ? 'past' : ''}`}>
          {time}
          <span className="cal-label">📖 Study · ~{fmtMin(e.b.min)}</span>
          <span className="vt-tip">
            <strong>📖 ~{fmtMin(e.b.min)} of study</strong> ({clock(e.b.from)}–{clock(e.b.to)}),
            then step away. {SPACING_SCIENCE}
          </span>
        </div>
      )
    }

    if (e.type === 'sleep') {
      return (
        <div key={key} className={`cal-ev sleep vt-hover ${past ? 'past' : ''}`}>
          {time}
          <span className="cal-label">
            💤 Sleep <span className="cal-sub">until {clock(e.s.to)}</span>
          </span>
          <span className="vt-tip">
            <strong>💤 Deep sleep files today’s studying into long-term memory.</strong>
            <span className="vt-tip-list">
              {SLEEP_RECS.map((r) => (
                <span key={r}>• {r}</span>
              ))}
            </span>
          </span>
        </div>
      )
    }

    if (e.type === 'wake') {
      if (e.logged) {
        return (
          <div key={key} className={`cal-ev wake done ${past ? 'past' : ''}`}>
            {time}
            <span className="cal-label">
              ✓ Wake-up recall <span className="cal-sub">{e.logged.score}% came back</span>
            </span>
          </div>
        )
      }
      if (e.active && !compact && onWake) {
        return (
          <div key={key} className="cal-ev wake active">
            {time}
            <span className="cal-label">🌅 Wake-up recall · ~10 min</span>
            <button className="btn small-btn cal-btn" onClick={onWake}>
              Do it now 🌅
            </button>
          </div>
        )
      }
      return (
        <div key={key} className={`cal-ev wake vt-hover ${past ? 'past' : ''}`}>
          {time}
          {onWake && !compact ? (
            <button className="cal-label vt-linkrow" onClick={onWake}>
              🌅 Wake-up recall <span className="vt-try">· try it →</span>
            </button>
          ) : (
            <span className="cal-label">🌅 Wake-up recall</span>
          )}
          <span className="vt-tip">
            <strong>🌅 First thing after waking</strong> — before any notes — write down every
            formula, concept, definition, and process you can retrieve. Sleep just consolidated
            it; pulling it out now locks it in. We grade your pour against your materials.
          </span>
        </div>
      )
    }

    if (e.type === 'test') {
      return (
        <div key={key} className={`cal-ev test vt-hover ${e.done ? 'done' : ''} ${past ? 'past' : ''}`}>
          {time}
          <span className="cal-label">
            {e.done ? '✓' : '🔥'} Practice test {e.t.n}
            {e.done && <span className="cal-sub">taken</span>}
          </span>
          <span className="vt-tip">
            {e.done ? (
              <>
                <strong>✓ Practice test {e.t.n}</strong> — taken. The refry that followed
                doubled down on what you missed.
              </>
            ) : (
              <>
                <strong>🔥 Practice test {e.t.n}</strong> — simulates the real thing, then your
                materials are rebuilt around what you miss. Score 80%+ to level up.
              </>
            )}
          </span>
        </div>
      )
    }

    if (e.type === 'final') {
      if (!compact && testCard && taken >= tests.length) {
        return (
          <div key={key} className="cal-card">
            {testCard}
          </div>
        )
      }
      return (
        <div key={key} className={`cal-ev final ${past ? 'past' : ''}`}>
          {time}
          <span className="cal-label">🍮 Final review <span className="cal-sub">one calm pass</span></span>
        </div>
      )
    }

    if (e.type === 'end') {
      return (
        <div key={key} className="cal-ev end">
          {time}
          <span className="cal-label">🎓 Your test</span>
        </div>
      )
    }

    return null
  }

  return (
    <div className={`cal cols-${Math.min(days.length, 4)} ${compact ? 'compact' : ''}`}>
      {days.map((day) => (
        <div
          key={day.key}
          className={`cal-day ${day.key === new Date().toDateString() ? 'today' : ''}`}
        >
          <div className="cal-head">
            <span className="cal-head-day">{dayTitle(day.date)}</span>
            <span className="cal-head-date">
              {day.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {day.entries.map(renderEntry)}
        </div>
      ))}
      {!compact && sessionCard && !nextBlockFrom && (
        <div className="cal-card cal-orphan">{sessionCard}</div>
      )}
    </div>
  )
}
