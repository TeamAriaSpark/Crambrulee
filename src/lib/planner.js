// The plan is deliberately loose: students study or drill flashcards whenever
// they like. We only suggest when to take each practice test (evenly spaced
// milestones through the time they have) and when to stop for a final review.

export const TIPS = [
  {
    emoji: '🚶',
    tip: 'Break idea: walk around the block',
    why: 'Light exercise raises BDNF, the protein that helps fresh material consolidate into long-term memory.',
  },
  {
    emoji: '🫐',
    tip: 'Snack idea: blueberries + a handful of walnuts',
    why: 'Berry anthocyanins boost blood flow to your memory centers; walnut omega-3s build the connections you’re forming.',
  },
  {
    emoji: '🧘',
    tip: 'Break idea: stretch + 10 slow breaths',
    why: 'Slow breathing lowers cortisol — and stress hormones actively block memory retrieval.',
  },
  {
    emoji: '💧',
    tip: 'Drink a big glass of water',
    why: 'Even 1–2% dehydration measurably dulls focus and working memory.',
  },
  {
    emoji: '😴',
    tip: 'Fading? Power nap, 20 minutes max — set an alarm',
    why: 'Short naps trigger the same memory consolidation as night sleep.',
  },
  {
    emoji: '🍌',
    tip: 'Snack idea: banana + peanut butter',
    why: 'Slow-release carbs keep glucose — the brain’s only fuel — steady instead of spiking.',
  },
  {
    emoji: '🍵',
    tip: 'Sip green tea',
    why: 'Caffeine plus L-theanine gives calm, focused alertness — the combo beats coffee for attention.',
  },
]

const addMin = (d, m) => new Date(d.getTime() + m * 60000)

// Cramming intensity: what share of your awake time between practice tests
// we suggest actually spending on study.
export const INTENSITY = {
  chill: {
    emoji: '🍦',
    label: 'Chill',
    factor: 0.35,
    blurb: 'lighter suggestions — plenty of slack between practice tests',
  },
  steady: {
    emoji: '🍳',
    label: 'Steady',
    factor: 0.55,
    blurb: 'a balanced amount of study before each practice test',
  },
  intense: {
    emoji: '🔥',
    label: 'Full flame',
    factor: 0.78,
    blurb: 'packs most of your awake time with study',
  },
}

// Minutes between two times, minus any overlap with suggested sleep blocks.
export function awakeMinutes(fromISO, toISO, sleeps = []) {
  const from = new Date(fromISO).getTime()
  const to = new Date(toISO).getTime()
  let min = Math.max(0, (to - from) / 60000)
  for (const s of sleeps) {
    const a = Math.max(from, new Date(s.from).getTime())
    const b = Math.min(to, new Date(s.to).getTime())
    if (b > a) min -= (b - a) / 60000
  }
  return min
}

// How much study we suggest inside one stretch of the runway, given the
// chosen intensity.
export function suggestedStudyMin(fromISO, toISO, sleeps = [], intensity = 'steady') {
  const factor = (INTENSITY[intensity] || INTENSITY.steady).factor
  const raw = awakeMinutes(fromISO, toISO, sleeps) * factor
  return Math.max(10, Math.round(raw / 5) * 5)
}

const ms = (iso) => new Date(iso).getTime()

// Awake sub-intervals of [from, to] once sleep is carved out.
function awakeParts(fromISO, toISO, sleeps) {
  let parts = [[ms(fromISO), ms(toISO)]]
  for (const s of sleeps) {
    const sa = ms(s.from)
    const sb = ms(s.to)
    parts = parts.flatMap(([a, b]) => {
      if (sb <= a || sa >= b) return [[a, b]]
      const kept = []
      if (sa > a) kept.push([a, sa])
      if (sb < b) kept.push([sb, b])
      return kept
    })
  }
  return parts.filter(([a, b]) => b > a)
}

// Map "minutes into the awake time" to a wall-clock block of lenMin, moving
// the block forward when it would straddle a sleep boundary.
function offsetToWall(parts, offMin, lenMin) {
  let rem = offMin
  for (let i = 0; i < parts.length; i++) {
    const [a, b] = parts[i]
    const dur = (b - a) / 60000
    if (rem >= dur) {
      rem -= dur
      continue
    }
    let start = a + rem * 60000
    if (start + lenMin * 60000 > b) {
      if (i + 1 < parts.length) {
        const [a2, b2] = parts[i + 1]
        start = a2
        if (start + lenMin * 60000 > b2) return null
      } else {
        start = Math.max(a, b - lenMin * 60000)
      }
    }
    return { from: start, to: start + lenMin * 60000 }
  }
  return null
}

// Discrete, spaced study blocks. The spacing is deliberate: consolidation
// happens in the gaps, and spaced sessions beat one massed marathon — so we
// never fill a stretch wall-to-wall.
export function suggestStudyBlocks(plan, intensity = 'steady') {
  const sleeps = plan?.sleeps || []
  const tests = plan?.tests || []
  const points = [plan.startedAt, ...tests.map((t) => t.suggestedAt), plan.finalReviewAt]
  const blocks = []
  for (let i = 0; i + 1 < points.length; i++) {
    const parts = awakeParts(points[i], points[i + 1], sleeps)
    const awake = parts.reduce((m, [a, b]) => m + (b - a) / 60000, 0)
    if (awake < 20) continue
    const total = Math.min(
      suggestedStudyMin(points[i], points[i + 1], sleeps, intensity),
      awake * 0.85
    )
    const n = Math.max(1, Math.min(6, Math.round(total / 55)))
    const len = Math.max(20, Math.round(total / n / 5) * 5)
    const air = Math.max(5, (awake - n * len) / (n + 1))
    let lastEnd = 0
    for (let k = 0; k < n; k++) {
      const wall = offsetToWall(parts, air * (k + 1) + len * k, len)
      if (!wall || wall.from < lastEnd) continue
      lastEnd = wall.to
      blocks.push({
        from: new Date(wall.from).toISOString(),
        to: new Date(wall.to).toISOString(),
        min: len,
        beforeTest: tests[i] ? tests[i].n : null,
      })
    }
  }
  return blocks
}

// Suggested sleep blocks (23:00–07:00) whenever the window crosses a night
// with at least a couple of hours to sleep in it. Exported so the plan view
// can backfill sleeps for sessions saved before this existed.
export function suggestSleeps(fromISO, toISO) {
  const from = new Date(fromISO)
  const to = new Date(toISO)
  const sleeps = []
  if (to - from < 9 * 3600000) return sleeps
  let bed = new Date(from)
  bed.setHours(23, 0, 0, 0)
  if (from.getHours() < 7) bed.setDate(bed.getDate() - 1)
  while (bed < to) {
    const wake = new Date(bed)
    wake.setHours(31, 0, 0, 0) // 07:00 the next morning
    const start = new Date(Math.max(bed.getTime(), from.getTime()))
    const end = new Date(Math.min(wake.getTime(), to.getTime()))
    if (end - start >= 2 * 3600000) {
      sleeps.push({ from: start.toISOString(), to: end.toISOString() })
    }
    bed = new Date(wake)
    bed.setHours(23, 0, 0, 0)
  }
  return sleeps
}

export function generatePlan(testTimeISO, now = new Date()) {
  const testTime = new Date(testTimeISO)
  const totalMin = Math.max(30, (testTime - now) / 60000)
  const hours = totalMin / 60

  // Stop studying a little before the real test: one calm review, then rest.
  const bufferMin = hours <= 3 ? 20 : 45
  const finalReviewAt = addMin(testTime, -bufferMin)
  const workMin = Math.max(20, (finalReviewAt - now) / 60000)

  const plannedTests = hours <= 5 ? 2 : hours <= 24 ? 3 : 4
  const tests = Array.from({ length: plannedTests }, (_, i) => ({
    id: `test-${i + 1}`,
    n: i + 1,
    suggestedAt: addMin(now, Math.round((workMin * (i + 1)) / (plannedTests + 0.35))).toISOString(),
  }))

  const sleeps = suggestSleeps(now.toISOString(), finalReviewAt.toISOString())

  // Never suggest a practice test mid-sleep — nudge it to the morning after —
  // and keep at least 45 minutes between suggestions when shifts collide.
  for (const t of tests) {
    for (const s of sleeps) {
      const at = new Date(t.suggestedAt)
      if (at > new Date(s.from) && at < new Date(s.to)) t.suggestedAt = s.to
    }
  }
  const MIN_GAP = 45 * 60000
  for (let i = 1; i < tests.length; i++) {
    const prev = new Date(tests[i - 1].suggestedAt).getTime()
    const cur = new Date(tests[i].suggestedAt).getTime()
    if (cur - prev < MIN_GAP) {
      tests[i].suggestedAt = new Date(
        Math.min(prev + MIN_GAP, finalReviewAt.getTime())
      ).toISOString()
    }
  }

  return {
    startedAt: now.toISOString(),
    testAt: testTime.toISOString(),
    finalReviewAt: finalReviewAt.toISOString(),
    tests,
    sleeps,
  }
}
