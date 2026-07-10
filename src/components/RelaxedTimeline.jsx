import { suggestSleeps, suggestStudyBlocks } from '../lib/planner.js'
import { SLEEP_RECS } from '../lib/wake.js'

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const fmtMin = (min) => (min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`)

const dayTitle = (date) => {
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86400000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString([], { weekday: 'long' })
}

// The relaxed plan: per day, just a suggested amount of study — whenever
// suits them — plus the fixed anchors (sleep, wake-up recall, practice
// tests, the real test). Cram Mode! swaps this for the fully scheduled
// calendar.
export default function RelaxedTimeline({
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

  // Anchors keep their times; study is aggregated per day.
  const anchors = [
    ...sleeps.map((s) => ({ type: 'sleep', at: s.from, s })),
    ...wakes,
    ...tests.map((t, i) => ({ type: 'test', at: t.suggestedAt, t, done: i < taken, next: i === taken })),
    { type: 'final', at: plan.finalReviewAt },
    { type: 'end', at: plan.testAt || testTime },
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  // Group by day, with per-day study totals (remaining for today).
  const days = []
  const dayFor = (iso) => {
    const key = new Date(iso).toDateString()
    let day = days.find((d) => d.key === key)
    if (!day) {
      day = { key, date: new Date(iso), anchors: [], studyMin: 0, studyLeftMin: 0 }
      days.push(day)
    }
    return day
  }
  for (const a of anchors) dayFor(a.at).anchors.push(a)
  for (const b of blocks) {
    const day = dayFor(b.from)
    day.studyMin += b.min
    const remMs = Math.max(0, Math.min(new Date(b.to).getTime(), endMs) - Math.max(new Date(b.from).getTime(), now))
    day.studyLeftMin += Math.round(remMs / 60000)
  }
  days.sort((a, b) => a.date - b.date)

  // The session card lives on the first day with study time still ahead.
  const todayKey = new Date().toDateString()
  const cardDay = days.find((d) => d.studyLeftMin >= 15)?.key || null

  const renderAnchor = (a, i) => {
    const endAt = a.s?.to || a.at
    const past = !a.active && new Date(endAt).getTime() < now
    const key = `${a.type}-${i}`
    const time = <span className="rt-time">{clock(a.at)}</span>

    if (a.type === 'sleep') {
      return (
        <div key={key} className={`rt-row vt-hover ${past ? 'past' : ''}`}>
          {time}
          <span className="rt-label">
            💤 Sleep <span className="muted small">· until {clock(a.s.to)}</span>
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

    if (a.type === 'wake') {
      if (a.logged) {
        return (
          <div key={key} className={`rt-row ${past ? 'past' : ''}`}>
            {time}
            <span className="rt-label">
              ✓ Wake-up recall <span className="muted small">· {a.logged.score}% came back</span>
            </span>
          </div>
        )
      }
      if (a.active && !compact && onWake) {
        return (
          <div key={key} className="rt-row">
            {time}
            <span className="rt-label rt-wake-cta">
              🌅 Wake-up recall · ~10 min
              <button className="btn small-btn" onClick={onWake}>
                Do it now 🌅
              </button>
            </span>
          </div>
        )
      }
      return (
        <div key={key} className={`rt-row vt-hover ${past ? 'past' : ''}`}>
          {time}
          {onWake ? (
            <button className="rt-label vt-linkrow" onClick={onWake}>
              🌅 Wake-up recall <span className="vt-try">· try it →</span>
            </button>
          ) : (
            <span className="rt-label">🌅 Wake-up recall</span>
          )}
          <span className="vt-tip">
            <strong>🌅 First thing after waking</strong> — before any notes — write down
            everything you can retrieve. Sleep just consolidated it; pulling it out now locks
            it in. We grade your pour against your materials.
          </span>
        </div>
      )
    }

    if (a.type === 'test') {
      if (!compact && testCard && a.next) {
        return (
          <div key={key} className="rt-card">
            {testCard}
          </div>
        )
      }
      return (
        <div key={key} className={`rt-row vt-hover ${past ? 'past' : ''}`}>
          {time}
          <span className="rt-label">
            <strong>
              {a.done ? '✓' : '🔥'} Practice test {a.t.n}
            </strong>
            {a.done && <span className="muted small"> · taken</span>}
          </span>
          <span className="vt-tip">
            {a.done ? (
              <>
                <strong>✓ Practice test {a.t.n}</strong> — taken. The refry that followed
                doubled down on what you missed.
              </>
            ) : (
              <>
                <strong>🔥 Practice test {a.t.n}</strong> — simulates the real thing, then your
                materials are rebuilt around what you miss. Score 80%+ to level up.
              </>
            )}
          </span>
        </div>
      )
    }

    if (a.type === 'final') {
      if (!compact && testCard && taken >= tests.length) {
        return (
          <div key={key} className="rt-card">
            {testCard}
          </div>
        )
      }
      return (
        <div key={key} className={`rt-row ${past ? 'past' : ''}`}>
          {time}
          <span className="rt-label muted small">🍮 final review — one calm pass, then rest</span>
        </div>
      )
    }

    if (a.type === 'end') {
      return (
        <div key={key} className="rt-row rt-end">
          {time}
          <span className="rt-label">
            <strong>🎓 Your test</strong>
          </span>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`rt ${compact ? 'compact' : ''}`}>
      {days.map((day) => {
        const isToday = day.key === todayKey
        const showCard = !compact && sessionCard && day.key === cardDay
        const studyShown = isToday ? day.studyLeftMin : day.studyMin
        return (
          <div key={day.key} className="rt-day">
            <div className="rt-dayhead">
              <strong className={isToday ? 'today' : ''}>{dayTitle(day.date)}</strong>
              <span className="rt-date">
                {day.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
              {studyShown >= 15 && (
                <span className="rt-quota vt-hover">
                  📖 ~{fmtMin(Math.round(studyShown / 15) * 15)} of study
                  {isToday ? ' left — whenever suits you' : ' — whenever suits you'}
                  <span className="vt-tip">
                    <strong>📖 Your daily portion, not a schedule.</strong> Split it into a few
                    sessions with real breaks between — spaced beats massed. Want exact times?
                    Hit 🔥 Cram Mode.
                  </span>
                </span>
              )}
            </div>
            {showCard && (
              <div className="rt-card">
                {isToday && <span className="vt-now-label">you are here</span>}
                {sessionCard}
              </div>
            )}
            {day.anchors.map(renderAnchor)}
          </div>
        )
      })}
      {!compact && sessionCard && !cardDay && <div className="rt-card">{sessionCard}</div>}
    </div>
  )
}
