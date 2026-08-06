import type { Song, Track } from '../types'
import { instrumentOf, noteName } from '../audio/instruments'

interface Props {
  track: Track
  song: Song
  onTrack: (patch: Partial<Track>) => void
  onSong: (patch: Partial<Song>) => void
  onClearTrack: () => void
  onPreview: () => void
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="slider">
      <span className="slider__label">
        {label}
        <em>{display}</em>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function TrackEditor({ track, song, onTrack, onSong, onClearTrack, onPreview }: Props) {
  const def = instrumentOf(track.voice)
  const tuneDisplay = def.melodic ? noteName(track.voice, track.tune) : `${track.tune > 0 ? '+' : ''}${track.tune}`

  return (
    <footer className="editor" style={{ '--track': def.color } as React.CSSProperties}>
      <div className="editor__head">
        <button className="editor__name" onClick={onPreview}>
          {track.name}
        </button>
        <button className={`chip${track.muted ? ' chip--on' : ''}`} onClick={() => onTrack({ muted: !track.muted })}>
          Mute
        </button>
        <button className={`chip${track.soloed ? ' chip--on' : ''}`} onClick={() => onTrack({ soloed: !track.soloed })}>
          Solo
        </button>
        <button className="chip" onClick={onClearTrack}>
          Zbriši vrsto
        </button>
      </div>

      <div className="editor__sliders">
        <Slider label="Glasnost" value={track.level} min={0} max={1} step={0.01} display={Math.round(track.level * 100) + '%'} onChange={(v) => onTrack({ level: v })} />
        <Slider label={def.melodic ? 'Nota' : 'Tune'} value={track.tune} min={-12} max={12} step={1} display={tuneDisplay} onChange={(v) => onTrack({ tune: v })} />
        <Slider label="Dolžina" value={track.decay} min={0.2} max={2} step={0.05} display={track.decay.toFixed(2) + '×'} onChange={(v) => onTrack({ decay: v })} />
      </div>

      <div className="editor__sliders editor__sliders--global">
        <Slider label="Swing" value={song.swing} min={0} max={0.6} step={0.01} display={Math.round(song.swing * 100) + '%'} onChange={(v) => onSong({ swing: v })} />
        <Slider label="Master" value={song.master} min={0} max={1} step={0.01} display={Math.round(song.master * 100) + '%'} onChange={(v) => onSong({ master: v })} />
      </div>
    </footer>
  )
}
