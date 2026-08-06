import { useEffect, useRef } from 'react'
import type { Engine } from '../audio/engine'
import { loopPlaysAt } from '../state/song'
import type { Song } from '../types'

/**
 * Premika črte, ki tečejo po mrežah loopov. Ena sama animacijska zanka piše
 * neposredno v DOM — sicer bi se ob vsakem okvirju prerisal cel zaslon.
 */
export function useLoopLines(engine: Engine, song: Song) {
  const lines = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pos = engine.position()
      for (const loop of song.loops) {
        const el = lines.current.get(loop.id)
        if (!el) continue
        const on = pos >= 0 && loopPlaysAt(song, loop, Math.floor(pos))
        el.style.opacity = on ? '1' : '0'
        if (on) el.style.left = `${((pos % loop.length) / loop.length) * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [engine, song])

  return (id: string, el: HTMLElement | null) => {
    if (el) lines.current.set(id, el)
    else lines.current.delete(id)
  }
}
