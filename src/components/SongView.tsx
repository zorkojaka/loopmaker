import { useRef } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { usePlayhead } from '../hooks/usePlayhead'
import { barsOf, clipAt, patternById } from '../state/song'
import type { Action } from '../state/song'
import type { Song } from '../types'
import { STEPS_PER_BAR } from '../types'
import { longPress } from '../hooks/longPress'
import type { MenuItem } from './ContextMenu'

interface Props {
  song: Song
  engine: Engine
  dispatch: Dispatch<Action>
  selectedClip: string | null
  onSelectClip: (id: string | null) => void
  openMenu: (x: number, y: number, items: MenuItem[]) => void
}

interface Hit {
  lane: number
  bar: number
}

function cellAt(x: number, y: number): Hit | null {
  const el = document.elementFromPoint(x, y)
  const cell = (el as HTMLElement | null)?.closest<HTMLElement>('[data-bar]')
  if (!cell) return null
  return { lane: Number(cell.dataset.lane), bar: Number(cell.dataset.bar) }
}

/** Aranžma: vzorci kot bloki na časovnici — kot playlist v FL Studiu. */
export function SongView({ song, engine, dispatch, selectedClip, onSelectClip, openMenu }: Props) {
  const total = song.bars * STEPS_PER_BAR
  const { lineRef, scrollRef, step: playStep } = usePlayhead(engine, total)
  const drag = useRef<{ id: string; moved: boolean; el: HTMLElement } | null>(null)

  const columns: CSSProperties = { gridTemplateColumns: `repeat(${song.bars}, minmax(56px, 1fr))` }
  const playBar = playStep < 0 ? -1 : Math.floor(playStep / STEPS_PER_BAR)

  const emptyMenu = (lane: number, bar: number): MenuItem[] => [
    { label: `Vrsta ${lane + 1} · takt ${bar + 1}`, header: true },
    { label: 'Postavi vzorec', header: true },
    ...song.patterns.map((p) => ({
      label: p.name,
      onClick: () => dispatch({ t: 'clipPlace', lane, bar, patternId: p.id }),
    })),
    { separator: true },
    { label: 'Dodaj 4 takte', onClick: () => dispatch({ t: 'song', patch: { bars: song.bars + 4 } }) },
    { label: 'Dodaj vrsto', onClick: () => dispatch({ t: 'song', patch: { lanes: song.lanes + 1 } }) },
  ]

  const clipMenu = (id: string): MenuItem[] => {
    const clip = song.clips.find((c) => c.id === id)
    const pattern = clip && patternById(song, clip.patternId)
    if (!clip || !pattern) return []
    return [
      { label: `${pattern.name} · takt ${clip.bar + 1}`, header: true },
      { label: 'Uredi ta vzorec', onClick: () => dispatch({ t: 'patternSelect', id: pattern.id }) },
      { label: 'Podvoji naprej', onClick: () => dispatch({ t: 'clipDuplicate', id }) },
      { separator: true },
      { label: 'Zamenjaj z', header: true },
      ...song.patterns
        .filter((p) => p.id !== pattern.id)
        .map((p) => ({
          label: p.name,
          onClick: () => {
            dispatch({ t: 'clipDelete', id })
            dispatch({ t: 'clipPlace', lane: clip.lane, bar: clip.bar, patternId: p.id })
          },
        })),
      { separator: true },
      { label: 'Izbriši blok', danger: true, onClick: () => dispatch({ t: 'clipDelete', id }) },
    ]
  }

  return (
    <div className="timeline">
      <div className="timeline__gutter">
        <div className="gutter__head">Vrste</div>
        {Array.from({ length: song.lanes }, (_, i) => (
          <div key={i} className="glabel glabel--lane">
            {i + 1}
          </div>
        ))}
        <button className="gutter__add" onClick={() => dispatch({ t: 'song', patch: { lanes: song.lanes + 1 } })}>
          + vrsta
        </button>
      </div>

      <div className="timeline__scroll" ref={scrollRef}>
        <div className="timeline__content">
          <div className="ruler" style={columns}>
            {Array.from({ length: song.bars }, (_, i) => (
              <div
                key={i}
                className={`tick tick--beat${i === playBar ? ' tick--play' : ''}`}
                onClick={() => engine.seek(i * STEPS_PER_BAR)}
              >
                {i + 1}
              </div>
            ))}
          </div>

          <div
            className="rows rows--song"
            onPointerUp={(e) => {
              const d = drag.current
              drag.current = null
              if (!d) return
              d.el.style.pointerEvents = ''
              if (!d.moved) return
              const hit = cellAt(e.clientX, e.clientY)
              if (hit) dispatch({ t: 'clipMove', id: d.id, lane: hit.lane, bar: hit.bar })
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (!d || e.buttons === 0) return
              // blok med vlečenjem "spustimo skozi", da vidimo polje pod njim
              d.moved = true
              d.el.style.pointerEvents = 'none'
            }}
            onContextMenu={(e) => {
              const hit = cellAt(e.clientX, e.clientY)
              if (!hit) return
              e.preventDefault()
              const clip = clipAt(song, hit.lane, hit.bar)
              openMenu(e.clientX, e.clientY, clip ? clipMenu(clip.id) : emptyMenu(hit.lane, hit.bar))
            }}
          >
            {Array.from({ length: song.lanes }, (_, lane) => (
              <div key={lane} className="row row--lane" style={columns}>
                {Array.from({ length: song.bars }, (_, bar) => (
                  <div
                    key={bar}
                    data-bar={bar}
                    data-lane={lane}
                    className={`slot${bar === playBar ? ' slot--play' : ''}`}
                    onClick={() => {
                      if (clipAt(song, lane, bar)) return
                      dispatch({ t: 'clipPlace', lane, bar, patternId: song.currentPattern })
                    }}
                    {...longPress((x, y) => {
                      const clip = clipAt(song, lane, bar)
                      openMenu(x, y, clip ? clipMenu(clip.id) : emptyMenu(lane, bar))
                    })}
                  />
                ))}

                {song.clips
                  .filter((c) => c.lane === lane)
                  .map((c) => {
                    const pattern = patternById(song, c.patternId)
                    if (!pattern) return null
                    const span = barsOf(pattern)
                    const press = longPress((x, y) => openMenu(x, y, clipMenu(c.id)))
                    return (
                      <button
                        key={c.id}
                        className={`clip${c.id === selectedClip ? ' clip--on' : ''}`}
                        style={
                          {
                            '--pattern': pattern.color,
                            left: `${(c.bar / song.bars) * 100}%`,
                            width: `${(span / song.bars) * 100}%`,
                          } as CSSProperties
                        }
                        {...press}
                        onPointerDown={(e) => {
                          press.onPointerDown(e)
                          drag.current = { id: c.id, moved: false, el: e.currentTarget }
                          onSelectClip(c.id)
                          dispatch({ t: 'patternSelect', id: pattern.id })
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openMenu(e.clientX, e.clientY, clipMenu(c.id))
                        }}
                      >
                        {pattern.name}
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>

          <div className="playhead" ref={lineRef} />
        </div>
      </div>
    </div>
  )
}
