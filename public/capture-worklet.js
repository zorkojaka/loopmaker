/**
 * Zajem mikrofona z natančnostjo vzorca.
 *
 * Glavna nit pove le okno v vzorcih (`startFrame`–`endFrame`), procesor pa iz
 * vhodnih blokov izreže točno ta del. Ker `currentFrame` teče po isti uri kot
 * `AudioContext.currentTime`, je posnetek natanko toliko dolg, kolikor traja
 * loop — brez plavanja, ki bi ga prinesel MediaRecorder.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.startFrame = -1
    this.endFrame = -1
    this.chunks = []
    this.port.onmessage = (e) => {
      if (e.data.type === 'window') {
        this.startFrame = e.data.startFrame
        this.endFrame = e.data.endFrame
        this.chunks = []
      } else if (e.data.type === 'cancel') {
        this.startFrame = -1
        this.chunks = []
      }
    }
  }

  flush() {
    if (this.startFrame < 0) return
    let total = 0
    for (const c of this.chunks) total += c.length
    const out = new Float32Array(total)
    let offset = 0
    for (const c of this.chunks) {
      out.set(c, offset)
      offset += c.length
    }
    this.startFrame = -1
    this.chunks = []
    this.port.postMessage({ type: 'done', data: out }, [out.buffer])
  }

  process(inputs) {
    if (this.startFrame < 0) return true
    const channel = inputs[0]?.[0]
    if (!channel) return true

    const blockStart = currentFrame
    const blockEnd = blockStart + channel.length

    if (blockEnd <= this.startFrame) return true
    if (blockStart >= this.endFrame) {
      this.flush()
      return true
    }

    const from = Math.max(0, this.startFrame - blockStart)
    const to = Math.min(channel.length, this.endFrame - blockStart)
    this.chunks.push(channel.slice(from, to))
    if (blockEnd >= this.endFrame) this.flush()
    return true
  }
}

registerProcessor('capture', CaptureProcessor)
