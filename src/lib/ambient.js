// Tiny ambient-sound engine. Everything is synthesized with the Web Audio
// API — no audio files, so it works offline and inside the strict artifact
// sandbox where external requests are blocked.

let ctx = null
let master = null
let nodes = []
let chordTimer = null
let current = 'off'

const ensureCtx = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

const noiseBuffer = (color) => {
  const len = ctx.sampleRate * 4
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    if (color === 'brown') {
      last = (last + 0.02 * white) / 1.02
      d[i] = last * 3.5
    } else {
      d[i] = white
    }
  }
  return buf
}

const noiseSource = (color) => {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(color)
  src.loop = true
  return src
}

// A slow, warm chord loop for the lo-fi pad: Am → F → G → Em.
const LOFI_CHORDS = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66],
  [164.81, 196.0, 246.94],
]

export function setAmbient(type) {
  if (type === current) return
  current = type

  if (chordTimer) {
    clearInterval(chordTimer)
    chordTimer = null
  }
  nodes.forEach((n) => {
    try { n.stop?.() } catch { /* already stopped */ }
    try { n.disconnect() } catch { /* already gone */ }
  })
  nodes = []

  if (type === 'off') {
    if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
    return
  }

  ensureCtx()
  const out = ctx.createGain()
  out.connect(master)
  nodes.push(out)

  if (type === 'rain') {
    const src = noiseSource('white')
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 500
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6000
    src.connect(hp).connect(lp).connect(out)
    out.gain.value = 0.45
    src.start()
    nodes.push(src, hp, lp)
  } else if (type === 'waves') {
    const src = noiseSource('brown')
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    const swell = ctx.createGain()
    swell.gain.value = 0.55
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const depth = ctx.createGain()
    depth.gain.value = 0.4
    lfo.connect(depth).connect(swell.gain)
    src.connect(lp).connect(swell).connect(out)
    out.gain.value = 1
    src.start()
    lfo.start()
    nodes.push(src, lp, swell, lfo, depth)
  } else if (type === 'focus') {
    const src = noiseSource('brown')
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    src.connect(lp).connect(out)
    out.gain.value = 0.8
    src.start()
    nodes.push(src, lp)
  } else if (type === 'lofi') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 850
    lp.connect(out)
    out.gain.value = 1
    nodes.push(lp)
    // A whisper of vinyl crackle under the pad.
    const vinyl = noiseSource('white')
    const vinylGain = ctx.createGain()
    vinylGain.gain.value = 0.012
    vinyl.connect(vinylGain).connect(out)
    vinyl.start()
    nodes.push(vinyl, vinylGain)

    let step = 0
    const playChord = () => {
      const now = ctx.currentTime
      const freqs = LOFI_CHORDS[step % LOFI_CHORDS.length]
      step++
      freqs.forEach((f) => {
        ;[-4, 4].forEach((cents) => {
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = f
          osc.detune.value = cents
          const env = ctx.createGain()
          env.gain.setValueAtTime(0, now)
          env.gain.linearRampToValueAtTime(0.05, now + 1.6)
          env.gain.linearRampToValueAtTime(0.0001, now + 7.8)
          osc.connect(env).connect(lp)
          osc.start(now)
          osc.stop(now + 8)
        })
      })
    }
    playChord()
    chordTimer = setInterval(playChord, 8000)
  }

  master.gain.setTargetAtTime(0.22, ctx.currentTime, 0.3)
}
