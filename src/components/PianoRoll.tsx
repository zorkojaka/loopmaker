import { useState } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import type { Engine } from '../audio/engine'
import { isBlackKey, melodicOf, midiName } from '../audio/instruments'
import { usePlayhead } from '../hooks/usePlayhead'
import { longPress } from '../hooks/longPress'
import { chordNotes, diatonicChords } from '../state/song'
import type { Action } from '../state/song'
import type { Melody, Note, Pattern, Vel } from '../types'
import type { MenuItem } from './ContextMenu'

interface Props {
  pattern: Pattern
  melodyIndex: number
  engine: Engine
  dispatch: Dispatch<Action>
  openMenu: (x: number, y: number, items: MenuItem[]) => void
  onBack: () => void
}

const ROWS = 24
const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const LENGTHS = [1, 2, 4, 8]

/** Klavirska mreža: navpično višina tona, vodoravno čas. Akordi so noti druga nad drugo. */
export function PianoRoll({ pattern, melodyIndex, engine, dispatch, openMenu, onBack }: Props) {
  const melody: Melody | undefined = pattern.melodies[melodyIndex]
  const [low, setLow] = useState(48) // C3
  const [len, setLen] = useState(4)
  const [caret, setCaret] = useState(0)
  const [root, setRoot] = useState(0) // C
  const [mode, setMode] = useState<'dur' | 'mol'>('dur')

  const { lineRef, scrollRef, step: playStep } = usePlayhead(engine, pattern.length)

  if (!melody) return null
  const def = melodicOf(melody.voice)
  const columns: CSSProperties = { gridTemplateColumns: `repeat(${pattern.length}, minmax(26px, 1fr))` }
  const rows = Array.from({ length: ROWS }, (_, i) => low + ROWS - 1 - i)
  // akorde postavimo tako, da so vse tri note še vidne v oknu
  let chordBase = low + 12 + root
  while (chordBase + 11 > low + ROWS - 1) chordBase -= 12

  const addNotes = (step: number, midis: number[], velocity: Vel = 2) => {
    const notes: Note[] = midis.map((midi) => ({ step, midi, len, v: velocity }))
    dispatch({ t: 'noteAdd', melody: melodyIndex, notes })
    if (!engine.playing) midis.forEach((m) => void engine.previewNote(melody.voice, m, melody.level))
  }

  const stampChord = (midis: number[]) => {
    addNotes(caret, midis)
    setCaret((c) => (c + len) % pattern.length)
  }

  const noteMenu = (n: Note): MenuItem[] => [
    { label: `${midiName(n.midi)} · korak ${n.step + 1}`, header: true },
    { label: 'Dolžina', header: true },
    ...LENGTHS.map((l) => ({
      label: l === 1 ? '1 korak' : `${l} korakov`,
      checked: n.len === l,
      onClick: () => dispatch({ t: 'notePatch', melody: melodyIndex, step: n.step, midi: n.midi, patch: { len: l } }),
    })),
    { separator: true },
    ...([1, 2, 3] as Vel[]).map((v) => ({
      label: v === 1 ? 'Tiho' : v === 2 ? 'Normalno' : 'Glasno',
      checked: n.v === v,
      onClick: () => dispatch({ t: 'notePatch', melody: melodyIndex, step: n.step, midi: n.midi, patch: { v } }),
    })),
    { separator: true },
    { label: 'Izbriši noto', danger: true, onClick: () => dispatch({ t: 'noteRemove', melody: melodyIndex, step: n.step, midi: n.midi }) },
  ]

  const emptyMenu = (step: number, midi: number): MenuItem[] => [
    { label: `${midiName(midi)} · korak ${step + 1}`, header: true },
    { label: 'Akord od te note', header: true },
    { label: 'Dur', onClick: () => addNotes(step, chordNotes(midi, 'dur')) },
    { label: 'Mol', onClick: () => addNotes(step, chordNotes(midi, 'mol')) },
    { label: 'Zmanjšan', onClick: () => addNotes(step, chordNotes(midi, 'zmanjšan')) },
    { separator: true },
    { label: 'Samo ta ton', onClick: () => addNotes(step, [midi]) },
  ]

  return (
    <div className="roll">
      <div className="roll__bar">
        <button className="chip" onClick={onBack}>
          ← Mreža
        </button>
        <span className="roll__name" style={{ '--track': def.color } as CSSProperties}>
          {melody.name}
        </span>
        <div className="roll__group">
          <button className="chip" onClick={() => setLow((v) => Math.max(24, v - 12))}>
            −8va
          </button>
          <span className="roll__meta">{midiName(low)}</span>
          <button className="chip" onClick={() => setLow((v) => Math.min(84, v + 12))}>
            +8va
          </button>
        </div>
        <div className="roll__group">
          <span className="roll__meta">Dolžina</span>
          {LENGTHS.map((l) => (
            <button key={l} className={`chip${len === l ? ' chip--on' : ''}`} onClick={() => setLen(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="chords">
        <select className="chords__key" value={root} onChange={(e) => setRoot(Number(e.target.value))}>
          {ROOTS.map((r, i) => (
            <option key={r} value={i}>
              {r}
            </option>
          ))}
        </select>
        <div className="chords__mode">
          {(['dur', 'mol'] as const).map((m) => (
            <button key={m} className={`chip${mode === m ? ' chip--on' : ''}`} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        {diatonicChords(chordBase, mode).map((c) => (
          <button key={c.numeral} className="chord" onClick={() => stampChord(c.notes)}>
            <strong>{ROOTS[c.root % 12]}</strong>
            <em>{c.quality === 'dur' ? '' : c.quality === 'mol' ? 'm' : '°'}</em>
            <span>{c.numeral}</span>
          </button>
        ))}
        <span className="chords__hint">vstavi na korak {caret + 1}</span>
      </div>

      <div className="timeline">
        <div className="timeline__gutter timeline__gutter--keys">
          <div className="gutter__head">Tipke</div>
          {rows.map((midi) => (
            <button
              key={midi}
              className={`key${isBlackKey(midi) ? ' key--black' : ''}`}
              onClick={() => void engine.previewNote(melody.voice, midi, melody.level)}
            >
              {midi % 12 === 0 || !isBlackKey(midi) ? midiName(midi) : ''}
            </button>
          ))}
        </div>

        <div className="timeline__scroll" ref={scrollRef}>
          <div className="timeline__content">
            <div className="ruler" style={columns}>
              {Array.from({ length: pattern.length }, (_, i) => (
                <div
                  key={i}
                  className={`tick${i % 4 === 0 ? ' tick--beat' : ''}${i === playStep ? ' tick--play' : ''}`}
                  onClick={() => {
                    setCaret(i)
                    engine.seek(i)
                  }}
                >
                  {i % 4 === 0 ? i / 4 + 1 : ''}
                </div>
              ))}
            </div>

            <div className="rows rows--roll">
              {rows.map((midi) => (
                <div key={midi} className={`prow${isBlackKey(midi) ? ' prow--black' : ''}`} style={columns}>
                  {Array.from({ length: pattern.length }, (_, step) => (
                    <div
                      key={step}
                      className={`pslot${step % 4 === 0 ? ' pslot--beat' : ''}${step === caret ? ' pslot--caret' : ''}${step === playStep ? ' pslot--play' : ''}`}
                      onClick={() => {
                        setCaret(step)
                        addNotes(step, [midi])
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        openMenu(e.clientX, e.clientY, emptyMenu(step, midi))
                      }}
                      {...longPress((x, y) => openMenu(x, y, emptyMenu(step, midi)))}
                    />
                  ))}

                  {melody.notes
                    .filter((n) => n.midi === midi)
                    .map((n) => {
                      const press = longPress((x, y) => openMenu(x, y, noteMenu(n)))
                      return (
                        <button
                          key={`${n.step}-${n.midi}`}
                          className={`pnote pnote--v${n.v}`}
                          style={
                            {
                              '--track': def.color,
                              left: `${(n.step / pattern.length) * 100}%`,
                              width: `${(Math.min(n.len, pattern.length - n.step) / pattern.length) * 100}%`,
                            } as CSSProperties
                          }
                          {...press}
                          onClick={() => dispatch({ t: 'noteRemove', melody: melodyIndex, step: n.step, midi: n.midi })}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            openMenu(e.clientX, e.clientY, noteMenu(n))
                          }}
                        />
                      )
                    })}
                </div>
              ))}
            </div>

            <div className="playhead" ref={lineRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
