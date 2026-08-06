/**
 * Mikrofon → loop.
 *
 * Brskalnik privzeto vklopi odpravo odmeva, dušenje šuma in samodejno
 * ojačenje — vse troje je narejeno za govor in glasbo zmaliči, zato jih
 * izklopimo. (iOS jih zna vseeno vsiliti; takrat pomaga snemanje s slušalkami.)
 */
const CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
}

export class MicRecorder {
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private analyser: AnalyserNode | null = null
  private ready = false

  get connected() {
    return this.ready
  }

  /** Vpraša za dovoljenje in postavi verigo. Klicati iz uporabnikove geste. */
  async connect(ctx: AudioContext): Promise<void> {
    if (this.ready) return
    // worklet mora ostati samostojna datoteka (public/), sicer ga Vite zavije v paket
    await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}capture-worklet.js`)
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: CONSTRAINTS })

    const source = ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(ctx, 'capture')
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024

    source.connect(this.analyser)
    source.connect(this.node)

    // vozlišče mora biti v grafu, sicer process() ne teče; glasnost 0, da ne piska
    const mute = ctx.createGain()
    mute.gain.value = 0
    this.node.connect(mute).connect(ctx.destination)

    this.ready = true
  }

  /** Trenutna glasnost vhoda 0..1 — za prikaz črtice med naravnavanjem. */
  level(): number {
    if (!this.analyser) return 0
    const data = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(data)
    let peak = 0
    for (const v of data) peak = Math.max(peak, Math.abs(v))
    return peak
  }

  /**
   * Posname natanko okno [startTime, startTime + duration) po uri AudioContexta.
   * `offsetMs` premakne okno naprej — s tem poravnaš zamik svoje naprave.
   */
  record(ctx: AudioContext, startTime: number, duration: number, offsetMs = 0): Promise<Float32Array<ArrayBuffer>> {
    const node = this.node
    if (!node) return Promise.reject(new Error('mikrofon ni povezan'))

    const rate = ctx.sampleRate
    const startFrame = Math.round((startTime + offsetMs / 1000) * rate)
    const endFrame = startFrame + Math.round(duration * rate)

    return new Promise<Float32Array<ArrayBuffer>>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => {
          node.port.onmessage = null
          reject(new Error('snemanje se ni zaključilo'))
        },
        (startTime - ctx.currentTime + duration) * 1000 + 3000,
      )

      node.port.onmessage = (e: MessageEvent) => {
        if (e.data?.type !== 'done') return
        window.clearTimeout(timeout)
        node.port.onmessage = null
        resolve(e.data.data as Float32Array<ArrayBuffer>)
      }
      node.port.postMessage({ type: 'window', startFrame, endFrame })
    })
  }

  cancel() {
    this.node?.port.postMessage({ type: 'cancel' })
  }

  release() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.node = null
    this.analyser = null
    this.ready = false
  }
}

/** Nekaj deset vrhov za izris valovne oblike v vrstici loopa. */
export function peaksOf(data: Float32Array, buckets = 48): number[] {
  const size = Math.max(1, Math.floor(data.length / buckets))
  const peaks: number[] = []
  for (let i = 0; i < buckets; i++) {
    let peak = 0
    const from = i * size
    for (let j = from; j < Math.min(from + size, data.length); j++) {
      const v = Math.abs(data[j])
      if (v > peak) peak = v
    }
    peaks.push(Math.round(peak * 100) / 100)
  }
  return peaks
}
