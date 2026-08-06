import { useRef } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { instrumentOf } from '../audio/instruments'
import { usePlayhead } from '../hooks/usePlayhead'
import type { Action } from '../state/song'
import type { Pattern, Vel } from '../types'
import { longPress } from '../hooks/longPress'
import type { MenuItem } from './ContextMenu'

interface Props {
  pattern: Pattern
  engine: Engine
  dispatch: Dispatch<Action>
  selectedTrack: number
  onSelectTrack: (i: number) => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

interface Hit {
  track: number
  step: number
}

function cellAt(x: number, y: number): Hit | null {
  const el = document.elementFromPoint(x, y)
  const cell = (el as HTMLElement | null)?.closest<HTMLElement>('[data-cell]')
  if (!cell) return null
  return { track: Number(cell.dataset.track), step: Number(cell.dataset.step) }
}

const VEL_LABELS: Record<number, string> = { 1: 'Ghost (tiho)', 2: 'Normalno', 3: 'Akcent' }

export function PatternView({ pattern, engine, dispatch, selectedTrack, onSelectTrack, openMenu }: Props) {
  const { lineRef, scrollRef, step: playStep } = usePlayhead(engine, pattern.length)
  /** vrednost, ki jo trenutno "barvamo" med vlečenjem; null = ne vlečemo */
  const paint = useRef<Vel | null>(null)

  const columns: CSSProperties = { gridTemplateColumns: `repeat(${pattern.length}, minmax(26px, 1fr))` }

  const stepMenu = (track: number, step: number): MenuItem[] => {
    const cur = pattern.tracks[track].steps[step]
    const set = (patch: { v?: Vel; roll?: number }) =>
      dispatch({ t: 'step', track, step, value: { v: patch.v ?? cur.v, roll: patch.roll ?? cur.roll } })
    return [
      { label: `${pattern.tracks[track].name} · korak ${step + 1}`, header: true },
      ...([1, 2, 3] as Vel[]).map((v) => ({
        label: VEL_LABELS[v],
        checked: cur.v === v,
        onClick: () => set({ v }),
      })),
      { separator: true },
      { label: 'Roll (ponovitve v koraku)', header: true },
      ...[1, 2, 3, 4].map((roll) => ({
        label: roll === 1 ? 'Brez' : `×${roll}`,
        checked: (cur.roll ?? 1) === roll,
        onClick: () => dispatch({ t: 'step', track, step, value: { v: cur.v || 2, roll } }),
      })),
      { separator: true },
      { label: 'Izbriši korak', onClick: () => dispatch({ t: 'step', track, step, value: { v: 0 } }) },
      { label: 'Zbriši celo vrsto', danger: true, onClick: () => dispatch({ t: 'rowClear', track }) },
    ]
  }

  const trackMenu = (track: number): MenuItem[] => {
    const t = pattern.tracks[track]
    return [
      { label: t.name, header: true },
      { label: 'Predposlušaj', onClick: () => void engine.preview(pattern, track) },
      { label: 'Utišaj (mute)', checked: t.muted, onClick: () => dispatch({ t: 'track', track, patch: { muted: !t.muted } }) },
      { label: 'Samo ta (solo)', checked: t.soloed, onClick: () => dispatch({ t: 'track', track, patch: { soloed: !t.soloed } }) },
      { separator: true },
      { label: 'Zapolni vsako 4-tinko', onClick: () => dispatch({ t: 'rowFill', track, every: 4, v: 2 }) },
      { label: 'Zapolni vsako 8-tinko', onClick: () => dispatch({ t: 'rowFill', track, every: 2, v: 2 }) },
      { label: 'Zbriši vrsto', danger: true, onClick: () => dispatch({ t: 'rowClear', track }) },
    ]
  }

  const handleDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    const hit = cellAt(e.clientX, e.clientY)
    if (!hit) return
    const cur = pattern.tracks[hit.track].steps[hit.step]
    // klik kroži prazno → normalno → akcent → prazno; niansa je v desnem kliku
    const next: Vel = cur.v === 0 ? 2 : cur.v === 2 ? 3 : 0
    paint.current = next
    onSelectTrack(hit.track)
    dispatch({ t: 'step', track: hit.track, step: hit.step, value: { v: next, roll: next ? cur.roll : undefined } })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handleMove = (e: React.PointerEvent) => {
    if (paint.current === null) return
    const hit = cellAt(e.clientX, e.clientY)
    if (hit) dispatch({ t: 'step', track: hit.track, step: hit.step, value: { v: paint.current } })
  }

  const endPaint = () => {
    paint.current = null
  }

  return (
    <div className="timeline">
      <div className="timeline__gutter">
        <div className="gutter__head">Instrument</div>
        {pattern.tracks.map((track, ti) => (
          <button
            key={track.voice}
            className={`glabel${ti === selectedTrack ? ' glabel--on' : ''}${track.muted ? ' glabel--muted' : ''}`}
            style={{ '--track': instrumentOf(track.voice).color } as CSSProperties}
            onClick={() => {
              onSelectTrack(ti)
              if (!engine.playing) void engine.preview(pattern, ti)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              onSelectTrack(ti)
              openMenu(e.clientX, e.clientY, trackMenu(ti))
            }}
            {...longPress((x, y) => {
              onSelectTrack(ti)
              openMenu(x, y, trackMenu(ti))
            })}
          >
            <span className="glabel__dot" />
            <span className="glabel__name">{track.name}</span>
            {track.soloed && <em className="glabel__flag">S</em>}
          </button>
        ))}
      </div>

      <div className="timeline__scroll" ref={scrollRef}>
        <div className="timeline__content">
          <div className="ruler" style={columns}>
            {Array.from({ length: pattern.length }, (_, i) => (
              <div
                key={i}
                className={`tick${i % 4 === 0 ? ' tick--beat' : ''}${i === playStep ? ' tick--play' : ''}`}
                onClick={() => engine.seek(i)}
              >
                {i % 4 === 0 ? i / 4 + 1 : ''}
              </div>
            ))}
          </div>

          <div
            className="rows"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={endPaint}
            onPointerCancel={endPaint}
            onContextMenu={(e) => {
              const hit = cellAt(e.clientX, e.clientY)
              if (!hit) return
              e.preventDefault()
              onSelectTrack(hit.track)
              openMenu(e.clientX, e.clientY, stepMenu(hit.track, hit.step))
            }}
          >
            {pattern.tracks.map((track, ti) => (
              <div
                key={track.voice}
                className={`row${ti === selectedTrack ? ' row--on' : ''}`}
                style={{ ...columns, '--track': instrumentOf(track.voice).color } as CSSProperties}
              >
                {track.steps.map((s, si) => (
                  <div
                    key={si}
                    data-cell
                    data-track={ti}
                    data-step={si}
                    className={
                      'cell' +
                      (s.v ? ` cell--v${s.v}` : '') +
                      (si % 4 === 0 ? ' cell--beat' : '') +
                      (si === playStep ? ' cell--play' : '')
                    }
                    {...longPress((x, y) => openMenu(x, y, stepMenu(ti, si)))}
                  >
                    {s.v > 0 && (s.roll ?? 1) > 1 && <span className="cell__roll">{s.roll}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="playhead" ref={lineRef} />
        </div>
      </div>
    </div>
  )
}
