// The recipe card: turns "hours until test" into a simple timeline of
// cook cycles (study → active recall → break), practice-test milestones,
// sleep blocks, and brain-food suggestions with the science behind them.

const NUTRIENT_TIPS = [
  {
    emoji: '🫐',
    tip: 'Blueberries + a handful of walnuts',
    why: 'Berry anthocyanins boost blood flow to the hippocampus — your memory center — and walnut omega-3s are the raw material for the connections you’re building right now.',
  },
  {
    emoji: '💧',
    tip: 'A big glass of water',
    why: 'Even 1–2% dehydration measurably dulls focus and working memory. Cheapest brain upgrade there is.',
  },
  {
    emoji: '🍫',
    tip: 'A square of dark chocolate',
    why: 'Cocoa flavonoids increase blood flow to the brain, and the touch of caffeine sharpens attention without the jitters.',
  },
  {
    emoji: '🥚',
    tip: 'Eggs or Greek yogurt',
    why: 'Protein keeps blood sugar steady so you don’t crash mid-cycle — and eggs add choline, a building block of acetylcholine, the memory neurotransmitter.',
  },
  {
    emoji: '🍌',
    tip: 'Banana + peanut butter',
    why: 'Slow-release carbs keep glucose — the brain’s only fuel — steady instead of spiking and crashing.',
  },
  {
    emoji: '🍵',
    tip: 'Green tea',
    why: 'Caffeine plus L-theanine produces calm, focused alertness — studies show the combo beats coffee for attention.',
  },
]

const BREAK_TIPS = [
  {
    emoji: '🚶',
    tip: 'Walk around the block',
    why: 'Light exercise raises BDNF, the protein that helps freshly studied material consolidate into long-term memory.',
  },
  {
    emoji: '🧘',
    tip: 'Stretch + 10 slow breaths (no doomscrolling)',
    why: 'Slow breathing lowers cortisol — and stress hormones actively block memory retrieval.',
  },
  {
    emoji: '🪟',
    tip: 'Stare out a window and let your mind wander',
    why: 'Diffuse mode is when your brain links new material to what you already know. Connections form when you stop forcing them.',
  },
  {
    emoji: '😴',
    tip: 'Power nap, 20 minutes max — set an alarm!',
    why: 'Short naps trigger the same memory consolidation as night sleep. Even 10 minutes measurably improves recall.',
  },
]

let idCounter = 0
const addMin = (d, m) => new Date(d.getTime() + m * 60000)

export function generatePlan(testTimeISO, now = new Date()) {
  idCounter = 0
  const makeId = () => `step-${++idCounter}`
  const testTime = new Date(testTimeISO)
  const totalMin = Math.max(30, (testTime - now) / 60000)
  const hours = totalMin / 60

  // Cycle length scales with runway: short runway → tight 45-min cycles,
  // long runway → bigger blocks so the plan stays digestible.
  const cycleMin = Math.min(180, Math.max(45, Math.round(totalMin / 14)))
  const study = Math.round(cycleMin * 0.5)
  const recall = Math.round(cycleMin * 0.3)
  const brk = cycleMin - study - recall
  const testLen = 25

  // Leave a buffer before the real test: review the cheat sheet, then rest.
  const bufferMin = hours <= 3 ? 20 : 45
  const endOfWork = addMin(testTime, -bufferMin)

  const items = []
  let cursor = new Date(now)
  let cycle = 0
  let testCount = 0
  const plannedTests = hours <= 5 ? 2 : hours <= 24 ? 3 : 4
  let sinceSleepMin = 0

  while (addMin(cursor, study + recall) <= endOfWork && items.length < 60) {
    // Sleep beats studying: if it's late and there's still a long runway, sleep.
    const hour = cursor.getHours()
    const remainingMin = (endOfWork - cursor) / 60000
    if ((hour >= 22 || hour < 5) && remainingMin > 9 * 60 && sinceSleepMin > 4 * 60) {
      const wake = new Date(cursor)
      wake.setHours(hour < 5 ? 7 : 31, 0, 0, 0) // 7:00 today or tomorrow
      const sleepMin = Math.round((wake - cursor) / 60000)
      items.push({
        id: makeId(),
        type: 'sleep',
        title: '💤 Sleep — non-negotiable',
        detail:
          'Sleep is when your brain caramelizes today’s studying into long-term memory. All-nighters burn the custard.',
        start: cursor.toISOString(),
        durationMin: sleepMin,
      })
      cursor = wake
      sinceSleepMin = 0
      continue
    }

    cycle++

    // A cycle is study → recall, then a practice test when we've crossed the
    // next evenly-spaced milestone, then a break to recover. All one card.
    const afterStudyRecall = addMin(cursor, study + recall)
    const progress = 1 - (endOfWork - afterStudyRecall) / (endOfWork - now)
    const withTest =
      testCount < plannedTests &&
      progress >= (testCount + 1) / (plannedTests + 0.4) &&
      addMin(afterStudyRecall, testLen) <= endOfWork
    if (withTest) testCount++
    const withBreak =
      addMin(afterStudyRecall, (withTest ? testLen : 0) + brk) <= endOfWork
    const tipList = cycle % 2 === 0 ? NUTRIENT_TIPS : BREAK_TIPS

    const parts = [
      { kind: 'study', durationMin: study },
      { kind: 'recall', durationMin: recall },
    ]
    if (withTest) parts.push({ kind: 'test', durationMin: testLen, n: testCount })
    if (withBreak)
      parts.push({
        kind: 'break',
        durationMin: brk,
        ...tipList[Math.floor(cycle / 2) % tipList.length],
      })

    const totalMinCycle = parts.reduce((sum, p) => sum + p.durationMin, 0)
    items.push({
      id: makeId(),
      type: 'cycle',
      n: cycle,
      start: cursor.toISOString(),
      durationMin: totalMinCycle,
      parts,
    })
    cursor = addMin(cursor, totalMinCycle)
    sinceSleepMin += totalMinCycle
  }

  items.push({
    id: makeId(),
    type: 'final',
    title: '🍮 Final glaze',
    detail:
      'One calm pass over the cheat sheet, water, a snack, deep breaths. You’ve got this — go crack that crust.',
    start: endOfWork.toISOString(),
    durationMin: bufferMin,
  })

  // Guarantee at least one practice test even on tiny runways: tack a quick
  // one onto the last cycle.
  if (testCount === 0) {
    const lastCycle = [...items].reverse().find((i) => i.type === 'cycle')
    if (lastCycle) {
      const quickTest = Math.min(testLen, bufferMin)
      const breakIdx = lastCycle.parts.findIndex((p) => p.kind === 'break')
      lastCycle.parts.splice(breakIdx === -1 ? lastCycle.parts.length : breakIdx, 0, {
        kind: 'test',
        durationMin: quickTest,
        n: 1,
      })
      lastCycle.durationMin += quickTest
    }
  }

  return items
}

export const TYPE_META = {
  cycle: { color: 'var(--step-study)' },
  sleep: { color: 'var(--step-sleep)' },
  final: { color: 'var(--step-final)' },
}
