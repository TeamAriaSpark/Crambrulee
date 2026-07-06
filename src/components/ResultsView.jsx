const LEVEL_EMOJI = { novice: '🌱', competent: '🍳', expert: '👨‍🍳' }

export default function ResultsView({ result, level, onRefry, onRecook, onPlan }) {
  const pct = Math.round((result.score / result.total) * 100)
  const verdict =
    pct >= 90
      ? { emoji: '👨‍🍳💋', line: 'Chef’s kiss! That crust is perfect.' }
      : pct >= 70
        ? { emoji: '🍮', line: 'Nicely set — a little more heat on the soft spots.' }
        : pct >= 50
          ? { emoji: '🥄', line: 'Still a bit wobbly in the middle. Back in the oven.' }
          : { emoji: '🍳', line: 'Undercooked — good thing we caught it before the real test.' }

  return (
    <div className="card">
      <div className="score-plate">
        <div style={{ fontSize: '2.6rem' }}>{verdict.emoji}</div>
        <div className="score-big">
          {result.score}/{result.total}
        </div>
        <p className="muted">
          {pct}% on {result.versionLabel} — {verdict.line}
        </p>
      </div>

      {result.levelUp && (
        <div className="levelup-banner">
          🎉 <strong>Level up!</strong> You scored 80%+ — you’re now cooking at{' '}
          <strong>
            {LEVEL_EMOJI[result.levelUp]} {result.levelUp}
          </strong>{' '}
          level. Your next materials will be harder to match.
        </div>
      )}

      <h3 style={{ marginTop: 18 }}>Doneness by topic</h3>
      <div className="topic-bars">
        {Object.entries(result.byTopic).map(([topic, { right, total }]) => {
          const p = Math.round((right / total) * 100)
          return (
            <div className="topic-bar-row" key={topic}>
              <span className="name" title={topic}>
                {topic}
              </span>
              <div className="bar-track">
                <div className={`bar-fill ${p < 60 ? 'low' : ''}`} style={{ width: `${p}%` }} />
              </div>
              <span className="small muted">
                {right}/{total}
              </span>
            </div>
          )
        })}
      </div>

      {result.weakTopics.length > 0 ? (
        <div className="refry-banner">
          <h3>🍳 Time to refry!</h3>
          <p className="muted small">
            We’ll re-cook your summaries, flashcards, and next practice test with extra heat on:{' '}
            <strong>{result.weakTopics.join(', ')}</strong>. Your earlier batches stay on the
            shelf — flip back to them anytime.
          </p>
          <div className="step-row">
            <button className="btn" onClick={() => onRefry(result.weakTopics)}>
              Refry my materials 🔥
            </button>
            <button className="btn ghost" onClick={onPlan}>
              Back to the plan
            </button>
          </div>
        </div>
      ) : (
        <div className="refry-banner" style={{ borderColor: 'var(--good)', background: '#f2f8ef' }}>
          <h3>✨ No weak spots detected</h3>
          <p className="muted small">
            Every topic held up under heat.
            {result.levelUp
              ? ' Cook a fresh batch at your new level to keep the burn going.'
              : ' Keep cycling recall to keep it crisp.'}
          </p>
          <div className="step-row">
            {result.levelUp && (
              <button className="btn" onClick={onRecook}>
                Cook {LEVEL_EMOJI[level]} {level}-level materials 🔥
              </button>
            )}
            <button className={`btn ${result.levelUp ? 'ghost' : ''}`} onClick={onPlan}>
              Back to the plan →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
