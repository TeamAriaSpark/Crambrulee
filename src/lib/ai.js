// The real kitchen: generates study materials with Claude when the user has
// added their Anthropic API key. Falls back to the local engine (engine.js)
// when no key is set or a call fails — the app always works.
//
// Fully client-side: the key lives in localStorage and calls go straight from
// the browser to the Anthropic API; notes never touch our servers (we have none).

import Anthropic from '@anthropic-ai/sdk'

const KEY_STORAGE = 'cram-brulee-api-key'
const MODEL = 'claude-opus-4-8'

export const getApiKey = () => localStorage.getItem(KEY_STORAGE) || ''
export const setApiKey = (key) => {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim())
  else localStorage.removeItem(KEY_STORAGE)
}
export const hasApiKey = () => getApiKey().length > 0

// Structured-outputs schema for the generated materials. Constraints the
// schema can't express (exactly 4 options, uniform answerIdx) are enforced
// in normalize() below.
const MATERIALS_SCHEMA = {
  type: 'object',
  properties: {
    topics: { type: 'array', items: { type: 'string' } },
    summary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
        },
        required: ['topic', 'points'],
        additionalProperties: false,
      },
    },
    cheatSheet: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          facts: { type: 'array', items: { type: 'string' } },
        },
        required: ['topic', 'facts'],
        additionalProperties: false,
      },
    },
    flashcards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          a: { type: 'string' },
          topic: { type: 'string' },
        },
        required: ['q', 'a', 'topic'],
        additionalProperties: false,
      },
    },
    test: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerIdx: { type: 'integer', enum: [0, 1, 2, 3] },
          topic: { type: 'string' },
        },
        required: ['q', 'options', 'answerIdx', 'topic'],
        additionalProperties: false,
      },
    },
  },
  required: ['topics', 'summary', 'cheatSheet', 'flashcards', 'test'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You are the head chef at cram brûlée, a study app built on retrieval practice (active recall beats rereading). You turn a student's raw study notes into exam-ready materials.

Quality bar:
- Ground everything in the student's notes. Do not invent facts that aren't supported by them, but you may sharpen wording and add standard context that makes a fact testable.
- Summary points and cheat-sheet facts must be self-contained single sentences a stressed student can absorb fast. Cheat-sheet facts are the tighter, memorize-this version.
- Flashcards must demand genuine recall: definitions, mechanisms, comparisons, "why" questions — not yes/no or trivially guessable items.
- Practice-test questions simulate a real exam: exactly 4 options each, exactly one correct, and distractors that are plausible (drawn from related concepts in the notes, common confusions, or near-misses — never obviously wrong throwaways).
- Spread correct answers evenly across positions A-D so no option letter is a safe guess.
- Tag every item with the topic it belongs to, using the exact topic names you list in "topics".`

const LEVEL_PROMPTS = {
  novice: `DIFFICULTY: NOVICE. The student is meeting this material for the first time.
- Explain in plain language and define every technical term the first time it appears.
- Summary points teach the concept, not just state it.
- Flashcards test foundational understanding: definitions, "what is", "where does", simple why.
- Test questions check core comprehension; distractors are clearly distinguishable to someone who studied.
- Portions: 10-14 flashcards; exactly 6 test questions.`,
  competent: `DIFFICULTY: COMPETENT. The student has the basics down.
- Standard exam level: mechanisms, comparisons, cause-and-effect, application to straightforward scenarios.
- Test distractors are plausible near-misses that catch shallow understanding.
- Portions: 12-20 flashcards; exactly 8 test questions.`,
  expert: `DIFFICULTY: EXPERT. The student knows this material well — push them hard.
- Summaries and cheat sheet are terse and dense: edge cases, exceptions, subtle distinctions, connections between topics.
- Flashcards demand synthesis and multi-step reasoning, not lone facts.
- Test questions are the hardest fair questions the notes support: application to novel scenarios, "which of these is NOT", combining two concepts. Distractors are near-indistinguishable without deep understanding.
- Portions: 16-24 flashcards; exactly 10 test questions.`,
}

function buildUserPrompt(rawText, weakTopics, version, level) {
  const focus =
    weakTopics.length > 0
      ? `\n\nREFRY ORDER (version ${version}): the student just bombed these topics on a practice test: ${weakTopics.join(', ')}.
- Put these weak topics FIRST in topics, summary, and cheatSheet.
- Give them roughly double portions: about twice the summary points, cheat-sheet facts, and flashcards of other topics, and make ~60% of the test questions target them.
- Attack them from new angles — do not repeat earlier phrasings; vary question styles so the student can't pattern-match.`
      : ''
  return `Cook study materials from these notes.

Portions: 3-6 topics; 3-5 summary points per topic; 2-4 cheat-sheet facts per topic.

${LEVEL_PROMPTS[level] || LEVEL_PROMPTS.novice}${focus}

STUDENT'S NOTES:
${rawText}`
}

// Coerce the model output into the exact shape the app expects, and drop
// anything malformed rather than letting it break the UI.
function normalize(data, weakTopics, version, level) {
  const weak = new Set(weakTopics.map((t) => t.toLowerCase()))
  const isWeak = (t) => weak.has(String(t).toLowerCase())
  const str = (s) => String(s ?? '').trim()

  const summary = (data.summary || [])
    .filter((b) => str(b.topic) && Array.isArray(b.points) && b.points.length)
    .map((b) => ({ topic: str(b.topic), weak: isWeak(b.topic), points: b.points.map(str) }))
  const cheatSheet = (data.cheatSheet || [])
    .filter((b) => str(b.topic) && Array.isArray(b.facts) && b.facts.length)
    .map((b) => ({ topic: str(b.topic), weak: isWeak(b.topic), facts: b.facts.map(str) }))
  const flashcards = (data.flashcards || [])
    .filter((c) => str(c.q) && str(c.a))
    .map((c) => ({ q: str(c.q), a: str(c.a), topic: str(c.topic) || 'Core ideas', kind: 'ai' }))
  const test = (data.test || [])
    .filter(
      (q) =>
        str(q.q) &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.answerIdx) &&
        q.answerIdx >= 0 &&
        q.answerIdx <= 3
    )
    .map((q) => ({
      q: str(q.q),
      options: q.options.map(str),
      answerIdx: q.answerIdx,
      topic: str(q.topic) || 'Core ideas',
    }))

  if (summary.length === 0 || flashcards.length < 4 || test.length < 4) {
    throw new Error('AI returned incomplete materials')
  }

  return {
    id: `v${version}`,
    version,
    label: version === 1 ? 'Original recipe' : `Refried v${version}`,
    level,
    focusTopics: weakTopics,
    createdAt: new Date().toISOString(),
    topics: (data.topics || summary.map((b) => b.topic)).map(str),
    summary,
    cheatSheet,
    flashcards,
    test,
    source: 'ai',
  }
}

export async function generateMaterialsAI(
  rawText,
  { weakTopics = [], version = 1, level = 'novice' } = {}
) {
  const client = new Anthropic({
    apiKey: getApiKey(),
    dangerouslyAllowBrowser: true, // user's own key, stored locally, calls made from their browser
  })

  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: MATERIALS_SCHEMA } },
      messages: [
        { role: 'user', content: buildUserPrompt(rawText, weakTopics, version, level) },
      ],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError)
      throw new Error('your API key was rejected — double-check it on the upload screen')
    if (err instanceof Anthropic.RateLimitError)
      throw new Error('the Anthropic API is rate-limiting us — try again in a minute')
    if (err instanceof Anthropic.APIConnectionError)
      throw new Error('couldn’t reach the Anthropic API — check your connection')
    if (err instanceof Anthropic.APIError) throw new Error(`Anthropic API error (${err.status})`)
    throw err
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('The AI declined to process these notes')
  }
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('AI returned no content')
  return normalize(JSON.parse(textBlock.text), weakTopics, version, level)
}
