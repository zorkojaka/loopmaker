import { useEffect, useRef, useState } from 'react'
import type { Engine } from '../audio/engine'

/**
 * Gladko drsenje traku playheada.
 *
 * Črto premikamo neposredno prek DOM-a (60×/s), v React state gre samo cel
 * korak — sicer bi se ob vsakem okvirju prerisala cela mreža.
 */
export function usePlayhead(engine: Engine, totalSteps: number) {
  const lineRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [step, setStep] = useState(-1)

  useEffect(() => {
    let raf = 0
    let last = -1

    const loop = () => {
      const p = engine.position()
      const line = lineRef.current
      if (line) {
        line.style.opacity = p < 0 ? '0' : '1'
        if (p >= 0) line.style.left = `${(p / totalSteps) * 100}%`
      }

      const s = p < 0 ? -1 : Math.floor(p) % totalSteps
      if (s !== last) {
        last = s
        setStep(s)
        // časovnica sledi playheadu, kadar je daljša od zaslona
        const sc = scrollRef.current
        if (sc && p >= 0 && sc.scrollWidth > sc.clientWidth) {
          const x = (p / totalSteps) * sc.scrollWidth
          if (x < sc.scrollLeft + 24 || x > sc.scrollLeft + sc.clientWidth - 48) {
            sc.scrollLeft = Math.max(0, x - sc.clientWidth / 3)
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, totalSteps])

  return { lineRef, scrollRef, step }
}
