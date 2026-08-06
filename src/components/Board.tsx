import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { LOOP_CHOICES, makeLoop } from '../state/song'
import type { Action } from '../state/song'
import type { Song } from '../types'
import type { MenuItem } from './ContextMenu'
import { LoopRow } from './LoopRow'

interface Props {
  song: Song
  engine: Engine
  dispatch: Dispatch<Action>
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

/**
 * Vsi loopi na enem zaslonu. Vsak ima svojo mrežo v svoji dolžini in svojo
 * črto, ki teče po njej — zato se na prvi pogled vidi, da dvotaktni bas kroži
 * počasneje od enotaktnega hi-hata.
 */
export function Board({ song, engine, dispatch, openMenu }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const lines = useRef(new Map<string, HTMLElement>())

  // ena sama animacijska zanka premika črte vseh vrstic neposredno prek DOM-a
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const pos = engine.position()
      for (const loop of song.loops) {
        const el = lines.current.get(loop.id)
        if (!el) continue
        const on = pos >= 0 && loop.active
        el.style.opacity = on ? '1' : '0'
        if (on) el.style.left = `${((pos % loop.length) / loop.length) * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [engine, song.loops])

  const registerLine = (id: string, el: HTMLElement | null) => {
    if (el) lines.current.set(id, el)
    else lines.current.delete(id)
  }

  const addMenu = (x: number, y: number) => {
    const add = (voice: string, kind: 'drum' | 'melody') => {
      const loop = makeLoop(voice, kind, { active: false })
      dispatch({ t: 'loopInsert', loop })
      setExpanded(kind === 'melody' ? loop.id : null)
    }
    openMenu(x, y, [
      { label: 'Ritem', header: true },
      ...LOOP_CHOICES.filter((c) => c.kind === 'drum').map((c) => ({ label: c.name, onClick: () => add(c.voice, c.kind) })),
      { separator: true },
      { label: 'Melodija', header: true },
      ...LOOP_CHOICES.filter((c) => c.kind === 'melody').map((c) => ({ label: c.name, onClick: () => add(c.voice, c.kind) })),
    ])
  }

  return (
    <div className="board">
      {song.loops.map((loop) => (
        <LoopRow
          key={loop.id}
          loop={loop}
          engine={engine}
          dispatch={dispatch}
          expanded={expanded === loop.id}
          onExpand={() => setExpanded((id) => (id === loop.id ? null : loop.id))}
          openMenu={openMenu}
          registerLine={registerLine}
        />
      ))}

      <div className="board__bar">
        <button className="board__add" onClick={(e) => addMenu(e.clientX, e.clientY)}>
          + Nov loop
        </button>
        <button className="chip" onClick={() => dispatch({ t: 'loopsAll', active: true })}>
          Vse prižgi
        </button>
        <button className="chip" onClick={() => dispatch({ t: 'loopsAll', active: false })}>
          Vse ugasni
        </button>
        <span className="board__hint">Velik gumb prižge loop · tap po mreži ureja · ⌄ odpre podrobnosti</span>
      </div>
    </div>
  )
}
