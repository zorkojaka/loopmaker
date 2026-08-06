import { useRef } from 'react'
import type { Pattern, Velocity } from '../types'
import { instrumentOf } from '../audio/instruments'

interface Props {
  pattern: Pattern
  playStep: number
  selected: number
  onSelect: (track: number) => void
  onCell: (track: number, step: number, v: Velocity) => void
  onToggleMute: (track: number) => void
}

interface Hit {
  track: number
  step: number
}

/** Kateri celici pripada zaslonska točka — potrebujemo pri risanju s prstom. */
function cellAt(x: number, y: number): Hit | null {
  const el = document.elementFromPoint(x, y)
  const cell = (el as HTMLElement | null)?.closest<HTMLElement>('[data-cell]')
  if (!cell) return null
  return { track: Number(cell.dataset.track), step: Number(cell.dataset.step) }
}

export function Grid({ pattern, playStep, selected, onSelect, onCell, onToggleMute }: Props) {
  /** vrednost, ki jo trenutno "barvamo" med vlečenjem; null = ne vlečemo */
  const paint = useRef<Velocity | null>(null)

  const handleDown = (e: React.PointerEvent) => {
    const hit = cellAt(e.clientX, e.clientY)
    if (!hit) return
    const current = pattern.tracks[hit.track].steps[hit.step]
    const next = ((current + 1) % 3) as Velocity
    paint.current = next
    onSelect(hit.track)
    onCell(hit.track, hit.step, next)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handleMove = (e: React.PointerEvent) => {
    if (paint.current === null) return
    const hit = cellAt(e.clientX, e.clientY)
    if (hit) onCell(hit.track, hit.step, paint.current)
  }

  const endPaint = () => {
    paint.current = null
  }

  return (
    <div className="grid" onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={endPaint} onPointerCancel={endPaint}>
      {pattern.tracks.map((track, ti) => {
        const def = instrumentOf(track.voice)
        return (
          <div className={`row${ti === selected ? ' row--selected' : ''}`} key={track.voice} style={{ '--track': def.color } as React.CSSProperties}>
            <button
              className={`label${track.muted ? ' label--muted' : ''}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(ti)}
              onDoubleClick={() => onToggleMute(ti)}
            >
              <span className="label__dot" />
              {track.name}
            </button>
            <div className="steps">
              {track.steps.map((v, si) => (
                <div
                  key={si}
                  data-cell
                  data-track={ti}
                  data-step={si}
                  className={
                    'cell' +
                    (v === 1 ? ' cell--on' : v === 2 ? ' cell--accent' : '') +
                    (si === playStep ? ' cell--play' : '') +
                    (si % 4 === 0 ? ' cell--beat' : '')
                  }
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
