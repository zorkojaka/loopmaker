import { useEffect, useState } from 'react'
import type { Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { useLoopLines } from '../hooks/useLoopLines'
import { LOOP_CHOICES, makeLoop, sectionAt } from '../state/song'
import type { Action } from '../state/song'
import type { LoopKind, Song } from '../types'
import type { MenuItem } from './ContextMenu'
import { LoopRow } from './LoopRow'
import { Sections } from './Sections'

interface Props {
  song: Song
  engine: Engine
  dispatch: Dispatch<Action>
  /** odpre pogled "Delaj loop" z izbranim loopom */
  onEditLoop: (id: string) => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

/**
 * Vsi loopi na enem zaslonu. Vsak ima svojo mrežo v svoji dolžini in svojo
 * črto, ki teče po njej — zato se na prvi pogled vidi, da dvotaktni bas kroži
 * počasneje od enotaktnega hi-hata.
 */
export function Board({ song, engine, dispatch, onEditLoop, openMenu }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const registerLine = useLoopLines(engine, song)
  /** kateri loopi res igrajo — v zaporedju to določa kitica, ne stikalo */
  const [playingIds, setPlayingIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!song.chainOn) {
      setPlayingIds(null)
      return
    }
    let raf = 0
    let last = ''
    const tick = () => {
      const pos = engine.position()
      const at = pos >= 0 ? sectionAt(song, Math.floor(pos)) : null
      const key = at ? at.section.id : ''
      if (key !== last) {
        last = key
        setPlayingIds(at ? at.section.loopIds : null)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [engine, song])

  const addMenu = (x: number, y: number) => {
    const add = (voice: string, kind: LoopKind) => {
      const loop = makeLoop(voice, kind, { active: false })
      dispatch({ t: 'loopInsert', loop })
      setExpanded(kind === 'melody' ? loop.id : null)
    }
    const group = (kind: LoopKind) =>
      LOOP_CHOICES.filter((c) => c.kind === kind).map((c) => ({ label: c.name, onClick: () => add(c.voice, c.kind) }))
    openMenu(x, y, [
      { label: 'Ritem', header: true },
      ...group('drum'),
      { separator: true },
      { label: 'Melodija', header: true },
      ...group('melody'),
      { separator: true },
      { label: 'Posnetek', header: true },
      ...group('sample'),
    ])
  }

  return (
    <div className="board">
      <Sections song={song} engine={engine} dispatch={dispatch} openMenu={openMenu} />

      {song.loops.map((loop) => (
        <LoopRow
          key={loop.id}
          loop={loop}
          engine={engine}
          dispatch={dispatch}
          playing={playingIds ? playingIds.includes(loop.id) : loop.active}
          onEdit={() => onEditLoop(loop.id)}
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
