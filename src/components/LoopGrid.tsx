import { useRef } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { usePlayhead } from '../hooks/usePlayhead'
import { longPress } from '../hooks/longPress'
import { barsOf, gridLength } from '../state/song'
import type { Action } from '../state/song'
import type { Loop, Song, Vel } from '../types'
import type { MenuItem } from './ContextMenu'

interface Props {
  song: Song
  editing: Loop
  engine: Engine
  dispatch: Dispatch<Action>
  onSelect: (id: string) => void
  onBack: () => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

interface Hit {
  id: string
  step: number
}

function cellAt(x: number, y: number): Hit | null {
  const el = document.elementFromPoint(x, y)
  const cell = (el as HTMLElement | null)?.closest<HTMLElement>('[data-cell]')
  if (!cell || !cell.dataset.loop) return null
  return { id: cell.dataset.loop, step: Number(cell.dataset.step) }
}

const VEL_LABELS: Record<number, string> = { 1: 'Ghost (tiho)', 2: 'Normalno', 3: 'Akcent' }

/**
 * Urejevalnik ritmičnih loopov. Vsi loopi so vidni hkrati, ker se hi-hat piše
 * proti bobnu — a urejaš enega naenkrat. Loop, krajši od mreže, se v njej
 * ponovi in ponovitev je le drugače obarvana; urejaš isti korak.
 */
export function LoopGrid({ song, editing, engine, dispatch, onSelect, onBack, openMenu }: Props) {
  const length = gridLength(song)
  const { lineRef, scrollRef, step: playStep } = usePlayhead(engine, length)
  /** vrednost, ki jo trenutno "barvamo" med vlečenjem; null = ne vlečemo */
  const paint = useRef<Vel | null>(null)

  const columns: CSSProperties = { gridTemplateColumns: `repeat(${length}, minmax(26px, 1fr))` }

  const setStep = (loop: Loop, step: number, value: { v: Vel; roll?: number }) =>
    dispatch({ t: 'step', id: loop.id, step: step % loop.length, value })

  const stepMenu = (loop: Loop, rawStep: number): MenuItem[] => {
    const step = rawStep % loop.length
    const cur = loop.steps[step]
    return [
      { label: `${loop.name} · korak ${step + 1}`, header: true },
      ...([1, 2, 3] as Vel[]).map((v) => ({
        label: VEL_LABELS[v],
        checked: cur.v === v,
        onClick: () => setStep(loop, step, { v, roll: cur.roll }),
      })),
      { separator: true },
      { label: 'Roll (ponovitve v koraku)', header: true },
      ...[1, 2, 3, 4].map((roll) => ({
        label: roll === 1 ? 'Brez' : `×${roll}`,
        checked: (cur.roll ?? 1) === roll,
        onClick: () => setStep(loop, step, { v: cur.v || 2, roll }),
      })),
      { separator: true },
      { label: 'Izbriši korak', onClick: () => setStep(loop, step, { v: 0 }) },
      { label: 'Počisti loop', danger: true, onClick: () => dispatch({ t: 'loopClear', id: loop.id }) },
    ]
  }

  const loopMenu = (loop: Loop): MenuItem[] => [
    { label: loop.name, header: true },
    { label: loop.active ? 'Ugasni' : 'Prižgi', onClick: () => dispatch({ t: 'loopToggle', id: loop.id }) },
    { label: 'Uredi ta loop', onClick: () => onSelect(loop.id) },
    { separator: true },
    { label: 'Zapolni vsako 4-tinko', onClick: () => dispatch({ t: 'rowFill', id: loop.id, every: 4, v: 2 }) },
    { label: 'Zapolni vsako 8-tinko', onClick: () => dispatch({ t: 'rowFill', id: loop.id, every: 2, v: 2 }) },
    { label: 'Počisti', danger: true, onClick: () => dispatch({ t: 'loopClear', id: loop.id }) },
  ]

  const loopOf = (id: string) => song.loops.find((l) => l.id === id)

  const handleDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    const hit = cellAt(e.clientX, e.clientY)
    const loop = hit && loopOf(hit.id)
    if (!hit || !loop || loop.kind !== 'drum') return
    const cur = loop.steps[hit.step % loop.length]
    // klik kroži prazno → normalno → akcent → prazno; niansa je v desnem kliku
    const next: Vel = cur.v === 0 ? 2 : cur.v === 2 ? 3 : 0
    paint.current = next
    onSelect(loop.id)
    setStep(loop, hit.step, { v: next, roll: next ? cur.roll : undefined })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handleMove = (e: React.PointerEvent) => {
    if (paint.current === null) return
    const hit = cellAt(e.clientX, e.clientY)
    const loop = hit && loopOf(hit.id)
    if (hit && loop && loop.kind === 'drum') setStep(loop, hit.step, { v: paint.current })
  }

  const endPaint = () => {
    paint.current = null
  }

  return (
    <div className="editor">
      <div className="editor__bar">
        <button className="chip" onClick={onBack}>
          ← Paleta
        </button>
        <span className="editor__title" style={{ '--track': editing.color } as CSSProperties}>
          {editing.name}
        </span>
        <button
          className={`chip${editing.active ? ' chip--on' : ''}`}
          onClick={() => dispatch({ t: 'loopToggle', id: editing.id })}
        >
          {editing.active ? 'Igra' : 'Izklop'}
        </button>
        <div className="editor__group">
          <span className="editor__meta">Dolžina</span>
          {[16, 32, 64].map((l) => (
            <button
              key={l}
              className={`chip${editing.length === l ? ' chip--on' : ''}`}
              onClick={() => dispatch({ t: 'loopLength', id: editing.id, length: l })}
            >
              {l / 16}
            </button>
          ))}
        </div>
      </div>

      <div className="timeline">
        <div className="timeline__gutter">
          <div className="gutter__head">Loopi</div>
          {song.loops.map((loop) => (
            <button
              key={loop.id}
              className={`glabel${loop.id === editing.id ? ' glabel--on' : ''}${loop.active ? '' : ' glabel--off'}`}
              style={{ '--track': loop.color } as CSSProperties}
              onClick={() => onSelect(loop.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                openMenu(e.clientX, e.clientY, loopMenu(loop))
              }}
              {...longPress((x, y) => openMenu(x, y, loopMenu(loop)))}
            >
              <span className="glabel__dot" />
              <span className="glabel__name">{loop.name}</span>
              {loop.kind === 'melody' && <em className="glabel__flag">♪</em>}
            </button>
          ))}
        </div>

        <div className="timeline__scroll" ref={scrollRef}>
          <div className="timeline__content">
            <div className="ruler" style={columns}>
              {Array.from({ length }, (_, i) => (
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
                const loop = hit && loopOf(hit.id)
                if (!hit || !loop || loop.kind !== 'drum') return
                e.preventDefault()
                onSelect(loop.id)
                openMenu(e.clientX, e.clientY, stepMenu(loop, hit.step))
              }}
            >
              {song.loops.map((loop) => (
                <div
                  key={loop.id}
                  className={`row${loop.id === editing.id ? ' row--on' : ''}${loop.active ? '' : ' row--off'}`}
                  style={{ ...columns, '--track': loop.color } as CSSProperties}
                  onClick={loop.kind === 'melody' ? () => onSelect(loop.id) : undefined}
                >
                  {Array.from({ length }, (_, i) => {
                    const local = i % loop.length
                    const repeat = i >= loop.length
                    if (loop.kind === 'melody') {
                      const starts = loop.notes.filter((n) => n.step === local)
                      const held = loop.notes.some((n) => local > n.step && local < n.step + n.len)
                      return (
                        <div
                          key={i}
                          className={
                            'cell' +
                            (starts.length ? ' cell--v2' : held ? ' cell--v1' : '') +
                            (i % 4 === 0 ? ' cell--beat' : '') +
                            (repeat ? ' cell--repeat' : '') +
                            (i === playStep ? ' cell--play' : '')
                          }
                        >
                          {starts.length > 1 && <span className="cell__roll">{starts.length}</span>}
                        </div>
                      )
                    }
                    const s = loop.steps[local]
                    return (
                      <div
                        key={i}
                        data-cell
                        data-loop={loop.id}
                        data-step={i}
                        className={
                          'cell' +
                          (s?.v ? ` cell--v${s.v}` : '') +
                          (i % 4 === 0 ? ' cell--beat' : '') +
                          (repeat ? ' cell--repeat' : '') +
                          (i === playStep ? ' cell--play' : '')
                        }
                        {...longPress((x, y) => {
                          onSelect(loop.id)
                          openMenu(x, y, stepMenu(loop, i))
                        })}
                      >
                        {s?.v > 0 && (s.roll ?? 1) > 1 && <span className="cell__roll">{s.roll}</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="playhead" ref={lineRef} />
          </div>
        </div>
      </div>

      {barsOf(editing) * 16 < length && (
        <p className="editor__note">
          Ta loop je krajši od mreže, zato se v njej ponovi — bledejša polja so ponovitev istega koraka.
        </p>
      )}
    </div>
  )
}
