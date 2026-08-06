import { midiToFreq } from './instruments'
import { barsOf, patternById, songLengthBars } from '../state/song'
import type { Pattern, Song, Vel } from '../types'
import { STEPS_PER_BAR } from '../types'
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
 * Isti scheduler poganja oba načina — razlika je le, kateri korak razrešimo v
 * zvok: v načinu 'pattern' korak trenutnega vzorca, v 'song' pa globalni korak
 * časovnice, pri katerem pogledamo, kateri bloki tečejo ravno zdaj.
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

  /** Zaigraj en glas takoj — predposlušanje ob izbiri instrumenta. */
  async preview(pattern: Pattern, trackIndex: number) {
    await this.unlock()
    if (!this.ctx) return
    this.playTrack(pattern, trackIndex, 3, this.ctx.currentTime + 0.01, 1)
  }

  /**
   * Pozicija playheada v korakih, z decimalko vmes (za gladko drsenje traku).
   * -1 pomeni, da ne igramo.
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

  private playTrack(pattern: Pattern, index: number, v: Vel, time: number, decayScale = 1) {
    const track = pattern.tracks[index]
    if (!track || !this.master || !this.ctx) return
    const voice = VOICES[track.voice]
    if (!voice) return
    voice(this.ctx, this.master, time, {
      gain: track.level * GAIN_BY_VEL[v],
      tune: track.tune,
      decay: track.decay * decayScale,
    })
  }

  /** Zaigraj eno noto melodičnega glasu — uporablja piano roll za predposluh. */
  async previewNote(voice: string, midi: number, level = 0.7, dur = 0.4) {
    await this.unlock()
    if (!this.ctx || !this.master) return
    const play = VOICES[voice]
    play?.(this.ctx, this.master, this.ctx.currentTime + 0.01, {
      gain: level * GAIN_BY_VEL[2],
      tune: 0,
      decay: 1,
      freq: midiToFreq(midi),
      dur,
    })
  }

  /** Razreši en korak vzorca v zvok (upošteva mute/solo in roll). */
  private schedulePattern(pattern: Pattern, localStep: number, time: number) {
    const anySolo = pattern.tracks.some((t) => t.soloed) || pattern.melodies.some((m) => m.soloed)

    for (const melody of pattern.melodies) {
      if (melody.muted || (anySolo && !melody.soloed)) continue
      const voice = VOICES[melody.voice]
      if (!voice || !this.ctx || !this.master) continue
      for (const n of melody.notes) {
        if (n.step !== localStep || !n.v) continue
        voice(this.ctx, this.master, time, {
          gain: melody.level * GAIN_BY_VEL[n.v],
          tune: 0,
          decay: melody.decay,
          freq: midiToFreq(n.midi),
          dur: n.len * this.secPerStep,
        })
      }
    }

    for (let i = 0; i < pattern.tracks.length; i++) {
      const track = pattern.tracks[i]
      if (track.muted || (anySolo && !track.soloed)) continue
      const step = track.steps[localStep]
      if (!step || !step.v) continue

      const roll = Math.max(1, step.roll ?? 1)
      if (roll === 1) {
        this.playTrack(pattern, i, step.v, time)
      } else {
        // roll: udarci enakomerno znotraj koraka, krajši in nekoliko tišji
        const gap = this.secPerStep / roll
        for (let r = 0; r < roll; r++) {
          const v = (r === 0 ? step.v : Math.max(1, step.v - 1)) as Vel
          this.playTrack(pattern, i, v, time + r * gap, 1 / roll + 0.15)
        }
      }
    }
  }

  private tick = () => {
    if (!this.ctx || !this.playing) return
    const song = this.getSong()
    this.secPerStep = 60 / song.bpm / 4

    const patternMode = song.mode === 'pattern'
    const current = patternById(song, song.currentPattern) ?? song.patterns[0]
    const totalSteps = patternMode ? current.length : songLengthBars(song) * STEPS_PER_BAR

    while (this.nextStepTime < this.ctx.currentTime + LOOKAHEAD) {
      const step = this.step % totalSteps
      // swing zamakne lihe 16-tinke proti naslednji dobi
      const time = step % 2 === 1 ? this.nextStepTime + this.secPerStep * song.swing : this.nextStepTime

      if (patternMode) {
        this.schedulePattern(current, step, time)
      } else {
        const bar = Math.floor(step / STEPS_PER_BAR)
        for (const clip of song.clips) {
          const pattern = patternById(song, clip.patternId)
          if (!pattern) continue
          if (bar < clip.bar || bar >= clip.bar + barsOf(pattern)) continue
          const local = (step - clip.bar * STEPS_PER_BAR) % pattern.length
          this.schedulePattern(pattern, local, time)
        }
      }

      this.queue.push({ step, time })
      this.step = (step + 1) % totalSteps
      this.nextStepTime += this.secPerStep
    }
  }
}
