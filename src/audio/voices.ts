/**
 * Sintetizirani instrumenti — vsak glas se sestavi iz oscilatorjev in šuma
 * šele v trenutku, ko ga potrebujemo, in se sam pospravi (stop() sprosti vozlišča).
 * Nič samplov: cel "drum set" je nekaj kilobajtov kode.
 */

export interface VoiceParams {
  /** vrhunska glasnost, 0..1 (vključuje velocity in level traka) */
  gain: number
  /** polton offset */
  tune: number
  /** množitelj dolžine */
  decay: number
  /** višina tona v Hz — samo melodični glasovi */
  freq?: number
  /** kako dolgo naj ton drži (s) — samo melodični glasovi */
  dur?: number
}

type Voice = (ctx: AudioContext, dest: AudioNode, t: number, p: VoiceParams) => void

const semi = (n: number) => Math.pow(2, n / 12)

let noiseBuffer: AudioBuffer | null = null
let noiseCtx: AudioContext | null = null

/** Bel šum, generiran enkrat na AudioContext in nato le predvajan. */
function noise(ctx: AudioContext): AudioBufferSourceNode {
  if (!noiseBuffer || noiseCtx !== ctx) {
    const len = Math.floor(ctx.sampleRate * 2)
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    noiseCtx = ctx
  }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  return src
}

/** Eksponentni amplitudni ovoj z zelo kratkim attackom (prepreči klik). */
function env(ctx: AudioContext, t: number, peak: number, decay: number, attack = 0.002) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return g
}

const kick: Voice = (ctx, dest, t, p) => {
  const base = 48 * semi(p.tune)
  const d = 0.42 * p.decay

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base * 5, t)
  osc.frequency.exponentialRampToValueAtTime(base, t + 0.06 * p.decay)

  const g = env(ctx, t, p.gain, d, 0.003)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + d + 0.05)

  // klik na začetku — da se sliši tudi na telefonskem zvočniku
  const click = noise(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1200
  const cg = env(ctx, t, p.gain * 0.35, 0.012, 0.001)
  click.connect(hp).connect(cg).connect(dest)
  click.start(t)
  click.stop(t + 0.05)
}

function buildSnare(bandHz: number, bodyHz: number): Voice {
  return (ctx, dest, t, p) => {
    const d = 0.18 * p.decay

    const n = noise(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = bandHz * semi(p.tune)
    bp.Q.value = 0.8
    const ng = env(ctx, t, p.gain * 0.9, d, 0.001)
    n.connect(bp).connect(ng).connect(dest)
    n.start(t)
    n.stop(t + d + 0.05)

    const body = ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(bodyHz * semi(p.tune), t)
    body.frequency.exponentialRampToValueAtTime(bodyHz * 0.7 * semi(p.tune), t + d)
    const bg = env(ctx, t, p.gain * 0.5, d * 0.7, 0.002)
    body.connect(bg).connect(dest)
    body.start(t)
    body.stop(t + d + 0.05)
  }
}

function buildHat(decaySec: number): Voice {
  return (ctx, dest, t, p) => {
    const d = decaySec * p.decay
    const n = noise(ctx)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000 * semi(p.tune)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 10000 * semi(p.tune)
    bp.Q.value = 0.6
    const g = env(ctx, t, p.gain * 0.6, d, 0.001)
    n.connect(hp).connect(bp).connect(g).connect(dest)
    n.start(t)
    n.stop(t + d + 0.05)
  }
}

const clap: Voice = (ctx, dest, t, p) => {
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1100 * semi(p.tune)
  bp.Q.value = 1.4
  bp.connect(dest)

  // tri kratke ploskice + rep — klasičen 909 trik
  for (const [offset, amp] of [[0, 0.7], [0.011, 0.85], [0.023, 1]] as const) {
    const n = noise(ctx)
    const g = env(ctx, t + offset, p.gain * amp, 0.02, 0.001)
    n.connect(g).connect(bp)
    n.start(t + offset)
    n.stop(t + offset + 0.06)
  }
  const tail = noise(ctx)
  const tg = env(ctx, t + 0.03, p.gain * 0.5, 0.16 * p.decay, 0.001)
  tail.connect(tg).connect(bp)
  tail.start(t + 0.03)
  tail.stop(t + 0.03 + 0.2 * p.decay + 0.05)
}

const tom: Voice = (ctx, dest, t, p) => {
  const base = 180 * semi(p.tune)
  const d = 0.35 * p.decay
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base * 1.8, t)
  osc.frequency.exponentialRampToValueAtTime(base, t + 0.12 * p.decay)
  const g = env(ctx, t, p.gain, d, 0.003)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + d + 0.05)
}

const rim: Voice = (ctx, dest, t, p) => {
  const d = 0.05 * p.decay
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = 420 * semi(p.tune)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1700 * semi(p.tune)
  bp.Q.value = 3
  const g = env(ctx, t, p.gain * 0.8, d, 0.001)
  osc.connect(bp).connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + d + 0.05)
}

/** Bas: žaga skozi nizkoprepustni filter z ovojem — tune je nota. */
const bass: Voice = (ctx, dest, t, p) => {
  const freq = 55 * semi(p.tune)
  const d = 0.3 * p.decay

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = freq
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = freq / 2

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 6
  lp.frequency.setValueAtTime(Math.min(freq * 14, 4000), t)
  lp.frequency.exponentialRampToValueAtTime(freq * 2, t + d)

  const g = env(ctx, t, p.gain * 0.8, d, 0.004)
  osc.connect(lp)
  sub.connect(lp)
  lp.connect(g).connect(dest)
  osc.start(t); sub.start(t)
  osc.stop(t + d + 0.05); sub.stop(t + d + 0.05)
}

/** Kratka melodična pikica — dobra za akcente in "melodijo" v gridu. */
const blip: Voice = (ctx, dest, t, p) => {
  const freq = 440 * semi(p.tune)
  const d = 0.14 * p.decay
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, t)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(freq * 8, t)
  lp.frequency.exponentialRampToValueAtTime(freq * 2, t + d)
  const g = env(ctx, t, p.gain * 0.45, d, 0.003)
  osc.connect(lp).connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + d + 0.05)
}

// --- melodični glasovi ---------------------------------------------------
//
// Ti dobijo `freq` (višino) in `dur` (koliko časa naj ton drži), zato imajo
// ovoj z zadrževanjem: attack → decay → sustain do konca note → release.

interface AdsrOptions {
  attack: number
  decay: number
  sustain: number
  release: number
}

function adsr(ctx: AudioContext, t: number, peak: number, dur: number, o: AdsrOptions) {
  const g = ctx.createGain()
  const hold = Math.max(dur, o.attack + 0.02)
  const sustainLevel = Math.max(peak * o.sustain, 0.0002)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), t + o.attack)
  g.gain.exponentialRampToValueAtTime(sustainLevel, t + o.attack + o.decay)
  g.gain.setValueAtTime(sustainLevel, t + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + hold + o.release)
  return { node: g, end: t + hold + o.release + 0.05 }
}

/** Rahel vibrato, ki niha frekvenco — brez njega pihala zvenijo mrtvo. */
function vibrato(ctx: AudioContext, t: number, rate: number, cents: number, freq: number, target: AudioParam, end: number) {
  const lfo = ctx.createOscillator()
  lfo.frequency.value = rate
  const depth = ctx.createGain()
  depth.gain.setValueAtTime(0, t)
  depth.gain.linearRampToValueAtTime(freq * (Math.pow(2, cents / 1200) - 1), t + 0.25)
  lfo.connect(depth).connect(target)
  lfo.start(t)
  lfo.stop(end)
}

const PARTIALS: Record<string, [number, number][]> = {
  // [mnogokratnik frekvence, glasnost]
  piano: [[1, 1], [2, 0.32], [3, 0.12], [4, 0.06]],
  organ: [[1, 1], [2, 0.5], [3, 0.28], [4, 0.18], [6, 0.1]],
}

const piano: Voice = (ctx, dest, t, p) => {
  const f = p.freq ?? 440
  const dur = p.dur ?? 0.25
  // klavir ne drži tona v nedogled — zveni kot udarec z dolgim izzvenom
  const { node, end } = adsr(ctx, t, p.gain, Math.min(dur, 0.9 * p.decay), {
    attack: 0.004,
    decay: 0.55 * p.decay,
    sustain: 0.22,
    release: 0.5 * p.decay,
  })

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(Math.min(f * 14, 11000), t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 3, 700), end)
  node.connect(lp).connect(dest)

  for (const [mul, amp] of PARTIALS.piano) {
    const osc = ctx.createOscillator()
    osc.type = mul === 1 ? 'triangle' : 'sine'
    osc.frequency.value = f * mul
    const g = ctx.createGain()
    g.gain.value = amp
    osc.connect(g).connect(node)
    osc.start(t)
    osc.stop(end)
  }
}

const flute: Voice = (ctx, dest, t, p) => {
  const f = p.freq ?? 440
  const dur = p.dur ?? 0.3
  const { node, end } = adsr(ctx, t, p.gain * 0.8, dur, {
    attack: 0.07,
    decay: 0.08,
    sustain: 0.85,
    release: 0.14 * p.decay,
  })
  node.connect(dest)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = f
  const second = ctx.createOscillator()
  second.type = 'sine'
  second.frequency.value = f * 2
  const secondGain = ctx.createGain()
  secondGain.gain.value = 0.12

  vibrato(ctx, t, 5.2, 22, f, osc.frequency, end)
  osc.connect(node)
  second.connect(secondGain).connect(node)

  // dih: tiho šumenje skozi visokoprepustni filter
  const breath = noise(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = Math.max(f * 2, 1800)
  const bg = ctx.createGain()
  bg.gain.value = 0.05
  breath.connect(hp).connect(bg).connect(node)

  osc.start(t); second.start(t); breath.start(t)
  osc.stop(end); second.stop(end); breath.stop(end)
}

const strings: Voice = (ctx, dest, t, p) => {
  const f = p.freq ?? 440
  const dur = p.dur ?? 0.5
  const { node, end } = adsr(ctx, t, p.gain * 0.6, dur, {
    attack: 0.16,
    decay: 0.2,
    sustain: 0.8,
    release: 0.35 * p.decay,
  })

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(Math.min(f * 4, 1600), t)
  lp.frequency.linearRampToValueAtTime(Math.min(f * 7, 3200), t + 0.5)
  node.connect(lp).connect(dest)

  // trije rahlo razglašeni glasovi dajo "zbor" godal
  for (const cents of [-7, 0, 7]) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = f * Math.pow(2, cents / 1200)
    const g = ctx.createGain()
    g.gain.value = 0.34
    osc.connect(g).connect(node)
    osc.start(t)
    osc.stop(end)
  }
}

const pluck: Voice = (ctx, dest, t, p) => {
  const f = p.freq ?? 440
  const dur = Math.min(p.dur ?? 0.2, 0.5) * p.decay
  const { node, end } = adsr(ctx, t, p.gain * 0.7, dur, {
    attack: 0.003,
    decay: 0.25 * p.decay,
    sustain: 0.12,
    release: 0.18,
  })

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 3
  lp.frequency.setValueAtTime(Math.min(f * 10, 8000), t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 400), t + dur + 0.2)
  node.connect(lp).connect(dest)

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = f
  osc.connect(node)
  osc.start(t)
  osc.stop(end)
}

const organ: Voice = (ctx, dest, t, p) => {
  const f = p.freq ?? 440
  const dur = p.dur ?? 0.3
  const { node, end } = adsr(ctx, t, p.gain * 0.5, dur, {
    attack: 0.015,
    decay: 0.05,
    sustain: 0.9,
    release: 0.1 * p.decay,
  })
  node.connect(dest)

  for (const [mul, amp] of PARTIALS.organ) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f * mul
    const g = ctx.createGain()
    g.gain.value = amp * 0.5
    osc.connect(g).connect(node)
    osc.start(t)
    osc.stop(end)
  }
}

export const VOICES: Record<string, Voice> = {
  piano,
  flute,
  strings,
  pluck,
  organ,
  kick,
  snare: buildSnare(1800, 190),
  clap,
  hat: buildHat(0.045),
  openhat: buildHat(0.34),
  tom,
  rim,
  bass,
  blip,
}
