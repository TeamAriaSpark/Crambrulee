// The kitchen: turns raw study material into summaries, cheat sheets,
// flashcards, and practice tests. "Refrying" regenerates everything
// weighted toward the topics a practice test showed were weak.

const STOPWORDS = new Set(
  `a an and are as at be but by for from has have had he her his i in is it its
   of on or she that the their them they this to was we were which will with you
   your not no can could would should may might must do does did done what when
   where who whom whose why how all any both each few more most other some such
   than too very just also then there these those into over under again once
   about between through during before after above below up down out off only
   own same so if because while until being been am us our it's don't`
    .split(/\s+/)
    .filter(Boolean)
)

function tokenize(text) {
  return (text.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ'-]{2,}/gi) || []).filter(
    (w) => !STOPWORDS.has(w)
  )
}

function splitSentences(text) {
  return text
    .replace(/\r/g, '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((s) => s.length >= 25 && /[a-z]/i.test(s))
}

// ---------- topics ----------

function extractSections(text) {
  const lines = text.replace(/\r/g, '').split('\n')
  const sections = []
  let current = null
  const isBareHeading = (t) =>
    t.length > 0 &&
    t.length <= 48 &&
    /^[A-Z0-9]/.test(t) &&
    !/[.!?,;]$/.test(t) &&
    t.split(/\s+/).length <= 6
  for (const line of lines) {
    const t = line.trim()
    if (/^#{1,4}\s+/.test(t) || /^[A-Z][^.!?]{1,48}:$/.test(t) || isBareHeading(t)) {
      current = { title: t.replace(/^#{1,4}\s+/, '').replace(/:$/, '').trim(), body: [] }
      sections.push(current)
    } else if (current) {
      current.body.push(line)
    }
  }
  return sections
    .map((s) => ({ title: s.title, body: s.body.join('\n').trim() }))
    .filter((s) => s.body.length > 40)
}

function keywordTopics(text, count = 5) {
  const freq = new Map()
  for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1)
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([w]) => w[0].toUpperCase() + w.slice(1))
}

export function buildTopics(text) {
  const sections = extractSections(text)
  if (sections.length >= 2) {
    return sections.map((s) => ({ name: s.title, text: s.body }))
  }
  const sentences = splitSentences(text)
  const names = keywordTopics(text, 5)
  if (names.length === 0) return [{ name: 'Core ideas', text }]
  const topics = names.map((name) => ({ name, sentences: [] }))
  const misc = { name: 'Core ideas', sentences: [] }
  for (const s of sentences) {
    const lower = s.toLowerCase()
    const hit = topics.find((t) => lower.includes(t.name.toLowerCase()))
    ;(hit || misc).sentences.push(s)
  }
  return [...topics, misc]
    .filter((t) => t.sentences.length > 0)
    .map((t) => ({ name: t.name, text: t.sentences.join(' ') }))
}

// ---------- scoring ----------

function scoreSentences(sentences, fullText) {
  const freq = new Map()
  for (const w of tokenize(fullText)) freq.set(w, (freq.get(w) || 0) + 1)
  return sentences.map((s) => {
    const words = tokenize(s)
    const score =
      words.reduce((sum, w) => sum + (freq.get(w) || 0), 0) /
      Math.max(words.length, 1)
    return { sentence: s, score, words }
  })
}

// ---------- generators ----------

function definitionCards(sentences, topic) {
  const cards = []
  for (const s of sentences) {
    let m = s.match(
      /^([A-Z][\w\s'’()-]{1,60}?)\s+(?:is|are|was|were|means|refers to|describes|consists of)\s+(.{10,240})$/
    )
    if (m) {
      cards.push({
        q: `What ${/(are|were)/.test(s.split(/\s+/)[1] || '') ? 'are' : 'is'} ${m[1].trim()}?`,
        a: m[2].trim().replace(/[.;,]$/, '') + '.',
        topic,
        kind: 'definition',
      })
      continue
    }
    m = s.match(/^([A-Z][\w\s'’()-]{1,50}):\s+(.{10,240})$/)
    if (m) {
      cards.push({ q: `Define: ${m[1].trim()}`, a: m[2].trim(), topic, kind: 'definition' })
    }
  }
  return cards
}

function clozeCards(scored, topic, max) {
  const cards = []
  const used = new Set()
  for (const { sentence, words } of scored) {
    if (cards.length >= max) break
    if (sentence.length > 220 || words.length < 4) continue
    const target = [...words].sort((a, b) => b.length - a.length).find((w) => !used.has(w))
    if (!target) continue
    const re = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (!re.test(sentence)) continue
    used.add(target)
    cards.push({
      q: sentence.replace(re, '＿＿＿'),
      a: target[0].toUpperCase() + target.slice(1),
      topic,
      kind: 'cloze',
    })
  }
  return cards
}

// mulberry32 — small seeds must still produce well-mixed shuffles, or the
// correct answer clusters in one option slot and students learn "always pick D".
function rng(seed) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, seed = 1) {
  const rand = rng(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTest(flashcards, questionCount, seed) {
  const pool = flashcards.filter((c) => c.a.length <= 140)
  const questions = []
  // One RNG stream for the whole test: sequential draws stay well mixed,
  // where per-question reseeding made answer positions cluster.
  const rand = rng(seed)
  for (const card of shuffle(pool, seed).slice(0, questionCount)) {
    // Distractors must be the same kind of answer as the correct one — a
    // single-word cloze answer among sentence-long definitions (or vice
    // versa) makes the right option obvious by shape alone.
    const isCloze = card.kind === 'cloze'
    const sameKind = [
      ...new Set(
        pool
          .filter((c) => (c.kind === 'cloze') === isCloze && c.a !== card.a)
          .map((c) => c.a)
      ),
    ]
    const anyKind = [...new Set(pool.filter((c) => c.a !== card.a).map((c) => c.a))]
    const distractors = shuffle(
      sameKind.length >= 3 ? sameKind : anyKind,
      seed + questions.length
    ).slice(0, 3)
    while (distractors.length < 3) distractors.push('None of the above')
    // Drop the correct answer into a uniform slot so no option letter
    // is ever the statistically safe guess.
    const options = distractors
    const answerIdx = Math.floor(rand() * 4)
    options.splice(answerIdx, 0, card.a)
    questions.push({
      q: card.kind === 'cloze' ? `Fill in the blank: ${card.q}` : card.q,
      options,
      answerIdx,
      topic: card.topic,
    })
  }
  return questions
}

// ---------- main entry ----------

// Difficulty scales the portions: novice keeps things digestible,
// expert piles on more cards and a longer, harder test.
export const LEVELS = ['novice', 'competent', 'expert']
export const LEVEL_META = {
  novice: { emoji: '🌱', points: 3, facts: 2, cards: 12, questions: 6 },
  competent: { emoji: '🍳', points: 4, facts: 3, cards: 16, questions: 8 },
  expert: { emoji: '👨‍🍳', points: 5, facts: 4, cards: 20, questions: 10 },
}

export function generateMaterials(rawText, { weakTopics = [], version = 1, level = 'novice' } = {}) {
  const lvl = LEVEL_META[level] || LEVEL_META.novice
  const topics = buildTopics(rawText)
  const weak = new Set(weakTopics.map((t) => t.toLowerCase()))
  const isWeak = (name) => weak.has(name.toLowerCase())

  // Weak topics rise to the top of everything and get bigger portions.
  const ordered = [...topics].sort((a, b) => (isWeak(b.name) ? 1 : 0) - (isWeak(a.name) ? 1 : 0))

  const summary = []
  const cheatSheet = []
  let flashcards = []

  for (const topic of ordered) {
    const sentences = splitSentences(topic.text)
    if (sentences.length === 0) continue
    const scored = scoreSentences(sentences, rawText).sort((a, b) => b.score - a.score)
    const boost = isWeak(topic.name) ? 2 : 1

    summary.push({
      topic: topic.name,
      weak: isWeak(topic.name),
      points: scored.slice(0, lvl.points * boost).map((s) => s.sentence),
    })
    cheatSheet.push({
      topic: topic.name,
      weak: isWeak(topic.name),
      facts: scored
        .slice(0, lvl.facts * boost)
        .map((s) =>
          s.sentence.length > 140 ? s.sentence.slice(0, 137).trimEnd() + '…' : s.sentence
        ),
    })

    const defs = definitionCards(sentences, topic.name)
    const cloze = clozeCards(scored, topic.name, 3 * boost)
    flashcards.push(...defs.slice(0, 3 * boost), ...cloze)
  }

  // Keep decks a digestible size; weak-topic cards always survive the cut.
  const weakCards = flashcards.filter((c) => isWeak(c.topic))
  const otherCards = flashcards.filter((c) => !isWeak(c.topic))
  flashcards = [...weakCards, ...otherCards].slice(0, lvl.cards)

  const test = buildTest(
    flashcards,
    Math.min(lvl.questions, Math.max(4, flashcards.length)),
    version * 13
  )

  return {
    id: `v${version}`,
    version,
    label: version === 1 ? 'Original recipe' : `Refried v${version}`,
    level,
    focusTopics: weakTopics,
    createdAt: new Date().toISOString(),
    topics: topics.map((t) => t.name),
    summary,
    cheatSheet,
    flashcards,
    test,
  }
}

export function weakTopicsFromResults(questions, answers) {
  const byTopic = new Map()
  questions.forEach((q, i) => {
    const entry = byTopic.get(q.topic) || { right: 0, wrong: 0 }
    if (answers[i] === q.answerIdx) entry.right++
    else entry.wrong++
    byTopic.set(q.topic, entry)
  })
  return [...byTopic.entries()]
    .filter(([, { right, wrong }]) => wrong > 0 && wrong >= right)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .map(([topic]) => topic)
}
