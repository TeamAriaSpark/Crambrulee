import { useEffect, useLayoutEffect, useState } from 'react'

// Lightweight spotlight tour: dims the page, cuts a hole around the target
// element, and walks through the steps. No dependencies.
export default function Tour({ steps, step, onNext, onSkip }) {
  const current = steps[step]
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    const el = document.querySelector(current.selector)
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect({ x: r.x, y: r.y, w: r.width, h: r.height })
    }
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [current.selector])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'Enter' || e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext, onSkip])

  if (!rect) return null

  const pad = 8
  const spotlight = {
    left: rect.x - pad,
    top: rect.y - pad,
    width: rect.w + pad * 2,
    height: rect.h + pad * 2,
  }
  // Tooltip below the target when there's room, otherwise above.
  const below = spotlight.top + spotlight.height + 190 < window.innerHeight
  const tipTop = below ? spotlight.top + spotlight.height + 12 : undefined
  const tipBottom = below ? undefined : window.innerHeight - spotlight.top + 12
  const tipLeft = Math.min(
    Math.max(spotlight.left + spotlight.width / 2, 170),
    window.innerWidth - 170
  )

  return (
    <div className="tour" role="dialog" aria-label="Feature tour">
      <div className="tour-spotlight" style={spotlight} />
      <div
        className="tour-card"
        style={{ left: tipLeft, top: tipTop, bottom: tipBottom }}
      >
        <div className="tour-title">
          {current.emoji} {current.title}
        </div>
        <p className="tour-body">{current.body}</p>
        <div className="tour-controls">
          <span className="tour-dots">
            {steps.map((_, i) => (
              <span key={i} className={`tour-dot ${i === step ? 'on' : ''}`} />
            ))}
          </span>
          <button className="btn ghost small-btn tour-skip" onClick={onSkip}>
            Skip
          </button>
          <button className="btn small-btn" onClick={onNext}>
            {step === steps.length - 1 ? 'Let’s cook 🔥' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
