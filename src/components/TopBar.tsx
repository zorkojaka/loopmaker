import { useState } from 'react'
import type { Mode, Song } from '../types'
import { BpmControl } from './BpmControl'

interface Props {
  song: Song
  playing: boolean
  onToggle: () => void
  onBpm: (bpm: number) => void
  onMode: (mode: Mode) => void
  onMix: (patch: Partial<Song>) => void
}

export function TopBar({ song, playing, onToggle, onBpm, onMode, onMix }: Props) {
  const [mixOpen, setMixOpen] = useState(false)

  return (
    <header className="topbar">
      <button className={`play${playing ? ' play--on' : ''}`} onClick={onToggle} aria-label={playing ? 'Stop' : 'Predvajaj'}>
        {playing ? '■' : '▶'}
      </button>

      <BpmControl bpm={song.bpm} onChange={onBpm} />

      <div className="modes" role="tablist">
        {(['pattern', 'song'] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={song.mode === m}
            className={`mode${song.mode === m ? ' mode--on' : ''}`}
            onClick={() => onMode(m)}
          >
            {m === 'pattern' ? 'Vzorec' : 'Skladba'}
          </button>
        ))}
      </div>

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
