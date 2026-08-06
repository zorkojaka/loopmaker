import type { Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { melodicOf, noteName } from '../audio/instruments'
import type { Action } from '../state/song'
import type { Loop } from '../types'

interface Props {
  loop: Loop
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

/** Spodnji pas: parametri loopa, ki ga urejaš. */
export function Inspector({ loop, engine, dispatch }: Props) {
  const melodic = loop.kind === 'melody'
  const patch = (p: Partial<Loop>) => dispatch({ t: 'loopPatch', id: loop.id, patch: p })
  const tuneDisplay = melodic
    ? `${loop.tune > 0 ? '+' : ''}${loop.tune} pt`
    : melodicOf(loop.voice).melodic
      ? noteName(loop.voice, loop.tune)
      : `${loop.tune > 0 ? '+' : ''}${loop.tune}`

  return (
    <footer className="inspector" style={{ '--track': loop.color } as React.CSSProperties}>
      <div className="inspector__head">
        <button className="inspector__name" onClick={() => void engine.preview(loop)}>
          {loop.name}
        </button>
        <span className="inspector__meta">
          {melodic ? `${loop.notes.length} not` : `${loop.steps.filter((s) => s.v).length} udarcev`}
        </span>
        <button className={`chip${loop.active ? ' chip--on' : ''}`} onClick={() => dispatch({ t: 'loopToggle', id: loop.id })}>
          {loop.active ? 'Igra' : 'Izklop'}
        </button>
        <button className="chip" onClick={() => dispatch({ t: 'loopOnly', id: loop.id })}>
          Samo ta
        </button>
        <button className="chip" onClick={() => dispatch({ t: 'loopClear', id: loop.id })}>
          Počisti
        </button>
      </div>

      <div className="inspector__sliders">
        <Slider
          label="Glasnost"
          value={loop.level}
          min={0}
          max={1}
          step={0.01}
          display={`${Math.round(loop.level * 100)}%`}
          onChange={(v) => patch({ level: v })}
        />
        <Slider
          label={melodic ? 'Transpozicija' : 'Tune'}
          value={loop.tune}
          min={-12}
          max={12}
          step={1}
          display={tuneDisplay}
          onChange={(v) => patch({ tune: v })}
        />
        <Slider
          label={melodic ? 'Izzven' : 'Dolžina'}
          value={loop.decay}
          min={0.2}
          max={2}
          step={0.05}
          display={`${loop.decay.toFixed(2)}×`}
          onChange={(v) => patch({ decay: v })}
        />
      </div>
    </footer>
  )
}
