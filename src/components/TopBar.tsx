import { useState } from 'react'
import type { Song } from '../types'
import { BpmControl } from './BpmControl'

export type View = 'make' | 'channels'

interface Props {
  song: Song
  playing: boolean
  view: View
  onView: (view: View) => void
  onToggle: () => void
  onBpm: (bpm: number) => void
  onMix: (patch: Partial<Song>) => void
}

export function TopBar({ song, playing, view, onView, onToggle, onBpm, onMix }: Props) {
  const [mixOpen, setMixOpen] = useState(false)
  const active = song.loops.filter((l) => l.active).length

  return (
    <header className="topbar">
      <button className={`play${playing ? ' play--on' : ''}`} onClick={onToggle} aria-label={playing ? 'Stop' : 'Predvajaj'}>
        {playing ? '■' : '▶'}
      </button>

      <BpmControl bpm={song.bpm} onChange={onBpm} />

      <div className="views" role="tablist">
        {([
          ['make', 'Delaj loop'],
          ['channels', 'Kanali'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            className={`vtab${view === id ? ' vtab--on' : ''}`}
            onClick={() => onView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="topbar__count">
        <strong>{active}</strong>
        <span>{active === 1 ? 'loop igra' : 'loopov igra'}</span>
      </span>

      <div className="mix">
        <button className={`icon${mixOpen ? ' icon--on' : ''}`} onClick={() => setMixOpen((v) => !v)} aria-label="Mešalnik">
          ⚙
        </button>
        {mixOpen && (
          <div className="mix__panel">
            <label className="slider">
              <span className="slider__label">
                Swing<em>{Math.round(song.swing * 100)}%</em>
              </span>
              <input type="range" min={0} max={0.6} step={0.01} value={song.swing} onChange={(e) => onMix({ swing: Number(e.target.value) })} />
            </label>
            <label className="slider">
              <span className="slider__label">
                Glasnost<em>{Math.round(song.master * 100)}%</em>
              </span>
              <input type="range" min={0} max={1} step={0.01} value={song.master} onChange={(e) => onMix({ master: Number(e.target.value) })} />
            </label>
            <button className="mix__close" onClick={() => setMixOpen(false)}>
              Zapri
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
