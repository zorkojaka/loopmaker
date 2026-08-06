import type { Loop, Song, Vel } from '../types'
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

  /** Zaigraj loop enkrat takoj — predposlušanje ob izbiri. */
  async preview(loop: Loop) {
    await this.unlock()
    if (!this.ctx) return
    if (loop.kind === 'melody') {
      const first = loop.notes[0]
      await this.previewNote(loop.voice, (first?.midi ?? 60) + loop.tune, loop.level)
    } else {
      this.playDrum(loop, 3, this.ctx.currentTime + 0.01)
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
        if (!loop.active) continue
        this.scheduleLoop(loop, step % loop.length, time)
      }

      this.queue.push({ step, time })
      this.step = step + 1
      this.nextStepTime += this.secPerStep
    }
  }
}
