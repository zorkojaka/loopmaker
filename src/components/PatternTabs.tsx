import type { Dispatch } from 'react'
import type { Song } from '../types'
import { PATTERN_COLORS, barsOf } from '../state/song'
import type { Action } from '../state/song'
import { longPress } from '../hooks/longPress'
import type { MenuItem } from './ContextMenu'

interface Props {
  song: Song
  dispatch: Dispatch<Action>
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

/** Seznam vzorcev — izbira levo, urejanje prek desnega klika / dolgega pritiska. */
export function PatternTabs({ song, dispatch, openMenu }: Props) {
  const menuFor = (id: string): MenuItem[] => {
    const pattern = song.patterns.find((p) => p.id === id)
    if (!pattern) return []
    return [
      { label: pattern.name, header: true },
      {
        label: 'Preimenuj…',
        onClick: () => {
          const name = prompt('Ime vzorca', pattern.name)
          if (name) dispatch({ t: 'patternPatch', id, patch: { name } })
        },
      },
      { label: 'Podvoji', onClick: () => dispatch({ t: 'patternDuplicate', id }) },
      { label: 'Počisti', onClick: () => dispatch({ t: 'patternClear', id }) },
      {
        label: 'Naslednja barva',
        onClick: () => {
          const next = PATTERN_COLORS[(PATTERN_COLORS.indexOf(pattern.color) + 1) % PATTERN_COLORS.length]
          dispatch({ t: 'patternPatch', id, patch: { color: next } })
        },
      },
      { separator: true },
      { label: 'Dolžina', header: true },
      ...[16, 32, 64].map((length) => ({
        label: `${length / 16} ${length === 16 ? 'takt' : length === 32 ? 'takta' : 'takti'}`,
        checked: pattern.length === length,
        onClick: () => dispatch({ t: 'patternLength', id, length }),
      })),
      { separator: true },
      { label: 'Izbriši vzorec', danger: true, onClick: () => dispatch({ t: 'patternDelete', id }) },
    ]
  }

  return (
    <div className="tabs">
      <span className="tabs__title">Vzorci</span>
      <div className="tabs__list">
        {song.patterns.map((p) => (
          <button
            key={p.id}
            className={`tab${p.id === song.currentPattern ? ' tab--on' : ''}`}
            style={{ '--pattern': p.color } as React.CSSProperties}
            onClick={() => dispatch({ t: 'patternSelect', id: p.id })}
            onContextMenu={(e) => {
              e.preventDefault()
              dispatch({ t: 'patternSelect', id: p.id })
              openMenu(e.clientX, e.clientY, menuFor(p.id))
            }}
            {...longPress((x, y) => {
              dispatch({ t: 'patternSelect', id: p.id })
              openMenu(x, y, menuFor(p.id))
            })}
          >
            <span className="tab__dot" />
            {p.name}
            {barsOf(p) > 1 && <em>{barsOf(p)}t</em>}
          </button>
        ))}
        <button className="tab tab--add" onClick={() => dispatch({ t: 'patternAdd' })} aria-label="Nov vzorec">
          +
        </button>
      </div>
    </div>
  )
}
