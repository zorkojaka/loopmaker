import { useEffect, useRef } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { longPress } from '../hooks/longPress'
import { LOOP_CHOICES, barsOf, cloneLoop, makeLoop } from '../state/song'
import type { Action } from '../state/song'
import type { Loop, Song } from '../types'
import type { MenuItem } from './ContextMenu'

interface Props {
  song: Song
  engine: Engine
  dispatch: Dispatch<Action>
  onEdit: (id: string) => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

/** Ali ima loop na tem koraku kaj slišnega — za sličico na kartici. */
function hitAt(loop: Loop, step: number): number {
  if (loop.kind === 'melody') {
    const starts = loop.notes.filter((n) => n.step === step)
    if (starts.length) return Math.max(...starts.map((n) => n.v))
    return loop.notes.some((n) => step > n.step && step < n.step + n.len) ? 1 : 0
  }
  return loop.steps[step]?.v ?? 0
}

/**
 * Glavni zaslon: vsak loop je kartica, ki jo s tapom prižgeš ali ugasneš.
 * Loopi tečejo po skupni uri, zato prižiganje med igranjem ostane v ritmu.
 */
export function Palette({ song, engine, dispatch, onEdit, openMenu }: Props) {
  const bars = useRef(new Map<string, HTMLElement>())

  // faza vsakega loopa se riše 60×/s neposredno v DOM, brez ponovnega izrisa Reacta
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const pos = engine.position()
      for (const l of song.loops) {
        const el = bars.current.get(l.id)
        if (!el) continue
        const on = pos >= 0 && l.active
        el.style.opacity = on ? '1' : '0'
        if (on) el.style.transform = `scaleX(${((pos % l.length) + 1) / l.length})`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [engine, song.loops])

  const addMenu = (x: number, y: number) =>
    openMenu(x, y, [
      { label: 'Ritem', header: true },
      ...LOOP_CHOICES.filter((c) => c.kind === 'drum').map((c) => ({
        label: c.name,
        onClick: () => {
          const loop = makeLoop(c.voice, c.kind, { active: false })
          dispatch({ t: 'loopInsert', loop })
          onEdit(loop.id)
        },
      })),
      { separator: true },
      { label: 'Melodija', header: true },
      ...LOOP_CHOICES.filter((c) => c.kind === 'melody').map((c) => ({
        label: c.name,
        onClick: () => {
          const loop = makeLoop(c.voice, c.kind, { active: false })
          dispatch({ t: 'loopInsert', loop })
          onEdit(loop.id)
        },
      })),
    ])

  const loopMenu = (loop: Loop): MenuItem[] => [
    { label: loop.name, header: true },
    { label: 'Uredi', onClick: () => onEdit(loop.id) },
    {
      label: 'Podvoji',
      onClick: () => {
        const copy = cloneLoop(loop)
        dispatch({ t: 'loopInsert', loop: copy, after: loop.id })
        onEdit(copy.id)
      },
    },
    {
      label: 'Preimenuj…',
      onClick: () => {
        const name = prompt('Ime loopa', loop.name)
        if (name) dispatch({ t: 'loopPatch', id: loop.id, patch: { name } })
      },
    },
    { label: 'Samo ta naj igra', onClick: () => dispatch({ t: 'loopOnly', id: loop.id }) },
    { separator: true },
    { label: 'Dolžina', header: true },
    ...[16, 32, 64].map((length) => ({
      label: length === 16 ? '1 takt' : `${length / 16} takti`,
      checked: loop.length === length,
      onClick: () => dispatch({ t: 'loopLength', id: loop.id, length }),
    })),
    { separator: true },
    { label: 'Počisti', onClick: () => dispatch({ t: 'loopClear', id: loop.id }) },
    { label: 'Izbriši loop', danger: true, onClick: () => dispatch({ t: 'loopDelete', id: loop.id }) },
  ]

  const isEmpty = (loop: Loop) => (loop.kind === 'melody' ? loop.notes.length === 0 : loop.steps.every((s) => !s.v))

  return (
    <div className="palette">
      <div className="palette__grid">
        {song.loops.map((loop) => (
          <div
            key={loop.id}
            className={`card${loop.active ? ' card--on' : ''}`}
            style={{ '--track': loop.color } as CSSProperties}
            onClick={() => dispatch({ t: 'loopToggle', id: loop.id })}
            onContextMenu={(e) => {
              e.preventDefault()
              openMenu(e.clientX, e.clientY, loopMenu(loop))
            }}
            {...longPress((x, y) => openMenu(x, y, loopMenu(loop)))}
          >
            <div className="card__head">
              <span className="card__dot" />
              <span className="card__name">{loop.name}</span>
              <button
                className="card__edit"
                aria-label={`Uredi ${loop.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(loop.id)
                }}
              >
                ✎
              </button>
            </div>

            <div className="card__mini">
              {Array.from({ length: loop.length }, (_, i) => {
                const v = hitAt(loop, i)
                return <span key={i} className={`mini${v ? ` mini--v${v}` : ''}${i % 4 === 0 ? ' mini--beat' : ''}`} />
              })}
            </div>

            <div className="card__foot">
              <span className={`badge${loop.active ? ' badge--on' : ''}`}>{loop.active ? 'IGRA' : 'IZKLOP'}</span>
              <span className="card__meta">
                {isEmpty(loop) ? 'prazen' : loop.kind === 'melody' ? `${loop.notes.length} not` : `${loop.steps.filter((s) => s.v).length} udarcev`}
                {' · '}
                {barsOf(loop) === 1 ? '1 takt' : `${barsOf(loop)} takti`}
              </span>
            </div>

            <div className="card__phase">
              <i
                ref={(el) => {
                  if (el) bars.current.set(loop.id, el)
                  else bars.current.delete(loop.id)
                }}
              />
            </div>
          </div>
        ))}

        <button className="card card--add" onClick={(e) => addMenu(e.clientX, e.clientY)}>
          <span>+</span>
          Nov loop
        </button>
      </div>

      <div className="palette__bar">
        <button className="chip" onClick={() => dispatch({ t: 'loopsAll', active: true })}>
          Vse prižgi
        </button>
        <button className="chip" onClick={() => dispatch({ t: 'loopsAll', active: false })}>
          Vse ugasni
        </button>
        <span className="palette__hint">Tap na kartico jo prižge ali ugasne · ✎ ureja · dolg pritisk odpre meni</span>
      </div>
    </div>
  )
}
