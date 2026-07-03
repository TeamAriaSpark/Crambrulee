// The recipe card: turns "hours until test" into a timeline of
// study → active recall → break cycles, practice-test milestones,
// sleep blocks, and brain-food suggestions.

const NUTRIENT_TIPS = [
  '🫐 Blueberries + walnuts — antioxidants and omega-3s for memory.',
  '💧 Big glass of water — even mild dehydration dulls recall.',
  '🍫 Square of dark chocolate — flavonoids give focus a gentle lift.',
  '🥚 Eggs or Greek yogurt — protein keeps blood sugar steady.',
  '🍌 Banana + peanut butter — slow-burn fuel, no sugar crash.',
  '🍵 Green tea — caffeine plus L-theanine for calm alertness.',
  '🥦 Leafy greens — folate and vitamin K, the long-game brain food.',
]

const BREAK_TIPS = [
  'Walk around the block — movement consolidates memory.',
  'Stretch + 10 deep breaths. No doomscrolling; let it simmer.',
  'Stare out a window. Diffuse mode is where connections form.',
  'Power nap (≤20 min) if you are fading — set an alarm!',
]

let idCounter = 0
const makeItem = (type, title, start, durationMin, detail = '') => ({
  id: `step-${++idCounter}`,
  type, // 'study' | 'recall' | 'test' | 'break' | 'sleep' | 'final'
  title,
  detail,
  start: start.toISOString(),
  durationMin,
})

const addMin = (d, m) => new Date(d.getTime() + m * 60000)

export function generatePlan(testTimeISO, now = new Date()) {
  idCounter = 0
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

  while (addMin(cursor, study + recall) <= endOfWork && items.length < 80) {
    // Sleep beats studying: if it's late and there's still a long runway, sleep.
    const hour = cursor.getHours()
    const remainingMin = (endOfWork - cursor) / 60000
    if ((hour >= 22 || hour < 5) && remainingMin > 9 * 60 && sinceSleepMin > 4 * 60) {
      const wake = new Date(cursor)
      wake.setHours(hour < 5 ? 7 : 31, 0, 0, 0) // 7:00 today or tomorrow
      const sleepMin = Math.round((wake - cursor) / 60000)
      items.push(
        makeItem(
          'sleep',
          '💤 Sleep — non-negotiable',
          cursor,
          sleepMin,
          'Sleep is when your brain caramelizes today’s studying into long-term memory. All-nighters burn the custard.'
        )
      )
      cursor = wake
      sinceSleepMin = 0
      continue
    }

    cycle++
    items.push(
      makeItem(
        'study',
        `🍳 Study block ${cycle}`,
        cursor,
        study,
        'Work through the AI summary and cheat sheet. Read actively: quiz yourself as you go.'
      )
    )
    cursor = addMin(cursor, study)

    items.push(
      makeItem(
        'recall',
        `🧠 Active recall ${cycle}`,
        cursor,
        recall,
        'Flashcards, notes closed. Retrieval practice is the special sauce — it beats rereading every time.'
      )
    )
    cursor = addMin(cursor, recall)
    sinceSleepMin += study + recall

    // Practice tests as evenly-spaced milestones through the remaining cycles.
    const progress = 1 - (endOfWork - cursor) / (endOfWork - now)
    if (
      testCount < plannedTests &&
      progress >= (testCount + 1) / (plannedTests + 0.4) &&
      addMin(cursor, testLen) <= endOfWork
    ) {
      testCount++
      items.push(
        makeItem(
          'test',
          `🔥 Practice test ${testCount}`,
          cursor,
          testLen,
          'Simulates the real thing. Afterward we refry your summaries, flashcards, and next test around your weak spots.'
        )
      )
      cursor = addMin(cursor, testLen)
      sinceSleepMin += testLen
    }

    if (addMin(cursor, brk) <= endOfWork) {
      const tip =
        cycle % 2 === 0
          ? NUTRIENT_TIPS[cycle % NUTRIENT_TIPS.length]
          : BREAK_TIPS[cycle % BREAK_TIPS.length]
      items.push(makeItem('break', '☕ Break', cursor, brk, tip))
      cursor = addMin(cursor, brk)
      sinceSleepMin += brk
    }
  }

  items.push(
    makeItem(
      'final',
      '🍮 Final glaze',
      endOfWork,
      bufferMin,
      'One calm pass over the cheat sheet, water, a snack, deep breaths. You’ve got this — go crack that crust.'
    )
  )

  // Guarantee at least one practice test even on tiny runways.
  if (testCount === 0) {
    const insertAt = items.findIndex((i) => i.type === 'final')
    const anchor = items[Math.max(insertAt - 1, 0)]
    items.splice(
      insertAt,
      0,
      makeItem(
        'test',
        '🔥 Practice test 1',
        addMin(new Date(anchor.start), anchor.durationMin),
        Math.min(testLen, bufferMin),
        'Even a quick simulated test tells us what to refry.'
      )
    )
  }

  return items
}

export const TYPE_META = {
  study: { emoji: '🍳', color: 'var(--step-study)', label: 'Study' },
  recall: { emoji: '🧠', color: 'var(--step-recall)', label: 'Active recall' },
  test: { emoji: '🔥', color: 'var(--step-test)', label: 'Practice test' },
  break: { emoji: '☕', color: 'var(--step-break)', label: 'Break' },
  sleep: { emoji: '💤', color: 'var(--step-sleep)', label: 'Sleep' },
  final: { emoji: '🍮', color: 'var(--step-final)', label: 'Final glaze' },
}
