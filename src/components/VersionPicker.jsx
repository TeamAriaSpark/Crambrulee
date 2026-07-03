export default function VersionPicker({ versions, activeVersion, onPick }) {
  if (versions.length <= 1) return null
  return (
    <div className="version-row">
      <span className="muted small">Batches:</span>
      {versions.map((v, i) => (
        <button
          key={v.id}
          className={`version-chip ${i === activeVersion ? 'active' : ''}`}
          onClick={() => onPick(i)}
          title={
            v.focusTopics.length
              ? `Refried to focus on: ${v.focusTopics.join(', ')}`
              : 'The first batch, straight from your notes'
          }
        >
          {v.version === 1 ? '🍮' : '🍳'} {v.label}
        </button>
      ))}
    </div>
  )
}
