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
  {
    emoji: '💤',
    tip: 'Studying overnight? Real sleep beats more hours',
    why: 'Sleep is when your brain moves today’s studying into long-term memory — an all-nighter undoes the work.',
  },
]

const addMin = (d, m) => new Date(d.getTime() + m * 60000)

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

  // Suggested sleep blocks (23:00–07:00) whenever the runway crosses a night
  // with at least a couple of hours to sleep in it.
  const sleeps = []
  if (hours >= 9) {
    let bed = new Date(now)
    bed.setHours(23, 0, 0, 0)
    if (now.getHours() < 7) bed.setDate(bed.getDate() - 1)
    while (bed < finalReviewAt) {
      const wake = new Date(bed)
      wake.setHours(31, 0, 0, 0) // 07:00 the next morning
      const from = new Date(Math.max(bed.getTime(), now.getTime()))
      const to = new Date(Math.min(wake.getTime(), finalReviewAt.getTime()))
      if (to - from >= 2 * 3600000) {
        sleeps.push({ from: from.toISOString(), to: to.toISOString() })
      }
      bed = new Date(wake)
      bed.setHours(23, 0, 0, 0)
    }
  }

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
