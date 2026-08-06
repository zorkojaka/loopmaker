import type { Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { instrumentOf, melodicOf, noteName } from '../audio/instruments'
import { barsOf, patternById } from '../state/song'
import type { Action } from '../state/song'
import type { Pattern, Song } from '../types'

interface Props {
  song: Song
  pattern: Pattern
  selectedTrack: number
  selectedClip: string | null
  melodyIndex: number | null
  engine: Engine
  dispatch: Dispatch<Action>
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

/** Spodnji pas: parametri tistega, kar je izbrano — instrument ali blok. */
export function Inspector({ song, pattern, selectedTrack, selectedClip, melodyIndex, engine, dispatch }: Props) {
  if (song.mode === 'pattern' && melodyIndex !== null) {
    const melody = pattern.melodies[melodyIndex]
    const def = melodicOf(melody.voice)
    return (
      <footer className="inspector" style={{ '--track': def.color } as React.CSSProperties}>
        <div className="inspector__head">
          <span className="inspector__name">{melody.name}</span>
          <span className="inspector__meta">{melody.notes.length} not</span>
          <button
            className={`chip${melody.muted ? ' chip--on' : ''}`}
            onClick={() => dispatch({ t: 'melodyPatch', melody: melodyIndex, patch: { muted: !melody.muted } })}
          >
            Mute
          </button>
          <button
            className={`chip${melody.soloed ? ' chip--on' : ''}`}
            onClick={() => dispatch({ t: 'melodyPatch', melody: melodyIndex, patch: { soloed: !melody.soloed } })}
          >
            Solo
          </button>
          <button className="chip" onClick={() => dispatch({ t: 'melodyClear', melody: melodyIndex })}>
            Počisti
          </button>
        </div>
        <div className="inspector__sliders">
          <Slider
            label="Glasnost"
            value={melody.level}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(melody.level * 100)}%`}
            onChange={(v) => dispatch({ t: 'melodyPatch', melody: melodyIndex, patch: { level: v } })}
          />
          <Slider
            label="Izzven"
            value={melody.decay}
            min={0.2}
            max={2}
            step={0.05}
            display={`${melody.decay.toFixed(2)}×`}
            onChange={(v) => dispatch({ t: 'melodyPatch', melody: melodyIndex, patch: { decay: v } })}
          />
        </div>
      </footer>
    )
  }

  if (song.mode === 'song') {
    const clip = song.clips.find((c) => c.id === selectedClip)
    const clipPattern = clip && patternById(song, clip.patternId)
    return (
      <footer className="inspector" style={{ '--track': clipPattern?.color ?? '#6ee7ff' } as React.CSSProperties}>
        {clip && clipPattern ? (
          <div className="inspector__head">
            <span className="inspector__name">{clipPattern.name}</span>
            <span className="inspector__meta">
              vrsta {clip.lane + 1} · takt {clip.bar + 1}–{clip.bar + barsOf(clipPattern)}
            </span>
            <button className="chip" onClick={() => dispatch({ t: 'clipDuplicate', id: clip.id })}>
              Podvoji
            </button>
            <button className="chip" onClick={() => dispatch({ t: 'song', patch: { mode: 'pattern' } })}>
              Uredi vzorec
            </button>
            <button className="chip chip--danger" onClick={() => dispatch({ t: 'clipDelete', id: clip.id })}>
              Izbriši
            </button>
          </div>
        ) : (
          <div className="inspector__hint">
            Klikni v mrežo, da postaviš vzorec <strong>{pattern.name}</strong>. Blok povleci, da ga premakneš; desni klik (ali dolg
            pritisk) odpre meni.
          </div>
        )}
      </footer>
    )
  }

  const track = pattern.tracks[selectedTrack]
  const def = instrumentOf(track.voice)
  const tuneDisplay = def.melodic ? noteName(track.voice, track.tune) : `${track.tune > 0 ? '+' : ''}${track.tune}`

  return (
    <footer className="inspector" style={{ '--track': def.color } as React.CSSProperties}>
      <div className="inspector__head">
        <button className="inspector__name" onClick={() => void engine.preview(pattern, selectedTrack)}>
          {track.name}
        </button>
        <button
          className={`chip${track.muted ? ' chip--on' : ''}`}
          onClick={() => dispatch({ t: 'track', track: selectedTrack, patch: { muted: !track.muted } })}
        >
          Mute
        </button>
        <button
          className={`chip${track.soloed ? ' chip--on' : ''}`}
          onClick={() => dispatch({ t: 'track', track: selectedTrack, patch: { soloed: !track.soloed } })}
        >
          Solo
        </button>
        <button className="chip" onClick={() => dispatch({ t: 'rowClear', track: selectedTrack })}>
          Zbriši vrsto
        </button>
      </div>

      <div className="inspector__sliders">
        <Slider
          label="Glasnost"
          value={track.level}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(track.level * 100)}%`}
          onChange={(v) => dispatch({ t: 'track', track: selectedTrack, patch: { level: v } })}
        />
        <Slider
          label={def.melodic ? 'Nota' : 'Tune'}
          value={track.tune}
          min={-12}
          max={12}
          step={1}
          display={tuneDisplay}
          onChange={(v) => dispatch({ t: 'track', track: selectedTrack, patch: { tune: v } })}
        />
        <Slider
          label="Dolžina"
          value={track.decay}
          min={0.2}
          max={2}
          step={0.05}
          display={`${track.decay.toFixed(2)}×`}
          onChange={(v) => dispatch({ t: 'track', track: selectedTrack, patch: { decay: v } })}
        />
      </div>
    </footer>
  )
}
