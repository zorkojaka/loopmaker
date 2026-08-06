import type { Song } from '../types'
import { VOICES } from './voices'

/** Kako pogosto teče scheduler (ms) in kako daleč naprej razporeja (s). */
const TICK_MS = 25
const LOOKAHEAD = 0.12

/**
 * Transport + zvočni izhod.
 *
 * Ključna ideja: setTimeout je preveč nenatančen za glasbo, zato ga uporabimo
 * samo kot "budilko", ki vsakih 25 ms pogleda naprej in vse dogodke v naslednjih
 * 120 ms razporedi na točne trenutke ure AudioContexta. Ta ura je vzorčno
 * natančna, zato ritem ne plava, tudi če brskalnik zajeclja.
 */
export class Engine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private nextStepTime = 0
  private step = 0
  /** vrsta razporejenih korakov, iz katere UI bere trenutni playhead */
  private queue: { step: number; time: number }[] = []

  playing = false

  private getSong: () => Song

  constructor(getSong: () => Song) {
    this.getSong = getSong
  }

  /** Ustvari (ali prebudi) AudioContext — klicati SAMO iz uporabnikove geste. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

    // iOS potrebuje en dejansko predvajan buffer, preden spusti zvok skozi
    const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    const s = this.ctx.createBufferSource()
    s.buffer = b
    s.connect(this.ctx.destination)
    s.start(0)
  }

  setMaster(v: number) {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
    }
  }

  async start() {
    await this.unlock()
    if (this.playing || !this.ctx) return
    this.playing = true
    this.step = 0
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
  }

  async toggle() {
    if (this.playing) this.stop()
    else await this.start()
  }

  /** Zaigraj en glas takoj — za predposlušanje ob urejanju. */
  async preview(trackIndex: number) {
    await this.unlock()
    if (!this.ctx) return
    this.playVoice(trackIndex, 2, this.ctx.currentTime + 0.01)
  }

  /** Korak, ki se sliši zdaj (-1 če ne igra) — UI ga bere v requestAnimationFrame. */
  visualStep(): number {
    if (!this.playing || !this.ctx) return -1
    const now = this.ctx.currentTime
    while (this.queue.length && this.queue[0].time <= now) {
      this.lastStep = this.queue[0].step
      this.queue.shift()
    }
    return this.lastStep
  }
  private lastStep = -1

  private playVoice(trackIndex: number, velocity: number, time: number) {
    const song = this.getSong()
    const track = song.patterns[song.current].tracks[trackIndex]
    if (!track || !this.master || !this.ctx) return
    const voice = VOICES[track.voice]
    if (!voice) return
    voice(this.ctx, this.master, time, {
      gain: track.level * (velocity === 2 ? 1 : 0.62),
      tune: track.tune,
      decay: track.decay,
    })
  }

  private tick = () => {
    if (!this.ctx || !this.playing) return
    const song = this.getSong()
    const secPerStep = 60 / song.bpm / 4

    while (this.nextStepTime < this.ctx.currentTime + LOOKAHEAD) {
      const step = this.step
      // swing zamakne lihe 16-tinke proti naslednji dobi
      const time = step % 2 === 1 ? this.nextStepTime + secPerStep * song.swing : this.nextStepTime

      const tracks = song.patterns[song.current].tracks
      const anySolo = tracks.some((t) => t.soloed)
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i]
        if (t.muted || (anySolo && !t.soloed)) continue
        const v = t.steps[step]
        if (v) this.playVoice(i, v, time)
      }

      this.queue.push({ step, time })
      this.step = (step + 1) % song.steps
      this.nextStepTime += secPerStep
    }
  }
}
