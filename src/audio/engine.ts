import type { StoredSample } from '../state/samples'
import { loopPlaysAt } from '../state/song'
import type { Loop, Song, Vel } from '../types'
import { STEPS_PER_BAR } from '../types'
import { midiToFreq } from './instruments'
import { VOICES } from './voices'

/** Kako pogosto se zbudi scheduler (ms) in kako daleč naprej razporeja (s). */
const TICK_MS = 25
const LOOKAHEAD = 0.12

const GAIN_BY_VEL: Record<Vel, number> = { 0: 0, 1: 0.3, 2: 0.62, 3: 1 }

/**
 * Transport + zvočni izhod.
 *
 * setTimeout je za glasbo preveč nenatančen, zato služi le kot budilka: vsakih
 * 25 ms pogleda 120 ms naprej in vse dogodke pripne na vzorčno natančno uro
 * AudioContexta. Ritem zato ne plava, tudi če brskalnik za hip zajeclja.
 *
 * Ura teče neprekinjeno naprej, vsak loop pa se nanjo pripne po svoji dolžini
 * (`globalStep % loop.length`). Zato loopi različnih dolžin ostanejo v fazi,
 * prižiganje in ugašanje med igranjem pa nikoli ne premakne ritma.
 */
export class Engine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private nextStepTime = 0
  private step = 0
  private secPerStep = 0.15
  /** razporejeni koraki, iz katerih UI bere pozicijo playheada */
  private queue: { step: number; time: number }[] = []
  private lastStep = -1
  private lastStepTime = 0
  /** surovi posnetki po id-ju loopa in iz njih ustvarjeni bufferji */
  private samples = new Map<string, StoredSample>()
  private buffers = new Map<string, AudioBuffer>()

  playing = false

  private getSong: () => Song

  constructor(getSong: () => Song) {
    this.getSong = getSong
  }

  /** Ustvari (ali prebudi) AudioContext — klicati SAMO iz uporabnikove geste. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor({ latencyHint: 'interactive' })

      this.master = this.ctx.createGain()
      this.master.gain.value = this.getSong().master
      // blaga limita, da se sešteti glasovi ne zaklipajo
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -6
      comp.knee.value = 6
      comp.ratio.value = 6
      comp.attack.value = 0.003
      comp.release.value = 0.12
      this.master.connect(comp).connect(this.ctx.destination)
    }
    if (this.ctx.state !== 'running') await this.ctx.resume()

    // iOS spusti zvok skozi šele, ko je enkrat dejansko kaj predvajal
    const src = this.ctx.createBufferSource()
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    src.connect(this.ctx.destination)
    src.start(0)
  }

  /** Vstavi posnetek (iz IndexedDB ali sveže z mikrofona). */
  setSample(id: string, sample: StoredSample) {
    this.samples.set(id, sample)
    this.buffers.delete(id)
  }

  dropSample(id: string) {
    this.samples.delete(id)
    this.buffers.delete(id)
  }

  hasSample(id: string) {
    return this.samples.has(id)
  }

  /** AudioBuffer nastane šele, ko obstaja kontekst — zato lena izdelava. */
  private bufferFor(id: string): AudioBuffer | null {
    const cached = this.buffers.get(id)
    if (cached) return cached
    const sample = this.samples.get(id)
    if (!sample || !this.ctx) return null
    const buffer = this.ctx.createBuffer(1, sample.data.length, sample.sampleRate)
    buffer.copyToChannel(sample.data, 0)
    this.buffers.set(id, buffer)
    return buffer
  }

  /** AudioContext, kadar že obstaja — snemalnik ga potrebuje za uro. */
  get context(): AudioContext | null {
    return this.ctx
  }

  setMaster(v: number) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
  }

  async start() {
    await this.unlock()
    if (this.playing || !this.ctx) return
    this.playing = true
    this.step = 0
    this.lastStep = -1
    this.queue = []
    this.nextStepTime = this.ctx.currentTime + 0.06
    this.timer = window.setInterval(this.tick, TICK_MS)
    this.tick()
  }

  stop() {
    this.playing = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.queue = []
    this.lastStep = -1
  }

  async toggle() {
    if (this.playing) this.stop()
    else await this.start()
  }

  /** Skoči na dani korak (klik po traku playheada). */
  seek(step: number) {
    this.step = Math.max(0, Math.floor(step))
    if (this.playing && this.ctx) {
      this.queue = []
      this.nextStepTime = this.ctx.currentTime + 0.03
    } else {
      this.lastStep = this.step
    }
  }

  /** Zaigraj loop enkrat takoj — predposlušanje in tapkanje v živo. */
  async preview(loop: Loop, v: Vel = 3) {
    await this.unlock()
    if (!this.ctx) return
    if (loop.kind === 'melody') {
      const first = loop.notes[0]
      await this.previewNote(loop.voice, (first?.midi ?? 60) + loop.tune, loop.level)
    } else {
      this.playDrum(loop, v, this.ctx.currentTime + 0.01)
    }
  }

  /** Zaigraj eno noto melodičnega glasu — uporablja klaviatura. */
  async previewNote(voice: string, midi: number, level = 0.7, dur = 0.4) {
    await this.unlock()
    if (!this.ctx || !this.master) return
    VOICES[voice]?.(this.ctx, this.master, this.ctx.currentTime + 0.01, {
      gain: level * GAIN_BY_VEL[2],
      tune: 0,
      decay: 1,
      freq: midiToFreq(midi),
      dur,
    })
  }

  /**
   * Pozicija v korakih od začetka predvajanja, z decimalko vmes (za gladko
   * drsenje traku). -1 pomeni, da ne igramo.
   */
  position(): number {
    if (!this.playing || !this.ctx) return -1
    const now = this.ctx.currentTime
    while (this.queue.length && this.queue[0].time <= now) {
      this.lastStep = this.queue[0].step
      this.lastStepTime = this.queue[0].time
      this.queue.shift()
    }
    if (this.lastStep < 0) return -1
    const frac = Math.min(1, Math.max(0, (now - this.lastStepTime) / this.secPerStep))
    return this.lastStep + frac
  }

  /** Kdaj (po uri konteksta) bo dani globalni korak zaigral. */
  timeOfStep(step: number): number | null {
    if (!this.playing || this.lastStep < 0) return null
    return this.lastStepTime + (step - this.lastStep) * this.secPerStep
  }

  /** Zadnji korak, ki se je slišal — izhodišče za štetje taktov naprej. */
  get currentStep(): number {
    return this.lastStep
  }

  get stepDuration(): number {
    return this.secPerStep
  }

  private playDrum(loop: Loop, v: Vel, time: number, decayScale = 1) {
    if (!this.master || !this.ctx) return
    VOICES[loop.voice]?.(this.ctx, this.master, time, {
      gain: loop.level * GAIN_BY_VEL[v],
      tune: loop.tune,
      decay: loop.decay * decayScale,
    })
  }

  /** Razreši en korak enega loopa v zvok. */
  private scheduleLoop(loop: Loop, localStep: number, time: number) {
    if (!this.ctx || !this.master) return

    if (loop.kind === 'sample') {
      // posnetek se sproži na začetku svojega cikla in se konča, preden se ponovi
      if (localStep !== 0) return
      const buffer = this.bufferFor(loop.id)
      if (!buffer) return
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      // ob spremembi tempa posnetek raztegnemo, da ostane v ritmu
      src.playbackRate.value = loop.recordedBpm ? this.getSong().bpm / loop.recordedBpm : 1
      const gain = this.ctx.createGain()
      gain.gain.value = loop.level
      src.connect(gain).connect(this.master)
      src.start(time)
      src.stop(time + loop.length * this.secPerStep)
      return
    }

    if (loop.kind === 'melody') {
      const voice = VOICES[loop.voice]
      if (!voice) return
      for (const n of loop.notes) {
        if (n.step !== localStep || !n.v) continue
        voice(this.ctx, this.master, time, {
          gain: loop.level * GAIN_BY_VEL[n.v],
          tune: 0,
          decay: loop.decay,
          freq: midiToFreq(n.midi + loop.tune),
          dur: n.len * this.secPerStep,
        })
      }
      return
    }

    const step = loop.steps[localStep]
    if (!step || !step.v) return
    const roll = Math.max(1, step.roll ?? 1)
    if (roll === 1) {
      this.playDrum(loop, step.v, time)
    } else {
      // roll: udarci enakomerno znotraj koraka, krajši in nekoliko tišji
      const gap = this.secPerStep / roll
      for (let r = 0; r < roll; r++) {
        const v = (r === 0 ? step.v : Math.max(1, step.v - 1)) as Vel
        this.playDrum(loop, v, time + r * gap, 1 / roll + 0.15)
      }
    }
  }

  private tick = () => {
    if (!this.ctx || !this.playing) return
    const song = this.getSong()
    this.secPerStep = 60 / song.bpm / 4

    while (this.nextStepTime < this.ctx.currentTime + LOOKAHEAD) {
      const step = this.step
      // swing zamakne lihe 16-tinke proti naslednji dobi
      const time = step % 2 === 1 ? this.nextStepTime + this.secPerStep * song.swing : this.nextStepTime

      for (const loop of song.loops) {
        if (!loopPlaysAt(song, loop, step)) continue
        this.scheduleLoop(loop, step % loop.length, time)
      }

      // metronom: klik na vsako dobo, višji na prvo dobo takta
      if (song.metronome && step % 4 === 0 && this.master) {
        VOICES.click(this.ctx, this.master, time, { gain: 0.6, tune: step % STEPS_PER_BAR === 0 ? 7 : 0, decay: 1 })
      }

      this.queue.push({ step, time })
      this.step = step + 1
      this.nextStepTime += this.secPerStep
    }
  }
}
