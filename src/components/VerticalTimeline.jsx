import { suggestSleeps, suggestStudyBlocks, TIPS } from '../lib/planner.js'

const clock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const dayClock = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? clock(iso)
    : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

const fmtMin = (min) => (min >= 90 ? `${Math.round(min / 6) / 10} h` : `${min} min`)

const SLEEP_SCIENCE =
  'Sleep isn’t lost study time — during deep sleep your brain replays what you learned and files it into long-term memory.'

const SPACING_SCIENCE =
  'The gaps are on purpose: memory consolidates between sessions, and spaced blocks beat one long marathon — that’s the spacing effect.'

const ORDER = { start: 0, now: 1, sleep: 2, study: 3, test: 4, final: 5, end: 6 }

// The plan as a simple vertical timeline: spaced study blocks, sleep,
// practice tests, and the real test, in one chronological list. The next
// study block and next practice test expand into their action cards.
export default function VerticalTimeline({
  plan,
  testTime,
  results,
  intensity = 'steady',
  compact = false,
  sessionCard = null,
  testCard = null,
}) {
  const now = Date.now()
  const tests = plan?.tests || []
  const taken = Math.min(results?.length || 0, tests.length)
  const sleeps = plan?.sleeps ?? suggestSleeps(plan.startedAt, plan.finalReviewAt)
  const blocks = suggestStudyBlocks({ ...plan, sleeps }, intensity)

  const upcoming = blocks.filter((b) => new Date(b.to).getTime() > now)
  const nextBlockFrom = upcoming[0]?.from || null

  const entries = [
    { type: 'now', at: new Date(now).toISOString() },
    ...blocks.map((b) => ({ type: 'study', at: b.from, b })),
    ...sleeps.map((s) => ({ type: 'sleep', at: s.from, s })),
    ...tests.map((t, i) => ({ type: 'test', at: t.suggestedAt, t, done: i < taken, next: i === taken })),
    { type: 'final', at: plan.finalReviewAt },
    { type: 'end', at: plan.testAt || testTime },
  ].sort((a, b) => new Date(a.at) - new Date(b.at) || ORDER[a.type] - ORDER[b.type])

  // "You are here" and the next study block are one moment from the
  // student's point of view — merge them into a single row.
  if (!compact && sessionCard) {
    const nowIdx = entries.findIndex((e) => e.type === 'now')
    const after = entries[nowIdx + 1]
    if (after?.type === 'study' && after.b.from === nextBlockFrom) {
      entries.splice(nowIdx, 1)
      after.here = true
    }
  }

  // Fill real gaps between study blocks / tests with a break-activity or
  // brain-nutrient tip — the rest is part of the plan, so suggest how to
  // spend it. Deterministic rotation keeps tips stable across renders.
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

  const rows = entries.map((e, i) => {
    const endAt = e.b?.to || e.s?.to || e.at
    const past = e.type !== 'now' && new Date(endAt).getTime() < now
    const key = `${e.type}-${i}`

    if (e.type === 'tip') {
      return (
        <div key={key} className={`vt-row vt-tiprow ${past ? 'past' : ''}`}>
          <span className="vt-time" />
          <span className="vt-spine">
            <span className="vt-dot tip" />
          </span>
          <div className="vt-body vt-hover">
            <p className="vt-line muted small">
              {e.tip.emoji} {e.tip.tip.replace(/^(Break|Snack) idea: /, '')}
              <span className="vt-gap-len"> · ~{fmtMin(e.gapMin)}</span>
            </p>
            <span className="vt-tip">
              {e.tip.emoji} <strong>{e.tip.tip}.</strong> {e.tip.why}
            </span>
          </div>
        </div>
      )
    }

    if (e.type === 'now') {
      return (
        <div key={key} className="vt-row vt-now">
          <span className="vt-time">{clock(e.at)}</span>
          <span className="vt-spine">
            <span className="vt-dot now" />
          </span>
          <div className="vt-body">
            <span className="vt-now-label">you are here</span>
          </div>
        </div>
      )
    }

    const showSessionCard = !compact && sessionCard && e.type === 'study' && e.b.from === nextBlockFrom
    const showTestCard = !compact && testCard && e.type === 'test' && e.next

    return (
      <div key={key} className={`vt-row ${past ? 'past' : ''}`}>
        <span className="vt-time">{e.here ? clock(new Date(now).toISOString()) : dayClock(e.at)}</span>
        <span className="vt-spine">
          {e.here ? (
            <span className="vt-dot now" />
          ) : e.type === 'study' ? (
            <span className="vt-dot study" />
          ) : e.type === 'sleep' ? (
            <span className="vt-ico sleep">😴</span>
          ) : e.type === 'test' ? (
            <span className={`vt-ico test ${e.done ? 'done' : ''} ${e.next ? 'next' : ''}`}>
              {e.done ? '✓' : '🔥'}
            </span>
          ) : e.type === 'end' ? (
            <span className="vt-ico end">🎓</span>
          ) : (
            <span className="vt-dot" />
          )}
        </span>
        <div className="vt-body">
          {e.type === 'study' &&
            (showSessionCard ? (
              <>
                {e.here && <span className="vt-now-label">you are here</span>}
                {sessionCard}
              </>
            ) : (
              <div className="vt-hover">
                <p className="vt-line">
                  <strong>📖 Study</strong> · ~{fmtMin(e.b.min)}
                </p>
                <span className="vt-tip">
                  <strong>📖 ~{fmtMin(e.b.min)} of study</strong> ({clock(e.b.from)}–{clock(e.b.to)}),
                  then step away. {SPACING_SCIENCE}
                </span>
              </div>
            ))}

          {e.type === 'sleep' && (
            <div className="vt-hover">
              <p className="vt-line">
                <strong>💤 Sleep</strong>
                <span className="muted small"> · {clock(e.s.from)}–{clock(e.s.to)}</span>
              </p>
              <span className="vt-tip">
                <strong>💤 Why sleep instead of cramming?</strong> {SLEEP_SCIENCE}
              </span>
            </div>
          )}

          {e.type === 'test' &&
            (showTestCard ? (
              testCard
            ) : (
              <div className="vt-hover">
                <p className="vt-line">
                  <strong>
                    {e.done ? '✓' : '🔥'} Practice test {e.t.n}
                  </strong>
                  {e.done && <span className="muted small"> · taken</span>}
                </p>
                <span className="vt-tip">
                  {e.done ? (
                    <>
                      <strong>✓ Practice test {e.t.n}</strong> — taken. The refry that followed
                      doubled down on what you missed.
                    </>
                  ) : (
                    <>
                      <strong>🔥 Practice test {e.t.n}</strong> — simulates the real thing, then
                      your materials are rebuilt around what you miss. Score 80%+ to level up.
                    </>
                  )}
                </span>
              </div>
            ))}

          {e.type === 'final' &&
            (!compact && testCard && taken >= tests.length ? (
              testCard
            ) : (
              <p className="vt-line muted small">🍮 final review — one calm pass, then rest</p>
            ))}

          {e.type === 'end' && (
            <p className="vt-line vt-end-line">
              <strong>🎓 Your test</strong>
            </p>
          )}
        </div>
      </div>
    )
  })

  return (
    <div className={`vt ${compact ? 'compact' : ''}`}>
      {rows}
      {!compact && sessionCard && !nextBlockFrom && (
        <div className="vt-row">
          <span className="vt-time" />
          <span className="vt-spine">
            <span className="vt-dot study" />
          </span>
          <div className="vt-body">{sessionCard}</div>
        </div>
      )}
    </div>
  )
}
