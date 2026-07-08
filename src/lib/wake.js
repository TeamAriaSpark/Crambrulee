// Wake-up recall: right after sleep — before opening any notes — pour out
// everything you remember. Sleep just consolidated yesterday's studying;
// retrieving it immediately is the strongest way to lock it in.

export const WAKE_PROMPTS = [
  {
    key: 'formulas',
    emoji: '🧮',
    title: 'Key formulas',
    hint: 'Every formula, equation, or rule you can dig up — the symbols, what they mean, when they apply.',
  },
  {
    key: 'concepts',
    emoji: '💡',
    title: 'Main concepts',
    hint: 'The big ideas. One line each: what is it, and why does it matter?',
  },
  {
    key: 'definitions',
    emoji: '📖',
    title: 'Definitions',
    hint: 'Technical terms and what they mean, as precisely as you can manage.',
  },
  {
    key: 'processes',
    emoji: '🔁',
    title: 'Processes',
    hint: 'Step-by-step sequences: what happens first, what follows, and why that order.',
  },
  {
    key: 'mistakes',
    emoji: '⚠️',
    title: 'Common mistakes',
    hint: 'Traps you keep falling into — mix-ups, sign errors, look-alike concepts.',
  },
  {
    key: 'hard',
    emoji: '🔥',
    title: 'Hard topics from yesterday',
    hint: 'What felt shaky when you went to bed? Write whatever you can retrieve about it.',
  },
]

// Shown on sleep rows: short, deep-sleep-first.
export const SLEEP_RECS = [
  'Cool room, fully dark',
  'No screens or caffeine late — both cut deep sleep',
  'Cheat sheet at lights-out, wake-up recall first thing',
]

// Local grader: coverage of the materials' topics by the student's dump.
// A topic counts as recalled when its name (or enough of its key terms)
// shows up in what they wrote.
export function houseGradeWakeRecall(text, version) {
  const dump = String(text || '').toLowerCase()
  const recalled = []
  const missed = []
  for (const block of version.summary || []) {
    const keyTerms = new Set()
    block.topic
      .split(/\W+/)
      .filter((w) => w.length >= 4)
      .forEach((w) => keyTerms.add(w.toLowerCase()))
    ;(block.points || [])
      .join(' ')
      .split(/\W+/)
      .filter((w) => w.length >= 6)
      .forEach((w) => keyTerms.add(w.toLowerCase()))
    const topicHit = block.topic
      .toLowerCase()
      .split(/\W+/)
      .some((w) => w.length >= 4 && dump.includes(w))
    const termHits = [...keyTerms].filter((w) => dump.includes(w)).length
    if (topicHit || termHits >= 3) recalled.push(block.topic)
    else missed.push(block.topic)
  }
  const total = recalled.length + missed.length
  const score = total ? Math.round((recalled.length / total) * 100) : 0
  const feedback =
    missed.length === 0
      ? 'Everything came back — beautifully caramelized overnight. Skim the cheat sheet once and move on.'
      : recalled.length === 0
        ? 'A blank pour is still useful — it tells you exactly where to start. Open the cheat sheet and study the missed topics first.'
        : `Solid pour. The topics that didn’t surface are your first stop today — read them, then quiz yourself again.`
  return { score, recalled, missed, feedback, source: 'house' }
}
