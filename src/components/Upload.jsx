import { useRef, useState } from 'react'
import { getApiKey, setApiKey } from '../lib/ai.js'
import { extractPdfText } from '../lib/pdf.js'

const SAMPLE = `Photosynthesis
Photosynthesis is the process plants use to convert light energy into chemical energy stored in glucose. It takes place in the chloroplasts, which contain the green pigment chlorophyll.

The light-dependent reactions occur in the thylakoid membranes. Water is split to release oxygen, and the energy carriers ATP and NADPH are produced.

The Calvin cycle
The Calvin cycle is the light-independent stage that occurs in the stroma. Carbon dioxide is fixed into organic molecules using the ATP and NADPH from the light reactions. The enzyme rubisco catalyzes the first major step of carbon fixation.

Cellular respiration
Cellular respiration is the process cells use to break down glucose and release energy as ATP. Glycolysis occurs in the cytoplasm and splits glucose into two pyruvate molecules. The Krebs cycle takes place in the mitochondrial matrix and generates electron carriers. The electron transport chain produces most of the ATP through oxidative phosphorylation.`

export default function Upload({ onDone }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState(null)
  const [over, setOver] = useState(false)
  const [keyInput, setKeyInput] = useState(getApiKey())
  const [keySaved, setKeySaved] = useState(Boolean(getApiKey()))
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const inputRef = useRef()

  const saveKey = () => {
    setApiKey(keyInput)
    setKeySaved(Boolean(keyInput.trim()))
  }

  const readFiles = async (files) => {
    setFileError(null)
    setReading(true)
    const texts = []
    const names = []
    const problems = []
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        problems.push(`“${file.name}” is over 25 MB — too big for the pot.`)
        continue
      }
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
      try {
        texts.push(isPdf ? await extractPdfText(file) : await file.text())
        names.push(file.name)
      } catch (err) {
        problems.push(err?.message || `Couldn’t read “${file.name}”.`)
      }
    }
    setReading(false)
    if (problems.length) setFileError(problems.join(' '))
    if (texts.length) {
      setFileName(names.join(', '))
      setText((t) => (t ? t + '\n\n' : '') + texts.join('\n\n'))
    }
  }

  const ready = text.trim().length >= 120

  return (
    <div className="card hero">
      <span className="flan-big">🍮</span>
      <h2>Test coming up? Let’s get cooking.</h2>
      <p className="muted sauce">
        Drop in your notes and we’ll cook up a <strong>cram plan</strong> sized to the hours you
        have left.
      </p>

      <div className="science-callout">
        <span className="eyebrow">🔬 The science · our special sauce</span>
        <p>
          <strong>Rereading your notes feels productive — that’s the trap.</strong> Most students
          get a false sense of security from rereading. Studies show <strong>active recall</strong> —
          pulling answers <em>out</em> of your brain instead of pouring them back in — is the most
          effective way to study. The winning mix, backed by a century of research: about{' '}
          <strong>30% reading, 70% recall &amp; practice tests</strong> — and cram brûlée blends
          every plan to that ratio, so you learn fast.
        </p>
      </div>

      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          readFiles([...e.dataTransfer.files])
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.text,.csv,.pdf,application/pdf"
          multiple
          onChange={(e) => readFiles([...e.target.files])}
        />
        <strong>📚 Toss in your ingredients</strong>
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          Drag &amp; drop your notes (.pdf, .txt, or .md), or click to browse
        </p>
        {reading && <div className="file-chip">⏳ Reading your file…</div>}
        {!reading && fileName && <div className="file-chip">📄 {fileName}</div>}
        {fileError && <p className="cook-note">⚠️ {fileError}</p>}
      </div>

      <textarea
        className="paste"
        placeholder="…or paste your study notes right here. The more you give us, the richer the custard."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="step-row" style={{ justifyContent: 'center' }}>
        <button
          className="btn"
          disabled={!ready}
          onClick={() => onDone({ name: fileName || 'Pasted notes', text: text.trim() })}
        >
          Next: how much time do we have? →
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setText(SAMPLE)
            setFileName(null)
          }}
        >
          Try sample notes 🌱
        </button>
      </div>
      {!ready && text.length > 0 && (
        <p className="muted small" style={{ marginTop: 10 }}>
          Add a little more material — we need at least a few sentences to cook with.
        </p>
      )}

      <details className="key-box">
        <summary>
          🔑 The secret ingredient: your Anthropic API key{' '}
          {keySaved ? <span className="pill">added ✓</span> : <span className="muted small">(optional)</span>}
        </summary>
        <p className="muted small">
          With a key, <strong>Claude cooks your materials for real</strong> — smarter summaries,
          sharper flashcards, exam-grade practice questions. Without one, our built-in house
          engine does the cooking. The key is stored only in this browser and your notes go
          straight from your browser to Anthropic — never through us.
        </p>
        <div className="key-row">
          <input
            type="password"
            placeholder="sk-ant-…"
            value={keyInput}
            autoComplete="off"
            onChange={(e) => setKeyInput(e.target.value)}
            onBlur={saveKey}
          />
          <button className="btn ghost small-btn" onClick={saveKey}>
            {keySaved ? 'Update' : 'Save'}
          </button>
          {keySaved && (
            <button
              className="btn ghost small-btn"
              onClick={() => {
                setApiKey('')
                setKeyInput('')
                setKeySaved(false)
              }}
            >
              Remove
            </button>
          )}
        </div>
      </details>
    </div>
  )
}
