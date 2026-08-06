import type { Song } from '../types'

interface Props {
  song: Song
  playing: boolean
  onToggle: () => void
  onBpm: (bpm: number) => void
  onPattern: (index: number) => void
}

export function Transport({ song, playing, onToggle, onBpm, onPattern }: Props) {
  return (
    <header className="transport">
      <button className={`play${playing ? ' play--on' : ''}`} onClick={onToggle} aria-label={playing ? 'Stop' : 'Play'}>
        {playing ? '■' : '▶'}
      </button>

      <div className="bpm">
        <button onClick={() => onBpm(song.bpm - 1)} aria-label="Počasneje">−</button>
        <div className="bpm__value">
          <strong>{song.bpm}</strong>
          <span>BPM</span>
        </div>
        <button onClick={() => onBpm(song.bpm + 1)} aria-label="Hitreje">+</button>
      </div>

      <div className="slots">
        {song.patterns.map((p, i) => (
          <button key={p.name} className={`slot${i === song.current ? ' slot--on' : ''}`} onClick={() => onPattern(i)}>
            {p.name}
          </button>
        ))}
      </div>
    </header>
  )
}
