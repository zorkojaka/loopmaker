import { useEffect, useState } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { longPress } from '../hooks/longPress'
import { SECTION_COLORS, sectionAt } from '../state/song'
import type { Action } from '../state/song'
import type { Song } from '../types'
import type { MenuItem } from './ContextMenu'

interface Props {
  song: Song
  engine: Engine
  dispatch: Dispatch<Action>
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

/**
 * Kitice: posnetek stanja kanalov ("ti loopi igrajo, toliko taktov").
 * Zaporedje kitic potem samo vodi skladbo — kitica, refren, kitica …
 */
export function Sections({ song, engine, dispatch, openMenu }: Props) {
  const [now, setNow] = useState<number | null>(null)

  // katera kitica teče; v state gre samo sprememba, ne vsak okvir
  useEffect(() => {
    if (!song.chainOn) {
      setNow(null)
      return
    }
    let raf = 0
    let last = -1
    const tick = () => {
      const pos = engine.position()
      const at = pos >= 0 ? sectionAt(song, Math.floor(pos)) : null
      const index = at?.index ?? -1
      if (index !== last) {
        last = index
        setNow(index < 0 ? null : index)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [engine, song])

  const sectionMenu = (id: string): MenuItem[] => {
    const section = song.sections.find((s) => s.id === id)
    if (!section) return []
    return [
      { label: section.name, header: true },
      { label: 'Vklopi te loope', onClick: () => dispatch({ t: 'sectionApply', id }) },
      { label: 'Posodobi po trenutnem stanju', onClick: () => dispatch({ t: 'sectionCapture', id }) },
      { label: 'Dodaj v zaporedje', onClick: () => dispatch({ t: 'chainAdd', id }) },
      {
        label: 'Preimenuj…',
        onClick: () => {
          const name = prompt('Ime kitice', section.name)
          if (name) dispatch({ t: 'sectionPatch', id, patch: { name } })
        },
      },
      {
        label: 'Naslednja barva',
        onClick: () => {
          const next = SECTION_COLORS[(SECTION_COLORS.indexOf(section.color) + 1) % SECTION_COLORS.length]
          dispatch({ t: 'sectionPatch', id, patch: { color: next } })
        },
      },
      { separator: true },
      { label: 'Dolžina', header: true },
      ...[1, 2, 4, 8, 16].map((bars) => ({
        label: `${bars} ${bars === 1 ? 'takt' : bars < 5 ? 'takti' : 'taktov'}`,
        checked: section.bars === bars,
        onClick: () => dispatch({ t: 'sectionPatch', id, patch: { bars } }),
      })),
      { separator: true },
      { label: 'Izbriši kitico', danger: true, onClick: () => dispatch({ t: 'sectionDelete', id }) },
    ]
  }

  return (
    <div className="sections">
      <div className="sections__row">
        <span className="sections__title">Kitice</span>
        {song.sections.map((section) => (
          <button
            key={section.id}
            className="sec"
            style={{ '--sec': section.color } as CSSProperties}
            onClick={() => dispatch({ t: 'sectionApply', id: section.id })}
            onContextMenu={(e) => {
              e.preventDefault()
              openMenu(e.clientX, e.clientY, sectionMenu(section.id))
            }}
            {...longPress((x, y) => openMenu(x, y, sectionMenu(section.id)))}
          >
            {section.name}
            <em>{section.bars}t</em>
          </button>
        ))}
        <button className="sec sec--add" onClick={() => dispatch({ t: 'sectionAdd' })}>
          + shrani stanje
        </button>
      </div>

      {song.chain.length > 0 && (
        <div className="sections__row">
          <span className="sections__title">Zaporedje</span>
          <div className="chain">
            {song.chain.map((id, i) => {
              const section = song.sections.find((s) => s.id === id)
              if (!section) return null
              return (
                <span
                  key={`${id}-${i}`}
                  className={`chainitem${now === i ? ' chainitem--now' : ''}`}
                  style={{ '--sec': section.color } as CSSProperties}
                >
                  <button className="chainitem__move" onClick={() => dispatch({ t: 'chainMove', at: i, by: -1 })} aria-label="Prej">
                    ‹
                  </button>
                  {section.name}
                  <button className="chainitem__move" onClick={() => dispatch({ t: 'chainMove', at: i, by: 1 })} aria-label="Kasneje">
                    ›
                  </button>
                  <button className="chainitem__x" onClick={() => dispatch({ t: 'chainRemove', at: i })} aria-label="Odstrani">
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
          <button
            className={`chip${song.chainOn ? ' chip--on' : ''}`}
            onClick={() => dispatch({ t: 'song', patch: { chainOn: !song.chainOn } })}
          >
            {song.chainOn ? 'Zaporedje vodi' : 'Predvajaj zaporedje'}
          </button>
        </div>
      )}

      {song.chainOn && (
        <p className="sections__hint">
          Zaporedje določa, kaj igra — stikala na kanalih zdaj le pripravljajo stanje, ki ga s
          <strong> Posodobi po trenutnem stanju </strong>
          shraniš v kitico.
        </p>
      )}
    </div>
  )
}
